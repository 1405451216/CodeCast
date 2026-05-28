import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  overscan?: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  estimatedSize?: number;
  emptyMessage?: string;
  onScrollEnd?: () => void;
}

export function CastVirtualList<T>({
  items,
  itemHeight,
  overscan = 8,
  renderItem,
  keyExtractor,
  className = '',
  emptyMessage = '暂无数据',
  onScrollEnd,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(300);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);

    let rafId: number;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        if (onScrollEnd && el.scrollHeight - el.scrollTop - containerHeight < 50) {
          onScrollEnd();
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [containerHeight, onScrollEnd]);

  const getItemHeight = useCallback((index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  const { visibleItems, totalHeight, startY } = useMemo(() => {
    if (items.length === 0) return { visibleItems: [] as Array<{ item: T; index: number; offsetTop: number }>, totalHeight: 0, startY: 0 };

    let accumulatedHeight = 0;
    let startIndex = 0;
    let startOffset = 0;

    for (let i = 0; i < items.length; i++) {
      const h = getItemHeight(i);
      if (accumulatedHeight + h > scrollTop - overscan * getItemHeight(0)) {
        startIndex = i;
        startOffset = accumulatedHeight;
        break;
      }
      accumulatedHeight += h;
    }

    const visible: Array<{ item: T; index: number; offsetTop: number }> = [];
    let currentHeight = startOffset;
    const endThreshold = scrollTop + containerHeight + overscan * getItemHeight(Math.min(startIndex + overscan, items.length - 1));

    for (let i = startIndex; i < items.length && currentHeight < endThreshold; i++) {
      visible.push({ item: items[i], index: i, offsetTop: currentHeight });
      currentHeight += getItemHeight(i);
    }

    let totalH = 0;
    for (let i = 0; i < items.length; i++) {
      totalH += getItemHeight(i);
    }

    return { visibleItems: visible, totalHeight: totalH, startY: startOffset };
  }, [items, scrollTop, containerHeight, overscan, getItemHeight]);

  if (items.length === 0) {
    return (
      <div className={`cast-virtual-list cast-virtual-list-empty ${className}`}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`cast-virtual-list ${className}`}
      style={{ overflowY: 'auto', position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offsetTop }) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetTop}px)`,
            height: getItemHeight(index),
          };
          return (
            <React.Fragment key={keyExtractor(item, index)}>
              {renderItem(item, index, style)}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface LazyComponentProps {
  importFn: () => Promise<{ default: React.ComponentType<any> }>;
  fallback?: React.ReactNode;
  props?: Record<string, unknown>;
}

export function LazyCastComponent({ importFn, fallback, props }: LazyComponentProps) {
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    importFn()
      .then(mod => {
        setComponent(() => mod.default);
        setError(null);
      })
      .catch(e => {
        setError(String(e?.message || e));
      })
      .finally(() => setLoading(false));
  }, [importFn]);

  if (loading) return <>{fallback ?? <div className="cast-lazy-loading">加载中...</div>}</>;
  if (error) return <div className="cast-lazy-error">组件加载失败: {error}</div>;
  if (!Component) return <>{fallback ?? null}</>;

  return <Component {...(props || {})} />;
}
