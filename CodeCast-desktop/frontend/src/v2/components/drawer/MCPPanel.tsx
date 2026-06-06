import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';

export function MCPPanel() {
  useError('mcp');
  const { servers, loading, refreshMCP, toggle } = useAppStore();

  return (
    <div style={{ padding: 8, fontSize: 12 }}>
      <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--c-text)' }}>
        MCP Servers {loading && <span style={{ color: 'var(--c-textMute)', fontWeight: 400 }}>(loading…)</span>}
      </div>
      {servers.length === 0 && !loading ? (
        <div style={{ color: 'var(--c-textMute)' }}>
          No servers detected
          <button
            onClick={refreshMCP}
            style={{
              display: 'block', marginTop: 6, padding: '3px 8px',
              background: 'var(--c-surface-hover)', border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)', color: 'var(--c-textSub)', fontSize: 11, cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {servers.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 6px', background: 'var(--c-bgSub)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: s.connected ? 'var(--c-success, #4caf50)' : 'var(--c-textMute)',
                flexShrink: 0,
              }} />
              <span style={{ flex: 1, color: 'var(--c-text)', fontFamily: 'var(--font-mono)' }}>{s.name}</span>
              <button
                onClick={() => toggle(s.id, !s.connected)}
                style={{
                  padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                  background: s.connected ? 'transparent' : 'var(--c-accent)',
                  color: s.connected ? 'var(--c-textSub)' : '#fff',
                  border: s.connected ? '1px solid var(--c-border)' : 'none',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                {s.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
          {servers.some((s) => s.error) && (
            <div style={{ marginTop: 4, color: 'var(--c-danger, #e53935)', fontSize: 11 }}>
              {servers.filter((s) => s.error).map((s) => (
                <div key={s.id}>{s.name}: {s.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
