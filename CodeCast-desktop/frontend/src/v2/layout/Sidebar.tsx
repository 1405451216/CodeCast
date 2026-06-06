import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore, type AppMode } from '../store';
import { useError } from '../lib/useError';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  onClick?: () => void;
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
  const navigate = useNavigate();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    projects: true,
    scheduled: true,
    artifacts: false,
    custom: true,
    recent: true,
    sessions: true,
  });

  const groups: NavGroup[] =
    mode === 'cast'
      ? [
          {
            id: 'new',
            label: '',
            items: [{ id: 'new', label: '新建任务', icon: I.plus }],
          },
          {
            id: 'projects',
            label: '项目',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'p-codecast', label: 'CodeCast', icon: I.folder, active: activeId === 'p-codecast' },
              { id: 'p-blog', label: 'blog-site', icon: I.folder, active: activeId === 'p-blog' },
              { id: 'p-iot', label: 'iot-fleet', icon: I.folder, active: activeId === 'p-iot' },
            ],
          },
          {
            id: 'scheduled',
            label: '计划任务',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 's-standup', label: '每日站会简报', icon: I.schedule, badge: '8:00' },
              { id: 's-weekly', label: '周报汇总', icon: I.schedule, badge: '周五' },
            ],
          },
          {
            id: 'artifacts',
            label: '实时 Artifacts',
            collapsible: true,
            items: [
              { id: 'a-1', label: '2026Q2 OKR', icon: I.artifact },
              { id: 'a-2', label: 'API 设计草案', icon: I.artifact },
            ],
          },
          {
            id: 'custom',
            label: '自定义',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'c-writing', label: '写作助手', icon: I.custom, onClick: () => navigate('/cast/writing') },
              { id: 'c-translation', label: '中英互译', icon: I.custom, onClick: () => navigate('/cast/translation') },
              { id: 'c-knowledge', label: '知识库', icon: I.custom, onClick: () => navigate('/cast/knowledge') },
              { id: 'c-schedule', label: '日程', icon: I.custom, onClick: () => navigate('/cast/schedule') },
              { id: 'c-email', label: '邮件草稿', icon: I.custom, onClick: () => navigate('/cast/email') },
              { id: 'c-tools', label: '工具箱', icon: I.custom, onClick: () => navigate('/cast/tools') },
            ],
          },
          {
            id: 'recent',
            label: '最近使用',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'r-1', label: '修复 Vite 启动问题', icon: I.recent },
              { id: 'r-2', label: '重构 WorkspaceFrame', icon: I.recent },
              { id: 'r-3', label: '添加 Cast 工作流', icon: I.recent },
            ],
          },
        ]
      : [
          {
            id: 'new',
            label: '',
            items: [{ id: 'new-session', label: '新会话', icon: I.plus }],
          },
          {
            id: 'custom',
            label: '自定义',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'c-review', label: '代码审查', icon: I.custom },
              { id: 'c-test', label: '生成测试', icon: I.custom },
              { id: 'c-refactor', label: '智能重构', icon: I.custom },
              { id: 'c-commit', label: '提交信息', icon: I.custom },
            ],
          },
          {
            id: 'recent',
            label: '最近使用',
            collapsible: true,
            defaultOpen: true,
            items: [
              { id: 'r-1', label: 'SD session', icon: I.recent, active: activeId === 'r-1' },
              { id: 'r-2', label: 'Auth module', icon: I.recent },
              { id: 'r-3', label: 'Wails 绑定', icon: I.recent },
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
      <ModeSwitcher mode={mode} onChange={setMode} />
      {groups.map((g) => (
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
    </nav>
  );
}

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
        width: 28,
        height: 28,
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
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {group.items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onItem(item)}
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
