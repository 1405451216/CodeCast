// frontend/src/v2/pages/PluginsPage.tsx
//
// Lists loaded plugins and lets the user load a new one from a path
// (via Files.selectFolder or manual entry) and unload existing ones.
// Mirrors the cost / settings page styles.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { TopBar } from '../layout/TopBar';
import { Files } from '../wails/adapter';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';

function PluginPageFallback({ error }: { error: Error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => window.location.reload()} backLabel="插件" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', color: 'var(--c-textSub)', fontSize: 13 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', marginBottom: 8 }}>页面加载出错</div>
          <div style={{ marginBottom: 12 }}>{error.message}</div>
          <button onClick={() => window.location.reload()} style={{ padding: '6px 16px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}

class PluginErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err }; }
  render() { return this.state.error ? <PluginPageFallback error={this.state.error} /> : this.props.children; }
}

export function PluginsPage() {
  const navigate = useNavigate();
  const {
    plugins,
    pluginStatus,
    pluginLoading,
    refreshPlugins,
    refreshPluginStatus,
    loadPlugin,
    unloadPlugin,
  } = useAppStore();

  const [path, setPath] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmUnload, setConfirmUnload] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlugins = plugins.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    void refreshPlugins();
    void refreshPluginStatus();
  }, [refreshPlugins, refreshPluginStatus]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const p = await Files.selectFolder();
      if (p) setPath(p);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleLoad = useCallback(async () => {
    if (!path.trim()) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await loadPlugin(path.trim());
      setPath('');
      setSuccessMsg('插件加载成功');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, [path, loadPlugin]);

  const handleUnload = useCallback(async (id: string) => {
    setConfirmUnload(id);
  }, []);

  const doUnload = useCallback(async () => {
    if (!confirmUnload) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await unloadPlugin(confirmUnload);
      setSuccessMsg('插件已卸载');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmUnload(null);
    }
  }, [confirmUnload, unloadPlugin]);

  return (
    <PluginErrorBoundary>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel="插件" />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 32px', minHeight: 0, overscrollBehavior: 'contain' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Status section */}
          <section>
            <h2 style={S.h2}>运行时状态</h2>
            <div style={S.card}>
              <Row label="已加载插件" value={String(pluginStatus?.loadedPlugins ?? plugins.length)} />
              <Row label="插件总量" value={String(plugins.length)} mono />
            </div>
          </section>

          {/* Load new plugin */}
          <section>
            <h2 style={S.h2}>加载新插件</h2>
            <div style={S.card}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--c-divider)' }}>
                <label htmlFor="plugin-path" style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                  插件路径
                </label>
                <input
                  id="plugin-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/plugin"
                  style={{ ...S.input, flex: 1, minWidth: 200 }}
                />
                <button onClick={() => void handleSelectFolder()} style={S.secondaryBtn}>
                  浏览
                </button>
                <button
                  onClick={() => void handleLoad()}
                  style={S.primaryBtn}
                  disabled={!path.trim() || pluginLoading}
                >
                  加载
                </button>
              </div>
              {actionError && (
                <div style={{ padding: '12px 16px', color: 'var(--c-danger)', fontSize: 12 }}>
                  {actionError}
                </div>
              )}
              {successMsg && (
                <div style={{ padding: '12px 16px', color: 'var(--c-success, #52c41a)', fontSize: 12 }}>
                  {successMsg}
                </div>
              )}
            </div>
          </section>

          {/* Loaded list */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
              <h2 style={S.h2}>已加载</h2>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索插件…"
                style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none', width: 180 }}
              />
            </div>
            <div style={S.card}>
              {pluginLoading && plugins.length === 0 ? (
                <div style={S.empty}>加载中…</div>
              ) : filteredPlugins.length === 0 ? (
                <div style={S.empty}>{searchQuery ? '无匹配插件' : '暂无插件'}</div>
              ) : (
                filteredPlugins.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      borderTop: '1px solid var(--c-divider)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 500 }}>{p.name}</div>
                        <span style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 'var(--r-pill)',
                          background: p.loaded ? 'var(--c-success, #4caf50)' : 'var(--c-border)',
                          color: p.loaded ? '#fff' : 'var(--c-textMute)',
                        }}>
                          {p.loaded ? '已加载' : '未加载'}
                        </span>
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 12, color: 'var(--c-textSub)', marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        {p.version && (
                          <span style={{ fontSize: 11, color: 'var(--c-textMute)', fontFamily: 'var(--font-mono)' }}>v{p.version}</span>
                        )}
                        {p.author && (
                          <span style={{ fontSize: 11, color: 'var(--c-textMute)' }}>by {p.author}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleUnload(p.id)}
                      style={S.secondaryBtn}
                    >
                      卸载
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
      <ConfirmDialog
        open={confirmUnload !== null}
        title="卸载插件"
        message="确定要卸载该插件吗？卸载后相关功能将不可用。"
        confirmLabel="卸载"
        onConfirm={() => void doUnload()}
        onCancel={() => setConfirmUnload(null)}
        danger
      />
    </PluginErrorBoundary>
  );
}

/* ---------- atoms ---------- */

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 16px', borderTop: '1px solid var(--c-divider)',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>{label}</div>
      <div style={{
        fontSize: 13, color: 'var(--c-textSub)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  h2: { fontSize: 16, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 12px' },
  card: {
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
  },
  empty: { padding: '14px 16px', fontSize: 12, color: 'var(--c-textMute)' },
  input: {
    padding: '6px 10px',
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--c-text)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  primaryBtn: {
    padding: '6px 14px',
    background: 'var(--c-accent)',
    color: '#fff',
    border: '1px solid var(--c-accent)',
    borderRadius: 'var(--r-md)',
    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '6px 12px',
    background: 'var(--c-bg)',
    color: 'var(--c-text)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer',
  },
};
