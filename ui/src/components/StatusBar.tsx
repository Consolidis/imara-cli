import React from 'react';

interface StatusBarProps {
  currentFile: string | null;
  fileLanguage?: string;
  connected: boolean;
  socketError: string | null;
  projectPath?: string;
  // Stats session
  model?: string;
  tokens?: number;
  costFcfa?: number;
  trackId?: string | null;
  trackTitle?: string | null;
  contextPercent?: number;
  contextState?: 'ok' | 'warning' | 'critical' | 'compacted';
  phase?: 'idle' | 'thinking' | 'tool';
}

const StatusBar: React.FC<StatusBarProps> = ({
  currentFile,
  fileLanguage,
  connected,
  socketError,
  projectPath,
  model,
  tokens,
  costFcfa,
  trackId,
  trackTitle,
  contextPercent,
  contextState,
  phase,
}) => {
  const connColor = socketError ? '#ef4444' : connected ? '#22c55e' : '#f59e0b';
  const connText = socketError
    ? 'Erreur'
    : connected
    ? 'Connecte'
    : 'Connexion...';

  const phaseColors: Record<string, string> = {
    idle: '#71717a',
    thinking: '#f59e0b',
    tool: '#3b82f6',
  };

  const ctxColors: Record<string, string> = {
    ok: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
    compacted: '#a855f7',
  };

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
      <div className="center">
        {/* Modele */}
        {model && (
          <span style={{ color: '#f59e0b', fontSize: 11 }}>
            {model}
          </span>
        )}
        {/* Tokens */}
        {tokens !== undefined && tokens > 0 && (
          <span style={{ color: '#71717a', fontSize: 11 }}>
            {(tokens / 1000).toFixed(1)}k tokens
          </span>
        )}
        {/* Cout FCFA */}
        {costFcfa !== undefined && costFcfa > 0 && (
          <span style={{ color: '#a1a1aa', fontSize: 11 }}>
            {costFcfa.toFixed(2)} FCFA
          </span>
        )}
        {/* Contexte */}
        {contextPercent !== undefined && (
          <span
            style={{
              color: ctxColors[contextState || 'ok'] || '#71717a',
              fontSize: 11,
            }}
          >
            ctx {contextPercent}%
          </span>
        )}
        {/* Phase */}
        {phase && phase !== 'idle' && (
          <span
            style={{
              color: phaseColors[phase] || '#71717a',
              fontSize: 11,
            }}
          >
            {phase === 'thinking' ? '...' : phase}
          </span>
        )}
        {/* Track */}
        {trackId && (
          <span style={{ color: '#71717a', fontSize: 11 }}>
            {trackTitle || trackId}
          </span>
        )}
      </div>
      <div className="right">
        {projectPath && (
          <span
            title={projectPath}
            style={{
              color: '#71717a',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 11,
            }}
          >
            {projectPath.split('\\').pop()?.split('/').pop()}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
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
