import React, { useCallback, useRef, useEffect } from 'react';

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  side: 'left' | 'right';
}

/**
 * Barre verticale de redimensionnement.
 * Emet deltaX via onResize pendant le drag.
 * side='left' pour le handle entre Explorer et Editor
 * side='right' pour le handle entre Editor et Chat
 */
const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, side }) => {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    onResize(delta);
  }, [onResize]);

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`resize-handle resize-handle-${side}`}
      onMouseDown={handleMouseDown}
    />
  );
};

export default ResizeHandle;
