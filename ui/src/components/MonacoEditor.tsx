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
  const [syncState, setSyncState] = useState<'saved' | 'modified' | 'saving'>('saved');
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localContentRef = useRef<string>('');
  const prevFilePathRef = useRef<string | null>(null);
  const markerCleanerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mettre a jour le contenu de l'editeur quand fileContent change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || fileContent === null) return;

    // Si le fichier a change, on remplace tout le modele
    if (filePath !== prevFilePathRef.current) {
      console.log(`[MonacoEditor] Changement fichier: "${prevFilePathRef.current}" -> "${filePath}"`);
      prevFilePathRef.current = filePath;
      localContentRef.current = fileContent;
      editor.setValue(fileContent);
      setSyncState('saved');
      return;
    }

    // Meme fichier, mise a jour du contenu (rechargement asynchrone)
    if (fileContent !== localContentRef.current) {
      console.log(`[MonacoEditor] Mise a jour contenu "${filePath}": ${fileContent.length} caracteres`);
      localContentRef.current = fileContent;
      editor.setValue(fileContent);
      // Forcer le modele a ne pas etre considere comme modifie
      const model = editor.getModel();
      if (model) model.pushStackElement();
      setSyncState('saved');
    }
  }, [filePath, fileContent]);

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

  // Nettoyer les markers de validation
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

    // Charger le contenu initial si disponible
    if (fileContent !== null) {
      localContentRef.current = fileContent;
      editor.setValue(fileContent);
    }

    clearMarkers();
    editor.onDidChangeModelContent(() => {
      setTimeout(clearMarkers, 0);
    });
    markerCleanerRef.current = setInterval(clearMarkers, 2000);
  };

  const handleChange: OnChange = (value) => {
    if (value !== undefined) {
      localContentRef.current = value;
      debouncedSave(value);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (markerCleanerRef.current) clearInterval(markerCleanerRef.current);
    };
  }, []);

  if (!filePath) return null;

  return (
    <div className="editor-panel" style={{ width: '100%', height: '100%' }}>
      <div className="editor-container" style={{ width: '100%', height: '100%' }}>
        <Editor
          key={filePath}
          defaultLanguage={fileLanguage || 'plaintext'}
          language={fileLanguage || 'plaintext'}
          defaultValue=""
          theme="vs-dark"
          width="100%"
          height="100%"
          options={EDITOR_OPTIONS}
          onMount={handleEditorDidMount}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default MonacoEditor;
