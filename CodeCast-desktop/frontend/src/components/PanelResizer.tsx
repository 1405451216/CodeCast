import React, { useCallback, useRef, useEffect } from 'react';

interface PanelResizerProps {
  /** 拖拽方向：水平分隔 (左右面板) */
  direction?: 'horizontal';
  /** 拖拽时的回调，delta 为鼠标移动像素差 */
  onResize: (delta: number) => void;
  /** 拖拽结束回调 */
  onResizeEnd?: () => void;
}

const PanelResizer: React.FC<PanelResizerProps> = ({ direction = 'horizontal', onResize, onResizeEnd }) => {
  const startX = useRef(0);
  const dragging = useRef(false);

  // Clean up cursor style if component unmounts during an active drag
  useEffect(() => {
    return () => {
      if (dragging.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const startDrag = useCallback((clientX: number) => {
    startX.current = clientX;
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const moveDrag = useCallback((clientX: number) => {
    if (!dragging.current) return;
    const delta = clientX - startX.current;
    startX.current = clientX;
    onResize(delta);
  }, [onResize]);

  const endDrag = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onResizeEnd?.();
  }, [onResizeEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX);

    const handleMouseMove = (ev: MouseEvent) => {
      moveDrag(ev.clientX);
    };

    const handleMouseUp = () => {
      endDrag();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [startDrag, moveDrag, endDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX);
    }
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX);
  }, [moveDrag]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return (
    <div
      className="panel-resizer"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="panel-resizer-handle" />
    </div>
  );
};

export default React.memo(PanelResizer);
