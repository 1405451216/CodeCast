import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useAppStore, type AppMode } from '../store';
import { useError } from '../lib/useError';
import { useI18n } from '../lib/useI18n';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  onClick?: () => void;
  onContext?: (e: React.MouseEvent) => void;
  active?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const I = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  sparkle: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 9.4 6l4.6 1.4-4.6 1.4L8 13.4 6.6 8.8 2 7.4 6.6 6 8 1.5Z" fill="currentColor" />
    </svg>
  ),
  cost: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.5v1M8 10.5v1M5.5 8h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  code: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="m5 5-3 3 3 3M11 5l3 3-3 3M9.5 4l-3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3h2.59c.46 0 .9.18 1.22.5L8 4.18c.32.32.76.5 1.22.5h3.28c.83 0 1.5.67 1.5 1.5v6.32c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  schedule: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  artifact: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5h7l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10 2.5v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  custom: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="m8 2 1.8 3.7 4.2.6-3 3 .7 4.2L8 11.5l-3.7 2 .7-4.2-3-3 4.2-.6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  recent: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  chat: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3h9c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H6.5L3.5 14v-2H3.5C2.67 12 2 11.33 2 10.5v-6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  pen: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M11 2l3 3-9 9H2v-3l9-9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  globe: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 8h12M8 2c2 2 3 4 3 6s-1 4-3 6M8 2c-2 2-3 4-3 6s1 4 3 6" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  book: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h4.5c.83 0 1.5.67 1.5 1.5V13L6.5 12H2V3ZM14 3H9.5C8.67 3 8 3.67 8 4.5V13l1.5-1H14V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  envelope: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 5.5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  wrench: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M10.5 2.5a3.5 3.5 0 0 0-4.95 4.95l-5 5a2 2 0 1 0 2.83 2.83l5-5A3.5 3.5 0 0 0 10.5 2.5Z" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  puzzle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h3v2h2V2h3v3h2v3h-2v2h2v3H2V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  chevron: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="m3 4 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface Props {
  activeId?: string;
  onSelect?: (id: string) => void;
}

export function Sidebar({ activeId, onSelect }: Props) {
  useError('session'); useError('project');
  const t = useI18n();
  const navigate = useNavigate();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const sessions = useAppStore((s) => s.sessions);
  const projects = useAppStore((s) => s.projects);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const switchSession = useAppStore((s) => s.switchSession);
  const createSession = useAppStore((s) => s.createSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const renameSession = useAppStore((s) => s.renameSession);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  // Draft protection state
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  const handleRenameSession = useCallback((id: string, currentName: string) => {
    setCtxMenu(null);
    const newName = window.prompt(t.sidebar.rename + ':', currentName);
    if (newName && newName.trim() && newName !== currentName) {
      renameSession(id, newName.trim());
    }
  }, [renameSession]);

  const handleDeleteSession = useCallback((id: string, name: string) => {
    setCtxMenu(null);
    if (window.confirm(t.sidebar.deleteConfirm(name))) {
      deleteSession(id);
      if (id === useAppStore.getState().currentSessionId) {
        navigate('/');
      }
    }
  }, [deleteSession, navigate]);

  const handleExportSession = useCallback((id: string, name: string) => {
    setCtxMenu(null);
    try {
      const session = sessions.find((s: any) => s.id === id);
      const data = JSON.stringify(session, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'session'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, [sessions]);

  const handleSessionContext = useCallback((e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, name });
  }, []);

  const doSessionSwitch = useCallback((id: string) => {
    // Check for unsent text in composer
    const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-testid="composer-input"]');
    if (ta && ta.value.trim()) {
      // Show confirm dialog
      setPendingSwitch(id);
      return;
    }
    switchSession(id);
    navigate('/');
    onSelect?.(id);
  }, [switchSession, navigate, onSelect]);

  const handleSessionSelect = useCallback((id: string) => {
    doSessionSwitch(id);
  }, [doSessionSwitch]);

  const confirmSwitchSave = useCallback(() => {
    if (!pendingSwitch) return;
    // Save draft for current session
    const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-testid="composer-input"]');
    const currentId = useAppStore.getState().currentSessionId;
    if (ta && ta.value.trim() && currentId) {
      try { sessionStorage.setItem(`codecast-composer-draft:${currentId}`, ta.value); } catch { /* ignore */ }
    }
    switchSession(pendingSwitch);
    navigate('/');
    onSelect?.(pendingSwitch);
    setPendingSwitch(null);
  }, [pendingSwitch, switchSession, navigate, onSelect]);

  const confirmSwitchDiscard = useCallback(() => {
    if (!pendingSwitch) return;
    switchSession(pendingSwitch);
    navigate('/');
    onSelect?.(pendingSwitch);
    setPendingSwitch(null);
  }, [pendingSwitch, switchSession, navigate, onSelect]);

  const handleCreateSession = useCallback(async () => {
    await createSession('New Session', '', mode === 'cast' ? 'daily' : 'coding');
    navigate('/');
  }, [createSession, mode, navigate]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('codecast-sidebar-groups');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      projects: true,
      scheduled: true,
      artifacts: false,
      custom: true,
      recent: true,
      sessions: true,
    };
  });

  // Persist group state on change
  useEffect(() => {
    try { localStorage.setItem('codecast-sidebar-groups', JSON.stringify(openGroups)); } catch { /* ignore */ }
  }, [openGroups]);

  const modeMatch = mode === 'cast' ? 'daily' : 'coding';
  const [showAllSessions, setShowAllSessions] = useState(false);
  const allMatchingSessions = sessions.filter((s) => {
    const sMode = s.mode || 'daily';
    return sMode === modeMatch && s.messages && s.messages.length > 0;
  });
  const recentSessions = showAllSessions ? allMatchingSessions : allMatchingSessions.slice(0, 8);
  const hiddenCount = allMatchingSessions.length - 8;

  const groups: NavGroup[] =
    mode === 'cast'
      ? [
          {
            id: 'new',
            label: '',
            items: [{ id: 'new', label: t.sidebar.newTask, icon: I.plus, onClick: handleCreateSession }],
          },
          {
            id: 'projects',
            label: t.sidebar.projects,
            collapsible: true,
            defaultOpen: true,
            items: projects.map((p) => ({
              id: p.id,
              label: p.name || p.path.split('/').pop() || p.path,
              icon: I.folder,
              active: activeId === p.id,
            })),
          },
          {
            id: 'scheduled',
            label: t.sidebar.scheduled,
            collapsible: true,
            defaultOpen: true,
            items: [],
          },
          {
            id: 'artifacts',
            label: t.sidebar.artifacts,
            collapsible: true,
            items: [],
          },
          {
            id: 'custom',
            label: t.sidebar.custom,
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'c-writing', label: t.cast.writing, icon: I.pen, onClick: () => navigate('/cast/writing') },
              { id: 'c-translation', label: t.cast.translation, icon: I.globe, onClick: () => navigate('/cast/translation') },
              { id: 'c-knowledge', label: t.cast.knowledge, icon: I.book, onClick: () => navigate('/cast/knowledge') },
              { id: 'c-schedule', label: t.cast.schedule, icon: I.calendar, onClick: () => navigate('/cast/schedule') },
              { id: 'c-email', label: t.sidebar.emailDraft, icon: I.envelope, onClick: () => navigate('/cast/email') },
              { id: 'c-tools', label: t.sidebar.toolbox, icon: I.wrench, onClick: () => navigate('/cast/tools') },
              { id: 'c-cost', label: 'Cost', icon: I.cost, onClick: () => navigate('/cost') },
              { id: 'c-plugins', label: 'Plugins', icon: I.puzzle, onClick: () => navigate('/plugins') },
            ],
          },
          {
            id: 'recent',
            label: t.sidebar.recent,
            collapsible: true,
            defaultOpen: true,
            items: [
              ...recentSessions.map((s) => ({
                id: s.id,
                label: s.name || 'Untitled',
                icon: I.chat,
                active: currentSessionId === s.id,
                onClick: () => handleSessionSelect(s.id),
                onContext: (e: React.MouseEvent) => handleSessionContext(e, s.id, s.name || 'Untitled'),
              })),
              ...(hiddenCount > 0 && !showAllSessions ? [{
                id: 'show-all',
                label: t.sidebar.showAll(allMatchingSessions.length),
                icon: I.recent,
                onClick: () => setShowAllSessions(true),
              }] : []),
            ],
          },
        ]
      : [
          {
            id: 'new',
            label: '',
            items: [{ id: 'new-session', label: t.sidebar.newSession, icon: I.plus, onClick: handleCreateSession }],
          },
          {
            id: 'custom',
            label: t.sidebar.custom,
            collapsible: true,
            defaultOpen: true,
            items: [
              {
                id: 'c-review', label: 'Code Review', icon: I.custom,
                onClick: () => { navigate('/cast/tools?mode=review'); },
              },
              {
                id: 'c-test', label: 'Generate Tests', icon: I.custom,
                onClick: () => { navigate('/cast/tools?mode=test'); },
              },
              {
                id: 'c-refactor', label: 'Refactor', icon: I.custom,
                onClick: () => { navigate('/cast/tools?mode=refactor'); },
              },
              {
                id: 'c-commit', label: 'Commit Message', icon: I.custom,
                onClick: () => { navigate('/cast/tools?mode=commit'); },
              },
            ],
          },
          {
            id: 'recent',
            label: t.sidebar.recent,
            collapsible: true,
            defaultOpen: true,
            items: [
              ...recentSessions.map((s) => ({
                id: s.id,
                label: s.name || 'Untitled',
                icon: I.chat,
                active: currentSessionId === s.id,
                onClick: () => handleSessionSelect(s.id),
                onContext: (e: React.MouseEvent) => handleSessionContext(e, s.id, s.name || 'Untitled'),
              })),
              ...(hiddenCount > 0 && !showAllSessions ? [{
                id: 'show-all',
                label: t.sidebar.showAll(allMatchingSessions.length),
                icon: I.recent,
                onClick: () => setShowAllSessions(true),
              }] : []),
            ],
          },
        ];

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '8px 0',
        fontSize: 13,
        color: 'var(--c-text)',
        overflow: 'auto',
      }}
    >
      <ModeSwitcher mode={mode} onChange={(m) => { setMode(m); navigate('/'); }} />
      {groups.filter(g => g.items.length > 0 || g.id === 'new').map((g) => (
        <SidebarGroup
          key={g.id}
          group={g}
          open={openGroups[g.id] ?? g.defaultOpen ?? true}
          onToggle={() => g.collapsible && setOpenGroups((s) => ({ ...s, [g.id]: !(s[g.id] ?? g.defaultOpen ?? true) }))}
          onItem={(item) => {
            item.onClick?.();
            onSelect?.(item.id);
          }}
        />
      ))}
      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-pop)',
            padding: '4px',
            zIndex: 100,
            minWidth: 160,
          }}
        >
          <button onClick={() => handleRenameSession(ctxMenu.id, ctxMenu.name)} style={ctxMenuItemStyle}>
            {t.sidebar.rename}
          </button>
          <button onClick={() => handleExportSession(ctxMenu.id, ctxMenu.name)} style={ctxMenuItemStyle}>
            {t.sidebar.exportSession}
          </button>
          <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 0' }} />
          <button onClick={() => handleDeleteSession(ctxMenu.id, ctxMenu.name)} style={{ ...ctxMenuItemStyle, color: 'var(--c-danger)' }}>
            {t.sidebar.delete}
          </button>
        </div>
      )}
      {/* Draft protection confirm */}
      {pendingSwitch && (
        <ConfirmDialog
          open
          title={t.sidebar.unsentMessage}
          message={t.sidebar.unsentMessageConfirm}
          confirmLabel={t.sidebar.saveDraft}
          cancelLabel={t.sidebar.discard}
          onConfirm={confirmSwitchSave}
          onCancel={confirmSwitchDiscard}
        />
      )}
    </nav>
  );
}

const ctxMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  fontSize: 13,
  color: 'var(--c-text)',
  textAlign: 'left',
  cursor: 'pointer',
};

/**
 * 顶部模式切换器：✱ Cast | </> Code
 * - 当前模式为大圆角 chip（更宽 + 名称 + 强调色）
 * - 另一个为小方块 icon 按钮（点击切换）
 */
function ModeSwitcher({ mode, onChange }: { mode: AppMode; onChange: (m: AppMode) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px 12px',
      }}
    >
      {/* Cast */}
      <ModeChip
        active={mode === 'cast'}
        onClick={() => onChange('cast')}
        icon={I.sparkle}
        label="Cast"
        variant="cast"
      />
      {/* Code */}
      <ModeChip
        active={mode === 'code'}
        onClick={() => onChange('code')}
        icon={I.code}
        label="Code"
        variant="code"
      />
    </div>
  );
}

function ModeChip({
  active, onClick, icon, label, variant,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'cast' | 'code';
}) {
  if (active) {
    return (
      <button
        onClick={onClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--c-text)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all var(--dur-fast) var(--ease)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span style={{ display: 'inline-flex', color: variant === 'cast' ? 'var(--c-accent)' : 'var(--c-textSub)' }}>
          {icon}
        </span>
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--r-md)',
        color: 'var(--c-textMute)',
        cursor: 'pointer',
        transition: 'all var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--c-surface-hover)';
        e.currentTarget.style.color = 'var(--c-text)';
        e.currentTarget.style.borderColor = 'var(--c-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--c-textMute)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

function SidebarGroup({
  group,
  open,
  onToggle,
  onItem,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  onItem: (item: NavItem) => void;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      {group.label && (
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            padding: '6px 12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--c-textMute)',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform var(--dur-fast) var(--ease)',
              display: 'inline-flex',
            }}
          >
            {I.chevron}
          </span>
          {group.label}
        </button>
      )}
      {open && group.items.length > 20 && (
        <Virtuoso
          style={{ height: Math.min(group.items.length * 36, 300) }}
          totalCount={group.items.length}
          itemContent={(idx) => {
            const item = group.items[idx];
            return (
              <button
                onClick={() => onItem(item)}
                onContextMenu={item.onContext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 12px 6px 22px',
                  background: item.active ? 'var(--c-accentSoft)' : 'transparent',
                  color: item.active ? 'var(--c-accentText)' : 'var(--c-text)',
                  border: 'none',
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--r-sm)',
                  fontFamily: 'inherit',
                  transition: 'background var(--dur-fast) var(--ease)',
                }}
                onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
                onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'inline-flex', color: item.active ? 'var(--c-accent)' : 'var(--c-textMute)', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.badge && <span style={{ fontSize: 10, color: 'var(--c-accent)', fontWeight: 600 }}>{item.badge}</span>}
              </button>
            );
          }}
        />
      )}
      {open && group.items.length <= 20 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {group.items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onItem(item)}
                onContextMenu={item.onContext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 12px 6px 22px',
                  background: item.active ? 'var(--c-accentSoft)' : 'transparent',
                  color: item.active ? 'var(--c-accentText)' : 'var(--c-text)',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background var(--dur-fast) var(--ease)',
                }}
                onMouseEnter={(e) => {
                  if (!item.active) e.currentTarget.style.background = 'var(--c-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!item.active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.active && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 4,
                      bottom: 4,
                      width: 2,
                      background: 'var(--c-accent)',
                      borderRadius: 2,
                    }}
                  />
                )}
                <span style={{ display: 'inline-flex', color: 'var(--c-textMute)' }}>{item.icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--c-textMute)',
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--c-bgSub)',
                      padding: '1px 5px',
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
