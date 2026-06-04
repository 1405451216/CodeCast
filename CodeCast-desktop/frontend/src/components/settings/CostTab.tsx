import React, { useEffect, useState } from 'react';
import { useAppStore, AppState } from '../../store';
import {
  getCostSummary,
  resetCostTracker,
  checkBudgetExceeded,
  setBudgetLimit,
  getBudgetConfig,
} from '../../api';

export const CostTab: React.FC = () => {
  const costSummary = useAppStore((s: AppState) => s.costSummary);
  const budgetExceeded = useAppStore((s: AppState) => s.budgetExceeded);
  const [budgetInput, setBudgetInput] = useState<string>('0');

  useEffect(() => {
    getBudgetConfig().then((config) => {
      setBudgetInput(config.max_total_cost_usd.toString());
    }).catch(() => {});
  }, []);

  const handleSetBudget = async () => {
    const value = parseFloat(budgetInput);
    if (!isNaN(value) && value >= 0) {
      await setBudgetLimit(value);
    }
  };

  const handleReset = async () => {
    await resetCostTracker();
  };

  const formatUSD = (v: number) => `$${v.toFixed(6)}`;

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ marginBottom: '12px' }}>LLM 成本追踪</h3>

      {budgetExceeded && (
        <div style={{ padding: '8px 12px', background: 'var(--error-bg, #ff4d4f22)', color: 'var(--error-text, #ff4d4f)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
          预算已超限！当前成本已超出设定上限。
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>总成本</div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{costSummary ? formatUSD(costSummary.total_cost_usd) : '$0.00'}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>总 Token</div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{costSummary?.total_tokens?.toLocaleString() ?? 0}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>调用次数</div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{costSummary?.call_count ?? 0}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>输入 Token</div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{costSummary?.total_prompt_tokens?.toLocaleString() ?? 0}</div>
        </div>
      </div>

      {costSummary?.by_model && Object.keys(costSummary.by_model).length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>按模型统计</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>模型</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>成本</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>调用</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Token</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(costSummary.by_model).map(([model, mc]) => (
                <tr key={model} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 8px' }}>{model}</td>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>{formatUSD(mc.cost_usd)}</td>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>{mc.calls}</td>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>{mc.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>预算设置</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px' }}>最大成本 (USD):</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '12px' }}
          />
          <button onClick={handleSetBudget} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--accent-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}>设置</button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>0 = 无限制</span>
        </div>
      </div>

      <button onClick={handleReset} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}>
        重置统计
      </button>
    </div>
  );
};
