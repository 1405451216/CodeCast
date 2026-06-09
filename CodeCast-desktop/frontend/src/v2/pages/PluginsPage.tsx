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
import { Breadcrumb } from '../components/primitives/Breadcrumb';
import { useI18n } from '../lib/useI18n';

function PluginPageFallback({ error, t }: { error: Error; t: ReturnType<typeof useI18n> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => window.location.reload()} backLabel={t.plugins.backLabel} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', color: 'var(--c-textSub)', fontSize: 13 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)', marginBottom: 8 }}>{t.plugins.pageError}</div>
          <div style={{ marginBottom: 12 }}>{error.message}</div>
          <button onClick={() => window.location.reload()} style={{ padding: '6px 16px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
            {t.plugins.reload}
          </button>
        </div>
      </div>
    </div>
  );
}

class PluginErrorBoundary extends React.Component<{ children: React.ReactNode; t: ReturnType<typeof useI18n> }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err }; }
  render() { return this.state.error ? <PluginPageFallback error={this.state.error} t={this.props.t} /> : this.props.children; }
}

export function PluginsPage() {
  const navigate = useNavigate();
  const t = useI18n();
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
      setSuccessMsg(t.plugins.loadSuccess);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, [path, loadPlugin, t.plugins.loadSuccess]);

  const handleUnload = useCallback(async (id: string) => {
    setConfirmUnload(id);
  }, []);

  const doUnload = useCallback(async () => {
    if (!confirmUnload) return;
    setActionError(null);
    setSuccessMsg(null);
    try {
      await unloadPlugin(confirmUnload);
      setSuccessMsg(t.plugins.unloadSuccess);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmUnload(null);
    }
  }, [confirmUnload, unloadPlugin, t.plugins.unloadSuccess]);

  return (
    <PluginErrorBoundary t={t}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel={t.plugins.backLabel} />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 32px', minHeight: 0, overscrollBehavior: 'contain' }}>
        <div style={{ maxWidth: 'var(--page-max-width)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Breadcrumb items={[{ label: t.plugins.settings, path: '/settings' }, { label: t.plugins.backLabel }]} />

          {/* Status section */}
          <section>
            <h2 style={S.h2}>{t.plugins.runtimeStatus}</h2>
            <div style={S.card}>
              <Row label={t.plugins.loadedCount} value={String(pluginStatus?.loadedPlugins ?? plugins.length)} />
              <Row label={t.plugins.totalCount} value={String(plugins.length)} mono />
            </div>
          </section>

          {/* Load new plugin */}
          <section>
            <h2 style={S.h2}>{t.plugins.loadNew}</h2>
            <div style={S.card}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--c-divider)' }}>
                <label htmlFor="plugin-path" style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                  {t.plugins.pluginPath}
                </label>
                <input
                  id="plugin-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/plugin"
                  style={{ ...S.input, flex: 1, minWidth: 200 }}
                />
                <button onClick={() => void handleSelectFolder()} style={S.secondaryBtn}>
                  {t.plugins.browse}
                </button>
                <button
                  onClick={() => void handleLoad()}
                  style={S.primaryBtn}
                  disabled={!path.trim() || pluginLoading}
                >
                  {t.plugins.load}
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
              <h2 style={S.h2}>{t.plugins.loadedSection}</h2>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.plugins.searchPlaceholder}
                style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none', width: 180 }}
              />
            </div>
            <div style={S.card}>
              {pluginLoading && plugins.length === 0 ? (
                <div style={S.empty}>{t.plugins.loading}</div>
              ) : filteredPlugins.length === 0 ? (
                <div style={S.empty}>{searchQuery ? t.plugins.noMatch : t.plugins.noPlugins}</div>
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
                          {p.loaded ? t.plugins.loaded : t.plugins.notLoaded}
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
                      {t.plugins.unload}
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
        title={t.plugins.unloadDialogTitle}
        message={t.plugins.unloadConfirmMsg}
        confirmLabel={t.plugins.unload}
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
