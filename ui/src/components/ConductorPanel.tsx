import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ConductorData } from '../hooks/useConductorData';

interface GitData {
  commits: string;
  status: string;
  diff: string;
  timestamp: number;
}

interface ConductorPanelProps {
  data: ConductorData;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onClose: () => void;
  socket?: any; // Socket.IO client instance
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function statusIcon(status: string, validated: boolean): string {
  if (validated) return '✅';
  switch (status) {
    case 'active': return '🟢';
    case 'done': return '🔵';
    case 'archived': return '🔴';
    default: return '⚪';
  }
}

function statusLabel(status: string, validated: boolean): string {
  if (validated) return 'Valide';
  switch (status) {
    case 'active': return 'Actif';
    case 'done': return 'Termine';
    case 'archived': return 'Archive';
    default: return 'Inconnu';
  }
}

type ListTab = 'active' | 'archived';
type DetailTab = 'plan' | 'spec' | 'logs' | 'workflow' | 'git';

const ConductorPanel: React.FC<ConductorPanelProps> = ({
  data,
  loading,
  error,
  onRefresh,
  onClose,
  socket,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('git');
  const [listTab, setListTab] = useState<ListTab>('active');

  // Git state
  const [gitData, setGitData] = useState<GitData | null>(null);
  const [gitLoading, setGitLoading] = useState<boolean>(false);
  const [gitPushing, setGitPushing] = useState<boolean>(false);
  const [gitPushResult, setGitPushResult] = useState<string | null>(null);

  const { tracks, progress, spec, workflow, logs, registre } = data;

  // Separate tracks into active and archived
  const activeTracks = useMemo(
    () => tracks.filter(t => t.status !== 'archived'),
    [tracks]
  );
  const archivedTracks = useMemo(
    () => tracks.filter(t => t.status === 'archived'),
    [tracks]
  );

  const currentList = listTab === 'active' ? activeTracks : archivedTracks;

  const sortedTracks = useMemo(
    () => [...currentList].sort((a, b) => {
      if (a.status === 'active') return -1;
      if (b.status === 'active') return 1;
      return 0;
    }),
    [currentList]
  );

  const selectedProgress = selectedTrack ? progress[selectedTrack] : null;
  const selectedMeta = selectedTrack ? tracks.find(t => t.id === selectedTrack) : null;

  const effectiveSelected = selectedMeta && sortedTracks.some(t => t.id === selectedTrack)
    ? selectedTrack
    : null;

  // Auto-switch tab: when selecting a track, show plan; when deselecting, show git
  useEffect(() => {
    if (effectiveSelected) {
      setActiveTab('plan');
    } else {
      setActiveTab('git');
    }
  }, [effectiveSelected]);

  // Load Git data when the Git tab is selected
  const loadGitData = useCallback(() => {
    if (!socket) return;
    setGitLoading(true);
    setGitPushResult(null);
    socket.emit('request-git-log', (result: GitData & { error?: string }) => {
      if (result.error) {
        setGitData(null);
      } else {
        setGitData({
          commits: result.commits || '',
          status: result.status || '',
          diff: result.diff || '',
          timestamp: result.timestamp || Date.now(),
        });
      }
      setGitLoading(false);
    });
  }, [socket]);

  useEffect(() => {
    if (activeTab === 'git') {
      loadGitData();
    }
  }, [activeTab, loadGitData]);

  const handlePush = useCallback(() => {
    if (!socket || gitPushing) return;
    setGitPushing(true);
    setGitPushResult(null);
    socket.emit('request-git-push', (result: { success: boolean; message: string }) => {
      setGitPushResult(result.message);
      setGitPushing(false);
      // Reload git data after push
      loadGitData();
    });
  }, [socket, gitPushing, loadGitData]);

  const isGitTab = activeTab === 'git';

  return (
    <div className="conductor-panel">
      <div className="conductor-header">
        <span>Conductor</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="conductor-btn" onClick={onRefresh} title="Rafraichir">
            ↻
          </button>
          <button className="conductor-btn" onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>
      </div>

      {error && (
        <div className="conductor-error">
          Erreur: {error}
        </div>
      )}

      <div className="conductor-filter-tabs">
        <button
          className={`cond-filter-tab ${listTab === 'active' ? 'active' : ''}`}
          onClick={() => setListTab('active')}
        >
          Actifs ({activeTracks.length})
        </button>
        <button
          className={`cond-filter-tab ${listTab === 'archived' ? 'active' : ''}`}
          onClick={() => setListTab('archived')}
        >
          Archives ({archivedTracks.length})
        </button>
      </div>

      <div className="conductor-body">
        <div className="conductor-track-list">
          {loading && tracks.length === 0 && (
            <div className="conductor-loading">Chargement...</div>
          )}
          {sortedTracks.map((track) => {
            const p = progress[track.id];
            const isActive = track.status === 'active';
            const isSelected = effectiveSelected === track.id;
            return (
              <div
                key={track.id}
                className={`conductor-track-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTrack(isSelected ? null : track.id);
                  if (isGitTab) setActiveTab('plan');
                }}
              >
                <div className="conductor-track-header">
                  <span className="conductor-track-icon">{statusIcon(track.status, track.validated)}</span>
                  <span className="conductor-track-title">{track.title}</span>
                  <span className="conductor-track-status">{statusLabel(track.status, track.validated)}</span>
                </div>
                {p && p.total > 0 && (
                  <div className="conductor-progress-bar">
                    <div
                      className="conductor-progress-fill"
                      style={{ width: `${p.percent}%` }}
                    />
                    <span className="conductor-progress-text">{p.done}/{p.total} ({p.percent}%)</span>
                  </div>
                )}
                <div className="conductor-track-meta">
                  {track.author && <span>{track.author}</span>}
                  {track.createdAt && <span>{formatDate(track.createdAt)}</span>}
                </div>
              </div>
            );
          })}
          {tracks.length === 0 && !loading && (
            <div className="conductor-empty">Aucun track. Essayez de parler a l'agent.</div>
          )}
          {tracks.length > 0 && sortedTracks.length === 0 && !loading && (
            <div className="conductor-empty">Aucun track dans cette categorie.</div>
          )}
        </div>

        <div className="conductor-detail-zone">
          {/* If a track is selected, show track detail tabs + optional Git tab */}
          {effectiveSelected && selectedMeta ? (
            <>
              <div className="conductor-detail-tabs">
                <button className={`cond-tab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>Plan</button>
                <button className={`cond-tab ${activeTab === 'spec' ? 'active' : ''}`} onClick={() => setActiveTab('spec')}>Spec</button>
                <button className={`cond-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs</button>
                <button className={`cond-tab ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>Workflow</button>
                <button className={`cond-tab ${activeTab === 'git' ? 'active' : ''}`} onClick={() => setActiveTab('git')}>Git</button>
              </div>
              <div className="conductor-detail-content">
                {activeTab === 'plan' && (
                  selectedProgress && selectedProgress.tasks.length > 0 ? (
                    <div className="cond-tasks">
                      {selectedProgress.tasks.map((task, i) => (
                        <div key={i} className={`cond-task ${task.includes('[x]') ? 'done' : task.includes('[~]') ? 'progress' : 'todo'}`}>
                          {task}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="cond-empty">Aucune tache definie dans le plan.</div>
                  )
                )}
                {activeTab === 'spec' && (
                  <pre className="cond-markdown">{spec || '(Aucune specification)'}</pre>
                )}
                {activeTab === 'logs' && (
                  <pre className="cond-markdown">{logs || '(Aucun log)'}</pre>
                )}
                {activeTab === 'workflow' && (
                  <pre className="cond-markdown">{workflow || '(Aucun workflow defini)'}</pre>
                )}
                {isGitTab && renderGitContent()}
              </div>
            </>
          ) : (
            <>
              {/* No track selected: show Git tab alone or registre */}
              <div className="conductor-detail-tabs">
                <button className={`cond-tab ${activeTab === 'git' ? 'active' : ''}`} onClick={() => setActiveTab('git')}>Git</button>
                {registre && <span className="cond-tab passive">Registre</span>}
              </div>
              <div className="conductor-detail-content">
                {isGitTab && renderGitContent()}
                {activeTab !== 'git' && registre && (
                  <pre className="cond-markdown">{registre}</pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  function renderGitContent() {
    if (!socket) {
      return <div className="cond-empty">Socket non connecte.</div>;
    }
    if (gitLoading && !gitData) {
      return <div className="cond-empty">Chargement des donnees Git...</div>;
    }
    return (
      <div className="cond-git-panel">
        {/* Push button + result */}
        <div className="cond-git-actions">
          <button
            className="cond-git-push-btn"
            onClick={handlePush}
            disabled={gitPushing}
          >
            {gitPushing ? 'Push en cours...' : 'Push'}
          </button>
          {gitPushResult && (
            <div className={`cond-git-push-result ${gitPushResult.includes('succes') || gitPushResult.includes('Everything') ? 'success' : 'error'}`}>
              {gitPushResult}
            </div>
          )}
        </div>

        {/* Git status */}
        {gitData?.status && (
          <div className="cond-git-section">
            <div className="cond-git-section-title">Status</div>
            <pre className="cond-markdown">{gitData.status || '(aucune modification)'}</pre>
          </div>
        )}

        {/* Recent commits */}
        {gitData?.commits && (
          <div className="cond-git-section">
            <div className="cond-git-section-title">Commits recents</div>
            <pre className="cond-markdown">{gitData.commits}</pre>
          </div>
        )}

        {/* Diff */}
        {gitData?.diff && (
          <div className="cond-git-section">
            <div className="cond-git-section-title">Diff</div>
            <pre className="cond-markdown cond-git-diff">{gitData.diff}</pre>
          </div>
        )}
      </div>
    );
  }
};

export default ConductorPanel;
