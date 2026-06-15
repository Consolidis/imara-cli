import React from 'react';

interface DiffViewerProps {
  diff: string;
  fileName: string;
  onClose: () => void;
}

function parseDiffLines(diff: string): Array<{ type: 'header' | 'add' | 'remove' | 'context' | 'hunk'; text: string }> {
  return diff.split('\n').map(line => {
    if (line.startsWith('@@')) return { type: 'hunk' as const, text: line };
    if (line.startsWith('+')) return { type: 'add' as const, text: line };
    if (line.startsWith('-')) return { type: 'remove' as const, text: line };
    if (line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      return { type: 'header' as const, text: line };
    }
    return { type: 'context' as const, text: line };
  });
}

const DiffViewer: React.FC<DiffViewerProps> = ({ diff, fileName, onClose }) => {
  const lines = parseDiffLines(diff);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <span className="diff-viewer-title">Diff — {fileName}</span>
        <button className="diff-viewer-close" onClick={onClose}>✕</button>
      </div>
      <div className="diff-viewer-content">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`diff-line diff-line-${line.type}`}
          >
            <span className="diff-line-prefix">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="diff-line-text">{line.text}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="diff-empty">(diff vide)</div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
