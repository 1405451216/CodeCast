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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, onResizeEnd]);

  return (
    <div
      className="panel-resizer"
      onMouseDown={handleMouseDown}
    >
      <div className="panel-resizer-handle" />
    </div>
  );
};

export default React.memo(PanelResizer);
