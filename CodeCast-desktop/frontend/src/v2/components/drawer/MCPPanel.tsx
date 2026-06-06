import { useError } from '../../lib/useError';

export function MCPPanel() {
  useError('mcp');
  return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
    <div style={{ marginBottom: 4, fontWeight: 500 }}>MCP Servers</div>
    <div>No servers connected</div>
  </div>;
}
