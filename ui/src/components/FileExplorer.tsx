import React, { useState, useCallback } from 'react';
import { FileNode } from '../types';

interface FileExplorerProps {
  tree: FileNode[];
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
  loading?: boolean;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}

/** Icône par extension de fichier */
function getFileIcon(ext?: string): string {
  const icons: Record<string, string> = {
    '.ts': 'TS', '.tsx': 'TX', '.js': 'JS', '.jsx': 'JX',
    '.json': '{ }', '.md': 'MD', '.css': '#', '.html': '< >',
    '.sql': 'SQL', '.py': 'PY', '.go': 'GO', '.rs': 'RS',
    '.yml': 'YM', '.yaml': 'YM', '.toml': 'TM', '.env': '.env',
    '.sh': '>_', '.bat': '>_', '.ps1': '>_',
    '.gitignore': '.gi', '.dockerignore': '.di',
    '.svg': 'SVG', '.xml': 'XML',
  };
  return ext ? icons[ext] || '📄' : '📄';
}

/** Couleur par extension */
function getFileColor(ext?: string): string {
  const colors: Record<string, string> = {
    '.ts': '#3178c6', '.tsx': '#3178c6', '.js': '#f7df1e', '.jsx': '#f7df1e',
    '.json': '#a5b4fc', '.md': '#42b883', '.css': '#663399', '.html': '#e44d26',
    '.py': '#3572a5', '.go': '#00add8', '.rs': '#dea584',
    '.yaml': '#cb171e', '.yml': '#cb171e',
    '.sh': '#89e051', '.sql': '#e38c00',
  };
  return colors[ext || ''] || '#a1a1aa';
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, onSelect, selectedPath }) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'directory';
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <>
      <div
        className={`file-item${isSelected ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={handleClick}
        title={node.path}
      >
        {isDir && (
          <span className={`chevron${expanded ? ' open' : ''}`}>
            ▶
          </span>
        )}
        {!isDir && <span className="chevron" />}
        <span className="icon" style={{ color: isDir ? '#f59e0b' : getFileColor(node.extension) }}>
          {isDir ? (expanded ? '📂' : '📁') : getFileIcon(node.extension)}
        </span>
        <span style={{ color: isDir ? '#e4e4e7' : undefined }}>
          {node.name}
        </span>
      </div>
      {isDir && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
          {node.children.length === 0 && (
            <div
              className="file-item"
              style={{
                paddingLeft: 12 + (depth + 1) * 16,
                color: '#71717a',
                fontStyle: 'italic',
                fontSize: 12,
                cursor: 'default',
              }}
            >
              — dossier vide —
            </div>
          )}
        </>
      )}
    </>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  onSelectFile,
  selectedFile,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="file-explorer">
        <div className="file-explorer-header">Explorateur</div>
        <div className="file-explorer-content" style={{ padding: 16, color: '#71717a', textAlign: 'center' }}>
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span>Explorateur</span>
        <span style={{ fontSize: 10, fontWeight: 400 }}>(projet local)</span>
      </div>
      <div className="file-explorer-content">
        {tree.length === 0 ? (
          <div style={{ padding: 16, color: '#71717a', textAlign: 'center', fontSize: 12 }}>
            Aucun fichier trouvé
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={onSelectFile}
              selectedPath={selectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
