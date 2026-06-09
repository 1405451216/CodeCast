// frontend/src/v2/pages/CostPage.tsx
//
// Surfaces the data already collected by costSlice. Today the slice is
// refreshed in `bootstrap()`; this page re-fetches on mount and exposes
// a "Reset" / "Set budget" UX.
//
// The page intentionally uses the same plain CSS-in-JS pattern as the
// other pages in v2/ to stay consistent with the rest of the frontend
// (no design-system refactor in this task).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { Button } from '../components/primitives/Button';
import { TopBar } from '../layout/TopBar';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';
import { Breadcrumb } from '../components/primitives/Breadcrumb';

function CostPageFallback({ error }: { error: Error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => window.location.reload()} backLabel="成本" />
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

class CostErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: Error) { return { error: err }; }
  render() { return this.state.error ? <CostPageFallback error={this.state.error} /> : this.props.children; }
}

const FMT_USD = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(2)}k`
    : `$${n.toFixed(4)}`;

export function CostPage() {
  const navigate = useNavigate();
  const {
    costSummary,
    budgetConfig,
    costLoading,
    refreshCost,
    refreshBudget,
    resetCost,
    updateBudget,
    setLimit,
    checkBudget,
  } = useAppStore();

  // Re-fetch on mount; bootstrap also loads these but we want a fresh
  // read when the user opens the page.
  useEffect(() => {
    void refreshCost();
    void refreshBudget();
  }, [refreshCost, refreshBudget]);

  const [budgetDraft, setBudgetDraft] = useState<string>('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  useEffect(() => {
    if (budgetConfig && budgetDraft === '') {
      setBudgetDraft(String(budgetConfig.maxCostUSD ?? 0));
    }
  }, [budgetConfig, budgetDraft]);

  /* ---- Derived: per-model breakdown ---- */
  const MODEL_COST_PER_1K: Record<string, number> = {
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'gpt-4o': 0.005,
    'gpt-3.5-turbo': 0.0015,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    'claude-3.5-sonnet': 0.003,
  };
  function estimateCost(model: string, tokens: number): string {
    const lower = model.toLowerCase();
    for (const [key, cost] of Object.entries(MODEL_COST_PER_1K)) {
      if (lower.includes(key)) return `$${((tokens / 1000) * cost).toFixed(2)}`;
    }
    return '—';
  }

  const modelRows = useMemo(() => {
    const usage = costSummary?.tokenUsage ?? {};
    return Object.entries(usage)
      .map(([model, tokens]) => ({ model, tokens, cost: estimateCost(model, tokens) }))
      .sort((a, b) => b.tokens - a.tokens);
  }, [costSummary]);

  const handleApplyLimit = useCallback(async () => {
    const parsed = Number(budgetDraft);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setLimit(parsed);
    await checkBudget();
    await refreshCost();
  }, [budgetDraft, setLimit, checkBudget, refreshCost]);

  const handleReset = useCallback(async () => {
    await resetCost();
    setConfirmReset(false);
  }, [resetCost]);

  const handleToggleEnforcement = useCallback(async () => {
    if (!budgetConfig) return;
    await updateBudget({
      maxCostUSD: budgetConfig.maxCostUSD,
      alertThreshold: budgetConfig.alertThreshold,
      enforcementEnabled: !budgetConfig.enforcementEnabled,
    });
  }, [budgetConfig, updateBudget]);

  return (
    <CostErrorBoundary>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel="成本" />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 32px', minHeight: 0, overscrollBehavior: 'contain' }}>
        <div style={{ maxWidth: 'var(--page-max-width)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Breadcrumb items={[{ label: '设置', path: '/settings' }, { label: '成本' }]} />
          {/* Time range filter */}
          <section>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--c-textMute)' }}>时间范围:</span>
              {(['today', 'week', 'month', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    background: timeRange === r ? 'var(--c-accent)' : 'var(--c-surface)',
                    color: timeRange === r ? '#fff' : 'var(--c-text)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease)',
                  }}
                >
                  {{ today: '今日', week: '本周', month: '本月', all: '全部' }[r]}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => {
                  const rows = [['Model', 'Tokens', 'Estimated Cost (USD)']];
                  modelRows.forEach(r => rows.push([r.model, String(r.tokens), r.cost]));
                  const csv = rows.map(r => r.join(',')).join('\n');
                  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cost-report-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: '4px 12px', fontSize: 12,
                  background: 'transparent', border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)', color: 'var(--c-textSub)', cursor: 'pointer',
                }}
              >
                导出 CSV
              </button>
            </div>
          </section>

          {/* Headline totals */}
          <section>
            <h2 style={S.h2}>成本概览</h2>
            <div style={S.card}>
              <Row label="总成本" value={costSummary ? FMT_USD(costSummary.totalCostUSD) : '—'} mono />
              <Row label="本会话成本" value={costSummary ? FMT_USD(costSummary.sessionCostUSD) : '—'} mono />
              <Row
                label="预算状态"
                value={
                  costSummary?.budgetExceeded
                    ? <span style={{ color: 'var(--c-danger)' }}>已超出</span>
                    : budgetConfig
                      ? `≤ ${FMT_USD(budgetConfig.maxCostUSD)}`
                      : '—'
                }
              />
              {costSummary && costSummary.totalCostUSD > 0 && (
                <Row
                  label="月末预估"
                  value={(() => {
                    const now = new Date();
                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const dayOfMonth = now.getDate();
                    const dailyAvg = costSummary.totalCostUSD / Math.max(1, dayOfMonth);
                    const projected = dailyAvg * daysInMonth;
                    return `~${FMT_USD(projected)} (日均 ${FMT_USD(dailyAvg)})`;
                  })()}
                  mono
                />
              )}
            </div>
          </section>
          <section>
            <h2 style={S.h2}>按模型 token 拆分</h2>
            <div style={S.card}>
              {modelRows.length === 0 ? (
                <div style={S.empty}>{costLoading ? '加载中…' : '暂无数据'}</div>
              ) : (
                <>
                  {modelRows.map((r) => (
                    <Row
                      key={r.model}
                      label={r.model}
                      value={`${r.tokens.toLocaleString()} tokens (~${r.cost})`}
                      mono
                    />
                  ))}
                  {/* Simple bar chart */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--c-divider)' }}>
                    <div style={{ fontSize: 11, color: 'var(--c-textMute)', marginBottom: 8 }}>Token 分布</div>
                    {(() => {
                      const maxTokens = Math.max(...modelRows.map(r => r.tokens));
                      return modelRows.slice(0, 6).map((r) => (
                        <div key={r.model} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--c-textSub)', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={r.model}>
                            {r.model}
                          </span>
                          <div style={{ flex: 1, height: 16, background: 'var(--c-bgSub)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.max(2, (r.tokens / maxTokens) * 100)}%`,
                              height: '100%',
                              background: 'var(--c-accent)',
                              borderRadius: 3,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--c-textMute)', fontFamily: 'var(--font-mono)', width: 60, textAlign: 'right', flexShrink: 0 }}>
                            {r.tokens > 1000 ? `${(r.tokens / 1000).toFixed(1)}k` : r.tokens}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Budget control */}
          <section>
            <h2 style={S.h2}>预算控制</h2>
            <div style={S.card}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--c-divider)' }}>
                <label htmlFor="limit" style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                  预算上限 (USD)
                </label>
                <input
                  id="limit"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  style={S.input}
                />
                <Button
                  variant="primary"
                  onClick={handleApplyLimit}
                  disabled={costLoading}
                >
                  应用
                </Button>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--c-divider)' }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                  强制执行 {budgetConfig?.enforcementEnabled ? '已开启' : '已关闭'}
                </div>
                <Button variant="secondary" onClick={handleToggleEnforcement}>
                  {budgetConfig?.enforcementEnabled ? '关闭' : '开启'}
                </Button>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--c-divider)' }}>
                <label style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                  告警阈值 (%)
                </label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={budgetConfig?.alertThreshold ?? 80}
                  onChange={(e) => updateBudget({
                    maxCostUSD: budgetConfig?.maxCostUSD ?? 0,
                    alertThreshold: Number(e.target.value),
                    enforcementEnabled: budgetConfig?.enforcementEnabled ?? false,
                  })}
                  style={{ width: 120 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--c-textSub)', width: 40, textAlign: 'right' }}>
                  {budgetConfig?.alertThreshold ?? 80}%
                </span>
              </div>
            </div>
          </section>

          {/* Reset */}
          <section>
            <h2 style={S.h2}>重置</h2>
            <div style={S.card}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--c-textSub)' }}>
                  重置将清空累计成本数据,不可撤销。
                </div>
                <Button variant="danger" onClick={() => setConfirmReset(true)}>
                  重置成本
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
      <ConfirmDialog
        open={confirmReset}
        title="确认重置"
        message="此操作将清除所有费用数据，不可恢复。确定继续吗？"
        danger
        confirmLabel="重置"
        cancelLabel="取消"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </CostErrorBoundary>
  );
}

/* ---------- inline atoms (matches SettingsPage/Sidebar style) ---------- */

function Row({
  label, value, mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 16px', borderTop: '1px solid var(--c-divider)',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--c-textSub)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  h2: {
    fontSize: 16, fontWeight: 600, color: 'var(--c-text)',
    margin: '0 0 12px',
  },
  card: {
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
  },
  empty: {
    padding: '14px 16px', fontSize: 12, color: 'var(--c-textMute)',
  },
  input: {
    width: 120,
    padding: '6px 10px',
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--c-text)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
};
