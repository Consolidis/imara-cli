import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { useFileTree } from './hooks/useFileTree';
import { useChat } from './hooks/useChat';
import FileExplorer from './components/FileExplorer';
import MonacoEditor from './components/MonacoEditor';
import ChatPanel from './components/ChatPanel';
import WelcomeScreen from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';
import { FileContent } from './types';

/** Structure d'un onglet ouvert */
interface Tab {
  path: string;
  language: string;
  content: string | null;
}

const App: React.FC = () => {
  const { socket, connected, error: socketError } = useSocket();
  const { tree, loading: treeLoading } = useFileTree(socket);
  const { messages, sendMessage, isProcessing, clearMessages, stopGeneration } = useChat(socket);
  const [currentModel, setCurrentModel] = useState<string>('zuri');
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string>('');
  const activeTab = openTabs.find(t => t.path === activeTabPath) || null;
  const fileContentCache = useRef<Map<string, string>>(new Map());

  // Récupérer le chemin du projet via health check
  useEffect(() => {
    if (!socket) return;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.cwd) setProjectPath(data.cwd);
      })
      .catch(() => {});
  }, [socket]);

  // Ouvrir un fichier : charge le contenu via HTTP puis ajoute l'onglet  // Ouvrir un fichier : charge le contenu via socket.emit (plus fiable que fetch)
  // puis ajoute l'onglet
  const handleSelectFile = useCallback((path: string) => {
    console.log(`[DEBUG handleSelectFile] Selection fichier: "${path}"`);
    // Vérifier si déjà ouvert
    const alreadyOpen = openTabs.some(t => t.path === path);
    if (alreadyOpen) {
      console.log(`[DEBUG handleSelectFile] Fichier deja ouvert, activation onglet: "${path}"`);
      setActiveTabPath(path);
      return;
    }
    // Ajouter un onglet "loading" immediatement
    const loadingTab: Tab = { path, language: 'plaintext', content: null };
    setOpenTabs(prev => [...prev, loadingTab]);
    setActiveTabPath(path);
    // Charger le contenu via socket.emit (callback integre, plus fiable que fetch)
    if (!socket) {
      console.warn(`[DEBUG handleSelectFile] Socket non connecte, fallback fetch pour: "${path}"`);
      fetch(`/api/files/read?path=${encodeURIComponent(path)}`)
        .then(res => res.json())
        .then((result: FileContent & { error?: string }) => {
          if (result.error) {
            setOpenTabs(prev =>
              prev.map(t => t.path === path
                ? { ...t, content: `// Erreur: ${result.error}` }
                : t)
            );
            return;
          }
          fileContentCache.current.set(path, result.content);
          setOpenTabs(prev =>
            prev.map(t => t.path === path
              ? { ...t, content: result.content, language: result.language }
              : t)
          );
        })
        .catch(err => {
          setOpenTabs(prev =>
            prev.map(t => t.path === path
              ? { ...t, content: `// Erreur reseau: ${err.message}` }
              : t)
          );
        });
      return;
    }
    console.log(`[DEBUG handleSelectFile] Emission socket read-file pour: "${path}"`);
    socket.emit('read-file', { path }, (result: FileContent & { error?: string }) => {
      console.log(`[DEBUG handleSelectFile] Reponse socket pour "${path}":`, result);
      if (result.error) {
        console.warn(`[DEBUG handleSelectFile] Erreur socket pour "${path}": ${result.error}`);
        setOpenTabs(prev =>
          prev.map(t => t.path === path
            ? { ...t, content: `// Erreur: ${result.error}` }
            : t)
        );
        return;
      }
      fileContentCache.current.set(path, result.content);
      setOpenTabs(prev =>
        prev.map(t => t.path === path
          ? { ...t, content: result.content, language: result.language }
          : t)
      );
      console.log(`[DEBUG handleSelectFile] Onglet mis a jour avec succes: "${path}" (${result.content.length} caracteres)`);
    });
  }, [openTabs, socket]);  }, [openTabs]);

  // Fermer un onglet
  const handleCloseTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === path);
      const updated = prev.filter(t => t.path !== path);

      // Si on ferme l'onglet actif, basculer sur un voisin
      if (path === activeTabPath && updated.length > 0) {
        const newIdx = Math.min(idx, updated.length - 1);
        setActiveTabPath(updated[newIdx].path);
      } else if (updated.length === 0) {
        setActiveTabPath(null);
      }

      return updated;
    });
  }, [activeTabPath]);

  // Mettre à jour le contenu d'un onglet (après sauvegarde)  // Mettre à jour le contenu d'un onglet (après sauvegarde)
  const handleContentChange = useCallback((path: string, content: string) => {
    setOpenTabs(prev =>
      prev.map(t => (t.path === path ? { ...t, content } : t))
    );
    fileContentCache.current.set(path, content);
  }, []);

  // Rafraîchir le contenu si l'agent modifie le fichier (file-updated)  // Rafraîchir le contenu si l'agent modifie le fichier (file-updated)
  useEffect(() => {
    if (!socket) return;

    const handleFileUpdated = (data: { path: string; event: string }) => {
      // Vérifier si le fichier modifié est dans les onglets ouverts
      const tab = openTabs.find(t =>
        t.path === data.path || t.path.endsWith(data.path)
      );
      if (!tab) return;

      // Recharger le contenu
      socket.emit('read-file', { path: tab.path }, (result: FileContent & { error?: string }) => {
        if (!result.error) {
          setOpenTabs(prev =>
            prev.map(t => (t.path === tab.path ? { ...t, content: result.content, language: result.language } : t))
          );
        }
      });
    };

    socket.on('file-updated', handleFileUpdated);
    return () => {
      socket.off('file-updated', handleFileUpdated);
    };
  }, [socket, openTabs]);

  const projectName = projectPath
    ? projectPath.split('\\').pop()?.split('/').pop()
    : undefined;

  return (
    <div className="app-layout">
      {/* Header */}
      <div className="app-header">
        <div className="brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          IMARA STUDIO CODE
          {projectName && (
            <span style={{ fontWeight: 400, fontSize: 11, color: '#71717a', marginLeft: 8 }}>
              — {projectName}
            </span>
          )}
        </div>
        <div className="status-indicator">
          <span className="status-dot" style={{ background: connected ? '#22c55e' : '#f59e0b' }} />
          {connected ? 'Connecté' : 'Connexion...'}
        </div>
      </div>

      {/* Main content */}
      <div className="app-main">
        {/* File Explorer */}
        <FileExplorer
          tree={tree}
          onSelectFile={handleSelectFile}
          selectedFile={activeTabPath}
          loading={treeLoading}
        />

        {/* Editor + Tabs */}
        {activeTab ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Barre d'onglets */}
            <div className="editor-tabs">
              {openTabs.map((tab) => (
                <button
                  key={tab.path}
                  className={`editor-tab${tab.path === activeTabPath ? ' active' : ''}`}
                  onClick={() => setActiveTabPath(tab.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {tab.path.split('/').pop()}
                  <span
                    onClick={(e) => handleCloseTab(tab.path, e)}
                    style={{
                      fontSize: 10,
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '0 2px',
                      borderRadius: 2,
                      lineHeight: '14px',
                    }}
                    title="Fermer l'onglet"
                  >
                    ✕
                  </span>
                </button>
              ))}
            </div>
            {/* Éditeur */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <MonacoEditor
                key={activeTab.path}
                filePath={activeTab.path}
                fileContent={activeTab.content}
                fileLanguage={activeTab.language}
                socket={socket}
                onContentChange={handleContentChange}
              />
            </div>
          </div>
        ) : (
          <WelcomeScreen projectName={projectName} />
        )}

        {/* Chat Panel */}
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          isProcessing={isProcessing}
          onClear={clearMessages}
          onStop={stopGeneration}
          currentModel={currentModel}          currentModel={currentModel}
          onChangeModel={(m: string) => {
            console.log(`[DEBUG change-model] Changement de modele: "${m}"`);
            setCurrentModel(m);
            if (socket) {
              socket.emit('change-model', { model: m });
            } else {
              console.warn(`[DEBUG change-model] Socket non connecte, modele "${m}" non transmis au serveur`);
            }
          }}        />
      </div>

      {/* Status Bar */}
      <StatusBar
        currentFile={activeTabPath}
        fileLanguage={activeTab?.language}
        connected={connected}
        socketError={socketError}
        projectPath={projectPath}
      />
    </div>
  );
};

export default App;
