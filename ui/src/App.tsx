import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { useFileTree } from './hooks/useFileTree';
import { useChat } from './hooks/useChat';
import { useSessionStats } from './hooks/useSessionStats';
import FileExplorer from './components/FileExplorer';
import MonacoEditor from './components/MonacoEditor';
import ChatPanel from './components/ChatPanel';
import WelcomeScreen from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';
import ConductorPanel from './components/ConductorPanel';
import { useConductorData } from './hooks/useConductorData';
import { FileContent, FileNode } from './types';

interface Tab {
  path: string;
  language: string;
  content: string | null;
}

function findFirstFile(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file') return node.path;
    if (node.children) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

const App: React.FC = () => {
  const { socket, connected, error: socketError } = useSocket();
  const { tree, loading: treeLoading } = useFileTree(socket);
  const { messages, sendMessage, isProcessing, clearMessages, stopGeneration } = useChat(socket);
  const sessionStats = useSessionStats(socket);
  const [currentModel, setCurrentModel] = useState<string>('zuri');
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string>('');
  const [gitDiffCount, setGitDiffCount] = useState<number>(0);
  const [showConductor, setShowConductor] = useState<boolean>(false);
  const conductorData = useConductorData(socket);
  const activeTab = openTabs.find(t => t.path === activeTabPath) || null;
  const fileContentCache = useRef<Map<string, string>>(new Map());
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (treeLoading || tree.length === 0 || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const firstPath = findFirstFile(tree);
    if (!firstPath) return;
    const loadingTab: Tab = { path: firstPath, language: 'plaintext', content: null };
    setOpenTabs(prev => [...prev, loadingTab]);
    setActiveTabPath(firstPath);
    if (socket) {
      socket.emit('read-file', { path: firstPath }, (result: FileContent & { error?: string }) => {
        if (result.error) {
          setOpenTabs(prev =>
            prev.map(t => t.path === firstPath
              ? { ...t, content: `// Erreur: ${result.error}` }
              : t)
          );
          return;
        }
        fileContentCache.current.set(firstPath, result.content);
        setOpenTabs(prev =>
          prev.map(t => t.path === firstPath
            ? { ...t, content: result.content, language: result.language }
            : t)
        );
      });
    }
  }, [treeLoading, tree, socket]);

  useEffect(() => {
    if (!socket) return;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => { if (data.cwd) setProjectPath(data.cwd); })
      .catch(() => {});
  }, [socket]);

  const handleSelectFile = useCallback((path: string) => {
    const alreadyOpen = openTabs.some(t => t.path === path);
    if (alreadyOpen) { setActiveTabPath(path); return; }
    const loadingTab: Tab = { path, language: 'plaintext', content: null };
    setOpenTabs(prev => [...prev, loadingTab]);
    setActiveTabPath(path);
    if (!socket) {
      fetch(`/api/files/read?path=${encodeURIComponent(path)}`)
        .then(res => res.json())
        .then((result: FileContent & { error?: string }) => {
          if (result.error) {
            setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, content: `// Erreur: ${result.error}` } : t));
            return;
          }
          fileContentCache.current.set(path, result.content);
          setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, content: result.content, language: result.language } : t));
        })
        .catch(err => { setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, content: `// Erreur: ${err.message}` } : t)); });
      return;
    }
    socket.emit('read-file', { path }, (result: FileContent & { error?: string }) => {
      if (result.error) {
        setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, content: `// Erreur: ${result.error}` } : t));
        return;
      }
      fileContentCache.current.set(path, result.content);
      setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, content: result.content, language: result.language } : t));
    });
  }, [openTabs, socket]);

  const handleCloseTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === path);
      const updated = prev.filter(t => t.path !== path);
      if (path === activeTabPath && updated.length > 0) {
        setActiveTabPath(updated[Math.min(idx, updated.length - 1)].path);
      } else if (updated.length === 0) {
        setActiveTabPath(null);
      }
      return updated;
    });
  }, [activeTabPath]);

  const handleContentChange = useCallback((path: string, content: string) => {
    setOpenTabs(prev => prev.map(t => (t.path === path ? { ...t, content } : t)));
    fileContentCache.current.set(path, content);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleFileUpdated = (data: { path: string; event: string }) => {
      const tab = openTabs.find(t => t.path === data.path || t.path.endsWith(data.path));
      if (!tab) return;
      socket.emit('read-file', { path: tab.path }, (result: FileContent & { error?: string }) => {
        if (!result.error) {
          setOpenTabs(prev => prev.map(t => (t.path === tab.path ? { ...t, content: result.content, language: result.language } : t)));
        }
      });
    };
    socket.on('file-updated', handleFileUpdated);
    return () => { socket.off('file-updated', handleFileUpdated); };
  }, [socket, openTabs]);

  const handleRequestGitDiff = useCallback(() => {
    if (!socket) return;
    socket.emit('request-git-diff', (result: { diff: string; status: string; error?: string }) => {
      if (result.error) {
        console.error('[GitDiff] Erreur:', result.error);
        return;
      }
      const lines = result.diff.split('\n').filter(l => l.length > 0).length;
      setGitDiffCount(lines);
      alert(`Git Diff:\n\n${result.diff || '(aucune modification)'}\n\nStatus:\n${result.status || '(pas de changements)'}`);
    });
  }, [socket]);

  const projectName = projectPath
    ? projectPath.split('\\').pop()?.split('/').pop()
    : undefined;

  return (
    <div className="app-layout">
      <div className="app-header">
        <div className="brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          IMARA STUDIO CODE
          {projectName && (
            <span style={{ fontWeight: 400, fontSize: 11, color: '#71717a', marginLeft: 8 }}>— {projectName}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowConductor(v => !v)}
            style={{
              background: showConductor ? 'var(--accent-primary)' : 'transparent',
              color: showConductor ? 'var(--text-inverse)' : 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              fontSize: 11,
              padding: '2px 8px',
              cursor: 'pointer',
              lineHeight: '20px',
            }}
            title="Panneau Conductor"
          >
            🛤 Conductor
          </button>
        </div>
        <div className="status-indicator">
          <span className="status-dot" style={{ background: connected ? '#22c55e' : '#f59e0b' }} />
          {connected ? 'Connecte' : 'Connexion...'}
        </div>
      </div>

      <div className="app-main">
        <FileExplorer
          tree={tree}
          onSelectFile={handleSelectFile}
          selectedFile={activeTabPath}
          loading={treeLoading}
        />

        {activeTab ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="editor-tabs">
              {openTabs.map((tab) => (
                <button
                  key={tab.path}
                  className={`editor-tab${tab.path === activeTabPath ? ' active' : ''}`}
                  onClick={() => setActiveTabPath(tab.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {tab.path.split('/').pop()}
                  <span onClick={(e) => handleCloseTab(tab.path, e)}
                    style={{ fontSize: 10, color: '#71717a', cursor: 'pointer', padding: '0 2px', borderRadius: 2, lineHeight: '14px' }}
                    title="Fermer l'onglet">X</span>
                </button>
              ))}
            </div>
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

        {showConductor && (
          <ConductorPanel
            data={conductorData.data}
            loading={conductorData.loading}
            error={conductorData.error}
            onRefresh={conductorData.refresh}
            onClose={() => setShowConductor(false)}
          />
        )}
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          isProcessing={isProcessing}
          onClear={clearMessages}
          onStop={stopGeneration}
          currentModel={currentModel}
          onChangeModel={(m: string) => {
            setCurrentModel(m);
            if (socket) socket.emit('change-model', { model: m });
          }}
        />
      </div>

      <StatusBar
        currentFile={activeTabPath}
        fileLanguage={activeTab?.language}
        connected={connected}
        socketError={socketError}
        projectPath={projectPath}
        model={sessionStats.model}
        tokens={sessionStats.tokens}
        costFcfa={sessionStats.costFcfa}
        trackId={sessionStats.trackId}
        trackTitle={sessionStats.trackTitle}
        contextPercent={sessionStats.contextPercent}
        contextState={sessionStats.contextState}
        phase={sessionStats.phase}
        onRequestGitDiff={handleRequestGitDiff}
        gitDiffCount={gitDiffCount}
      />
    </div>
  );
};

export default App;
