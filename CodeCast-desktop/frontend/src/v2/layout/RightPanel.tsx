import { useState } from 'react';
import { useAppStore } from '../store';
import type { AgentInfo } from '../wails/types';
import { AgentEventLog } from '../components/agent/AgentEventLog';

const I = {
  chevron: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m4 3 2 3-2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m2.5 6.5 2 2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  progress: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3h2.59c.46 0 .9.18 1.22.5L8 4.18c.32.32.76.5 1.22.5h3.28c.83 0 1.5.67 1.5 1.5v6.32c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  context: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6h12M5 9h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  collapse: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m4 3-2 3 2 3M8 3l2 3-2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface Step {
  id: string;
  label: string;
  done: boolean;
  active?: boolean;
}

/**
 * Claude Code 风格右侧浮动面板
 *  - 默认折叠（仅显示切换按钮）
 *  - 展开后：进度 / 工作文件夹 / 上下文
 */
export function RightPanel() {
  const [open, setOpen] = useState(false);
  const currentProject = useAppStore((s) => s.currentProject);
  const agents = useAppStore((s) => s.agents) as AgentInfo[] | undefined;
  const currentModel = useAppStore((s) => s.current);
  const configs = useAppStore((s) => s.configs);
  // metricsSnap is set via onMetricsSnapshot event in App.tsx
  const metricsSnap = useAppStore((s) => s.metricsSnap);

  // Derive context window size from current model config
  const activeConfig = configs?.find((c) => c.model === currentModel);
  const maxContext = activeConfig?.maxContext ?? 200_000;
  const maxContextDisplay = maxContext >= 1000 ? `${(maxContext / 1000).toFixed(0)}k` : String(maxContext);

  // Derive progress steps from agent list
  const steps: Step[] = (agents ?? []).map((a, i) => ({
    id: a.id,
    label: a.title || `Agent ${i + 1}`,
    done: a.status === 'completed' || a.status === 'done',
    active: a.status === 'running' || a.status === 'active',
  }));

  // Compute total tokens from metrics snapshot
  const totalTokens = metricsSnap
    ? Object.values(metricsSnap.tokenUsageByModel || {}).reduce((sum, m) => sum + m.totalTokens, 0)
    : 0;
  const tokenDisplay = totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens);
  const workDir = currentProject?.path ?? '~/';


  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="打开进度 / 工作文件夹 / 上下文"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--c-textSub)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 5,
          transition: 'all var(--dur-fast) var(--ease)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface-hover)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-textSub)'; }}
      >
        {I.collapse}
      </button>
    );
  }

  return (
    <aside
      style={{
        position: 'relative',
        width: 'var(--right-panel-w)',
        minWidth: 'var(--right-panel-w)',
        maxWidth: 'var(--right-panel-w)',
        background: 'var(--c-surface)',
        borderLeft: '1px solid var(--c-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        animation: 'slideInRight var(--dur-base) var(--ease)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          borderBottom: '1px solid var(--c-divider)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--c-textSub)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)' }}>context/</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setOpen(false)}
          aria-label="折叠面板"
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            color: 'var(--c-textMute)',
            cursor: 'pointer',
            transform: 'rotate(180deg)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {I.collapse}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Section icon={I.progress} title="进度" defaultOpen>
          {steps.length > 0 ? (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12 }}>
            {steps.map((s) => (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 0',
                  color: s.done ? 'var(--c-textSub)' : 'var(--c-textMute)',
                  textDecoration: s.done ? 'line-through' : 'none',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    width: 14,
                    height: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: s.done ? 'var(--c-success)' : 'transparent',
                    color: '#fff',
                    border: s.done ? 'none' : '1px solid var(--c-borderStrong)',
                  }}
                >
                  {s.done && I.check}
                </span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {s.active && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--c-accent)',
                      animation: 'pulse 1.2s ease-in-out infinite',
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--c-textMute)', padding: '4px 0' }}>No active agents</div>
          )}
        </Section>

        <AgentEventLog />

        <Section icon={I.folder} title="工作文件夹">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--c-textSub)',
              padding: 4,
              background: 'var(--c-bgSub)',
              borderRadius: 'var(--r-sm)',
              wordBreak: 'break-all',
            }}
          >
            {workDir}
          </div>
        </Section>

        <Section icon={I.context} title="上下文">
          <div style={{ fontSize: 12, color: 'var(--c-textSub)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>已用 token</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{totalTokens > 0 ? `~ ${tokenDisplay}` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>窗口</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{maxContextDisplay}</span>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                background: 'var(--c-bgSub)',
                borderRadius: 'var(--r-pill)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: `${Math.min(100, (totalTokens / maxContext) * 100).toFixed(1)}%`,
                height: '100%',
                background: totalTokens / maxContext > 0.85 ? 'var(--c-danger, #e74c3c)' : totalTokens / maxContext > 0.6 ? 'var(--c-warn, #f39c12)' : 'var(--c-accent)',
                transition: 'background 0.3s ease',
              }} />
            </div>
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  icon, title, children, defaultOpen = true,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--c-divider)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          color: 'var(--c-text)',
          fontSize: 12,
          fontWeight: 500,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            color: 'var(--c-textSub)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform var(--dur-fast) var(--ease)',
          }}
        >
          {I.chevron}
        </span>
        <span style={{ display: 'inline-flex', color: 'var(--c-textSub)' }}>{icon}</span>
        <span>{title}</span>
      </button>
      {open && <div style={{ padding: '0 12px 12px 30px' }}>{children}</div>}
    </div>
  );
}
