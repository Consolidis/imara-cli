import React, { useState, useMemo } from 'react';
import { ConductorData, TrackMeta } from '../hooks/useConductorData';

interface ConductorPanelProps {
  data: ConductorData;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onClose: () => void;
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

const ConductorPanel: React.FC<ConductorPanelProps> = ({
  data,
  loading,
  error,
  onRefresh,
  onClose,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spec' | 'plan' | 'logs' | 'workflow'>('plan');
  const [listTab, setListTab] = useState<ListTab>('active');

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

  // Determine which list to show based on active listTab
  const currentList = listTab === 'active' ? activeTracks : archivedTracks;

  // Sort: active/done first within each list
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

  // If selected track is no longer visible, deselect
  const effectiveSelected = selectedMeta && sortedTracks.some(t => t.id === selectedTrack)
    ? selectedTrack
    : null;

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

      {/* Filter tabs: Active / Archived */}
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
        {/* Zone 1: Track list (scrollable) */}
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
                onClick={() => setSelectedTrack(isSelected ? null : track.id)}
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

        {/* Zone 2: Detail panel (fixed, non-scrollable) */}
        <div className="conductor-detail-zone">
          {effectiveSelected && selectedMeta ? (
            <>
              <div className="conductor-detail-tabs">
                <button
                  className={`cond-tab ${activeTab === 'plan' ? 'active' : ''}`}
                  onClick={() => setActiveTab('plan')}
                >
                  Plan
                </button>
                <button
                  className={`cond-tab ${activeTab === 'spec' ? 'active' : ''}`}
                  onClick={() => setActiveTab('spec')}
                >
                  Spec
                </button>
                <button
                  className={`cond-tab ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  Logs
                </button>
                <button
                  className={`cond-tab ${activeTab === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActiveTab('workflow')}
                >
                  Workflow
                </button>
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
              </div>
            </>
          ) : (
            <>
              {!effectiveSelected && registre && (
                <>
                  <div className="conductor-detail-tabs">
                    <span className="cond-tab passive">Registre</span>
                  </div>
                  <div className="conductor-detail-content">
                    <pre className="cond-markdown">{registre}</pre>
                  </div>
                </>
              )}
              {!effectiveSelected && !registre && (
                <div className="conductor-detail-tabs">
                  <span className="cond-tab passive">Details</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConductorPanel;
