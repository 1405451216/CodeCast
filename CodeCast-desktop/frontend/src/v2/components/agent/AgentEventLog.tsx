// frontend/src/v2/components/agent/AgentEventLog.tsx
//
// Renders the in-memory Agent event log kept by agentSlice. Events are
// stamped by the Wails event bridge in App.tsx and accumulated with an
// LRU cap (see agentSlice.EVENT_LOG_CAPACITY).

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { useI18n } from '../../lib/useI18n';
import type { AgentEventLogEntry } from '../../store/slices/agentSlice';

const LABEL: Record<AgentEventLogEntry['_type'], string> = {
  'agent:start': 'started',
  'agent:stop': 'stopped',
  'agent:error': 'error',
  'agent:turn': `turn`,
  'agent:turn_end': 'turn done',
  'agent:tool': `tool`,
  'agent:tool_result': 'tool done',
};

const COLOR: Record<AgentEventLogEntry['_type'], string> = {
  'agent:start': 'var(--c-success)',
  'agent:stop': 'var(--c-textMute)',
  'agent:error': 'var(--c-danger)',
  'agent:turn': 'var(--c-accent)',
  'agent:turn_end': 'var(--c-textSub)',
  'agent:tool': 'var(--c-accentText)',
  'agent:tool_result': 'var(--c-textSub)',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export function AgentEventLog() {
  const t = useI18n();
  const log = useAppStore((s) => s.agentEventLog);
  const clear = useAppStore((s) => s.clearAgentEventLog);
  const [open, setOpen] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest on append.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div style={{ borderBottom: '1px solid var(--c-divider)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--c-textSub)',
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--c-text)',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
            cursor: 'pointer',
            flex: 1,
            textAlign: 'left',
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="m4 3 2 3-2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {t.agentEventLog.title}
          <span style={{ color: 'var(--c-textMute)', fontWeight: 400, marginLeft: 4 }}>
            ({log.length})
          </span>
        </button>
        {log.length > 0 && (
          <button
            onClick={clear}
            title={t.agentEventLog.clearTitle}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--c-textMute)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            {t.agentEventLog.clear}
          </button>
        )}
      </div>
      {open && (
        <div
          ref={scrollerRef}
          style={{
            padding: '0 12px 12px 30px',
            maxHeight: 220,
            overflowY: 'auto',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--c-textSub)',
            lineHeight: 1.6,
          }}
        >
          {log.length === 0 ? (
            <div style={{ color: 'var(--c-textMute)' }}>{t.agentEventLog.noEvents}</div>
          ) : (
            log.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ color: 'var(--c-textMute)' }}>{fmtTime(e._ts)}</span>
                <span style={{ color: COLOR[e._type] }}>{LABEL[e._type]}</span>
                {e.agentID && (
                  <span style={{ color: 'var(--c-textMute)' }}>
                    · {e.agentID.slice(0, 6)}
                  </span>
                )}
                {e.toolName && (
                  <span style={{ color: 'var(--c-text)' }}>{e.toolName}</span>
                )}
                {e.turn !== undefined && (
                  <span style={{ color: 'var(--c-textMute)' }}>#{e.turn}</span>
                )}
                {e.error && (
                  <span style={{ color: 'var(--c-danger)' }} title={e.error}>
                    {e.error.length > 30 ? `${e.error.slice(0, 30)}…` : e.error}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
