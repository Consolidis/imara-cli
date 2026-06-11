import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { Socket } from 'socket.io-client';

interface MonacoEditorProps {
  filePath: string | null;
  fileContent: string | null;
  fileLanguage: string;
  socket: Socket | null;
  onContentChange: (path: string, content: string) => void;
}

/** Configuration de l'éditeur Monaco — diagnostics désactivés */
const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  cursorSmoothCaretAnimation: 'on' as const,
  smoothScrolling: true,
  padding: { top: 8 },
  tabSize: 2,
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
  wordWrap: 'on' as const,
  renderValidationDecorations: 'off' as const,
  hover: { enabled: false, delay: 300 },
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  occurrencesHighlight: 'off' as const,
  selectionHighlight: false,
  matchBrackets: 'never' as const,
  guides: {
    indentation: false,
    bracketPairs: false,
    bracketPairsHorizontal: false,
    highlightActiveIndentation: false,
    highlightActiveBracketPair: false,
  },
};

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  filePath,
  fileContent,
  fileLanguage,
  socket,
  onContentChange,
}) => {
  const [content, setContent] = useState<string | null>(fileContent);
  const [syncState, setSyncState] = useState<'saved' | 'modified' | 'saving'>('saved');
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFilePathRef = useRef<string | null>(null);
  const markerCleanerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mettre à jour le contenu quand le fichier change ou que le contenu arrive
  useEffect(() => {
    // Nouveau fichier selectionne
    if (filePath !== prevFilePathRef.current) {
      console.log(`[MonacoEditor] Changement fichier: "${prevFilePathRef.current}" -> "${filePath}", content=`, fileContent);
      setContent(fileContent);
      setSyncState('saved');
      prevFilePathRef.current = filePath;
      return;
    }
    // Meme fichier, nouveau contenu (reception asynchrone ou file-updated)
    if (fileContent !== null && fileContent !== content) {
      console.log(`[MonacoEditor] Mise a jour contenu pour "${filePath}": ${fileContent.length} caracteres`);
      setContent(fileContent);
      setSyncState('saved');
    }
  }, [filePath, fileContent, content]);

  // Sauvegarder automatiquement avec debounce
  const debouncedSave = useCallback(
    (newContent: string) => {
      if (!filePath || !socket) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSyncState('modified');
      debounceRef.current = setTimeout(() => {
        setSyncState('saving');
        socket.emit(
          'write-file',
          { path: filePath, content: newContent },
          (result: any) => {
            if (result?.saved) {
              setSyncState('saved');
              onContentChange(filePath, newContent);
            } else {
              setSyncState('modified');
            }
          }
        );
      }, 500);
    },
    [filePath, socket, onContentChange]
  );

  // Nettoyer les markers de validation en temps reel
  const clearMarkers = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelMarkers(model, 'typescript', []);
      monacoRef.current.editor.setModelMarkers(model, 'javascript', []);
    }
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    clearMarkers();
    editor.onDidChangeModelContent(() => {
      setTimeout(clearMarkers, 0);
    });
    markerCleanerRef.current = setInterval(clearMarkers, 2000);
  };

  const handleChange: OnChange = (value) => {
    if (value !== undefined) {
      setContent(value);
      debouncedSave(value);
    }
  };

  // Nettoyer les timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (markerCleanerRef.current) {
        clearInterval(markerCleanerRef.current);
      }
    };
  }, []);

  if (!filePath) {
    return null;
  }

  return (
    <div className="editor-panel">
      <div className="editor-tabs">
        <button className="editor-tab active">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                syncState === 'saved'
                  ? '#22c55e'
                  : syncState === 'saving'
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
          {filePath.split('/').pop()}
          {syncState === 'modified' && (
            <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>● modifie</span>
          )}
          {syncState === 'saving' && (
            <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>sauvegarde...</span>
          )}
        </button>
      </div>
      <div className="editor-container">
        <Editor
          key={filePath}
          defaultLanguage={fileLanguage || 'plaintext'}
          language={fileLanguage || 'plaintext'}
          value={content || ''}
          theme="vs-dark"
          options={EDITOR_OPTIONS}
          onMount={handleEditorDidMount}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default MonacoEditor;
