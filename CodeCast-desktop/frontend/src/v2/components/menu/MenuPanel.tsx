import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export type MenuItem =
  | { kind: 'action'; id: string; label: string; shortcut?: string; disabled?: boolean; onClick?: () => void }
  | { kind: 'submenu'; id: string; label: string; children: MenuItem[] }
  | { kind: 'separator'; id: string };

interface MenuPanelProps {
  items: MenuItem[];
  anchor: { x: number; y: number };
  align?: 'right' | 'left' | 'below';
  onClose: () => void;
  onItemClick: (item: MenuItem) => void;
  level?: number;
}


/**
 * 渲染一个浮动菜单元件（可嵌套）
 * - 默认根据 anchor 决定位置
 * - 鼠标悬停带 100ms 延迟（防抖）
 * - 离开 150ms 延迟关闭（让鼠标能移入子菜单）
 */
export function MenuPanel({
  items, anchor, align = 'right', onClose, onItemClick, level = 0,
}: MenuPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; openLeft: boolean }>(() =>
    computePos(anchor, align, null)
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [submenuFor, setSubmenuFor] = useState<{ item: Extract<MenuItem, { kind: 'submenu' }>; anchor: { x: number; y: number } } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { left, top } = pos;
    let openLeft = false;
    if (left + rect.width > vw - 8) {
      left = Math.max(8, anchor.x - rect.width);
      openLeft = true;
    }
    if (top + rect.height > vh - 8) {
      top = Math.max(8, vh - rect.height - 8);
    }
    setPos({ left, top, openLeft });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      // 检查点击是否在任意菜单面板内（包括子菜单），避免误关闭
      const inAnyPanel = document.querySelector('.cc-menu-panel')?.contains(e.target as Node);
      if (!inAnyPanel) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeIdx != null) {
          const it = items[activeIdx];
          handleItemClick(it);
        }
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activeIdx != null) {
          const it = items[activeIdx];
          if (it.kind === 'submenu') openSubmenu(it);
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, items, onClose]);

  function moveActive(dir: 1 | -1) {
    if (activeIdx == null) { setActiveIdx(0); return; }
    let i = activeIdx;
    for (let k = 0; k < items.length; k++) {
      i = (i + dir + items.length) % items.length;
      if (items[i].kind !== 'separator') { setActiveIdx(i); return; }
    }
  }

  function openSubmenu(item: Extract<MenuItem, { kind: 'submenu' }>) {
    if (openTimer.current) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    const target = ref.current?.querySelector<HTMLElement>(`[data-menuitem="${item.id}"]`);
    if (!target) return;
    const r = target.getBoundingClientRect();
    setSubmenuFor({ item, anchor: { x: pos.openLeft ? r.left : r.right, y: r.top } });
  }

  function scheduleOpenSubmenu(item: Extract<MenuItem, { kind: 'submenu' }>) {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => openSubmenu(item), 100);
  }

  function scheduleClose() {
    if (openTimer.current) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setSubmenuFor(null), 180);
  }

  function handleItemClick(item: MenuItem) {
    if (item.kind === 'separator') return;
    if (item.kind === 'action' && item.disabled) return;
    if (item.kind === 'submenu') {
      openSubmenu(item);
      return;
    }
    onItemClick(item);
  }

  return (
    <>
      <div
        ref={ref}
        className="cc-menu-panel"
        role="menu"
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          minWidth: 200,
          padding: 4,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-pop)',
          fontSize: 13,
          color: 'var(--c-text)',
          zIndex: 1000 + level,
          animation: 'menuIn var(--dur-fast) var(--ease)',
        }}
        onMouseLeave={scheduleClose}
      >
        {items.map((it, idx) => {
          if (it.kind === 'separator') {
            return (
              <div
                key={it.id}
                style={{
                  height: 1,
                  margin: '4px 6px',
                  background: 'var(--c-divider)',
                }}
              />
            );
          }
          const active = activeIdx === idx;
          return (
            <button
              key={it.id}
              data-menuitem={it.id}
              role="menuitem"
              disabled={it.kind === 'action' && it.disabled}
              onMouseEnter={() => {
                setActiveIdx(idx);
                if (it.kind === 'submenu') scheduleOpenSubmenu(it);
                else scheduleClose();
              }}
              onClick={() => handleItemClick(it)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '5px 10px 5px 10px',
                background: active ? 'var(--c-accentSoft)' : 'transparent',
                color: it.kind === 'action' && it.disabled ? 'var(--c-textMute)' : 'var(--c-text)',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                fontSize: 13,
                textAlign: 'left',
                cursor: it.kind === 'action' && it.disabled ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
              {it.kind === 'action' && it.shortcut && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--c-textMute)',
                    fontFamily: 'var(--font-mono)',
                    marginLeft: 24,
                  }}
                >
                  {it.shortcut}
                </span>
              )}
              {it.kind === 'submenu' && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ color: 'var(--c-textMute)', flexShrink: 0 }}>
                  <path d="m3 1 3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {submenuFor && (
        <MenuPanel
          items={submenuFor.item.children}
          anchor={submenuFor.anchor}
          align={pos.openLeft ? 'left' : 'right'}
          onClose={() => { setSubmenuFor(null); if (closeTimer.current) window.clearTimeout(closeTimer.current); }}
          onItemClick={onItemClick}
          level={level + 1}
        />
      )}
    </>
  );
}

function computePos(anchor: { x: number; y: number }, align: string, _measured: DOMRect | null) {
  if (align === 'below') return { left: anchor.x, top: anchor.y, openLeft: false };
  return { left: anchor.x, top: anchor.y, openLeft: false };
}

/* ---------- 触发器：菜单按钮 ---------- */

interface MenuTriggerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: MenuItem[];
  children: ReactNode;
  onItemClick: (item: MenuItem) => void;
}

export function MenuTrigger({ open, onOpen, onClose, items, children, onItemClick }: MenuTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setAnchor({ x: r.left, y: r.bottom + 4 });
    }
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onClick={() => (open ? onClose() : onOpen())} style={{ display: 'inline-flex' }}>
        {children}
      </div>
      {open && anchor && (
        <MenuPanel items={items} anchor={anchor} align="below" onClose={onClose} onItemClick={(it) => { onItemClick(it); onClose(); }} />
      )}
    </>
  );
}
