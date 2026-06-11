import React from 'react';

interface StatusBarProps {
  currentFile: string | null;
  fileLanguage?: string;
  connected: boolean;
  socketError: string | null;
  projectPath?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({
  currentFile,
  fileLanguage,
  connected,
  socketError,
  projectPath,
}) => {
  const connColor = socketError ? '#ef4444' : connected ? '#22c55e' : '#f59e0b';
  const connText = socketError
    ? 'Erreur'
    : connected
    ? 'Connecté'
    : 'Connexion...';

  return (
    <div className="status-bar">
      <div className="left">
        {currentFile ? (
          <>
            <span style={{ color: '#a1a1aa' }}>
              {currentFile.split('/').pop()}
            </span>
            {fileLanguage && (
              <span style={{ color: '#71717a', textTransform: 'uppercase', fontSize: 10 }}>
                {fileLanguage}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: '#71717a', fontStyle: 'italic' }}>Aucun fichier ouvert</span>
        )}
      </div>
      <div className="right">
        {projectPath && (
          <span title={projectPath} style={{ color: '#71717a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectPath.split('\\').pop()?.split('/').pop()}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connColor,
            }}
          />
          {connText}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
