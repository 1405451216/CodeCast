import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualScrollerProps<T> {
  items: T[];
  itemHeight?: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  estimatedItemHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  onScrollEnd?: () => void;
  id?: string;
  getItemKey?: (item: T, index: number) => string | number;
}

function VirtualScroller<T>({
  items,
  itemHeight = 50,
  renderItem,
  overscan = 5,
  estimatedItemHeight = 50,
  className = '',
  style = {},
  onScrollEnd,
  id,
  getItemKey
}: VirtualScrollerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const heightCache = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollTop(container.scrollTop);

          if (onScrollEnd &&
              container.scrollHeight - container.scrollTop - containerHeight < 50) {
            onScrollEnd();
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerHeight, onScrollEnd]);

  const getItemHeight = useCallback((item: T, index: number): number => {
    if (typeof itemHeight === 'function') {
      return itemHeight(item, index);
    }

    const cached = heightCache.current.get(index);
    if (cached && cached > 0) return cached;

    return itemHeight as number;
  }, [itemHeight]);

  const { visibleStart, visibleEnd, totalHeight, startIndexOffset } = useMemo(() => {
    let totalHeight = 0;
    const heights: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(items[i], i);
      heights.push(height);
      totalHeight += height;
    }

    let accumulatedHeight = 0;
    let startIndex = 0;

    for (let i = 0; i < items.length; i++) {
      if (accumulatedHeight + heights[i] > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += heights[i];
      if (i === items.length - 1 && startIndex === 0) {
        startIndex = Math.max(0, items.length - 10);
      }
    }

    let endIndex = startIndex;
    let currentHeight = 0;

    for (let i = startIndex; i < items.length; i++) {
      currentHeight += heights[i];
      endIndex = i;

      if (currentHeight > containerHeight + overscan * estimatedItemHeight) {
        break;
      }
    }

    endIndex = Math.min(items.length - 1, endIndex + overscan);

    let startOffset = 0;
    for (let i = 0; i < startIndex; i++) {
      startOffset += heights[i];
    }

    return {
      visibleStart: startIndex,
      visibleEnd: endIndex,
      totalHeight,
      startIndexOffset: startOffset
    };
  }, [items, scrollTop, containerHeight, overscan, estimatedItemHeight, getItemHeight]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleStart, visibleEnd + 1);
  }, [items, visibleStart, visibleEnd]);

  const measureElement = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      const height = el.offsetHeight;
      if (height > 0) {
        heightCache.current.set(index, height);
      }
    }
  }, []);

  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    const container = containerRef.current;
    if (!container || index < 0 || index >= items.length) return;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(items[i], i);
    }

    const itemHeight_val = getItemHeight(items[index], index);

    switch (align) {
      case 'start':
        container.scrollTop = offset;
        break;
      case 'center':
        container.scrollTop = offset - (containerHeight - itemHeight_val) / 2;
        break;
      case 'end':
        container.scrollTop = offset - containerHeight + itemHeight_val;
        break;
      default:
        if (offset < container.scrollTop ||
            offset + itemHeight_val > container.scrollTop + containerHeight) {
          container.scrollTop = offset;
        }
    }
  }, [items, getItemHeight, containerHeight]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    if (id) {
      (window as any).__virtualScrollers = (window as any).__virtualScrollers || {};
      (window as any).__virtualScrollers[id] = { scrollToIndex, scrollToBottom };
    }
  }, [id, scrollToIndex, scrollToBottom]);

  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        id={id}
        className={`virtual-scroller ${className}`}
        style={{ height: '100%', overflow: 'auto', position: 'relative', ...style }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      id={id}
      className={`virtual-scroller ${className}`}
      style={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        ...style
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${startIndexOffset}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = visibleStart + index;
            const key = getItemKey ? getItemKey(item, actualIndex) : actualIndex;
            return (
              <div
                key={key}
                ref={(el) => measureElement(actualIndex, el)}
                data-index={actualIndex}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualScroller;
