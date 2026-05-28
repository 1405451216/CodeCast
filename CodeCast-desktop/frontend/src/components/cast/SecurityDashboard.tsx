import React, { useState, useEffect, useMemo } from 'react';
import { useCastPrivacyStore } from '../../store/useCastPrivacyStore';
import { CAST_SECURITY_MANIFEST, getSecuritySummary } from '../../utils/cast/cast-security-manifest';
import { PRIVACY_LEVEL_LABELS, OUTBOUND_CATEGORY_LABELS } from '../../types/cast-privacy';
import type { OutboundAuditLog, OutboundCategory, OutboundDecision, PrivacyPolicyMode } from '../../types/cast-privacy';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'A': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  'B': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'C': { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
  'D': { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' },
  'F': { bg: '#fecdd3', text: '#9f1239', border: '#fda4af' }
};

export function SecurityDashboard() {
  const {
    logs, config, report, isInitialized,
    init, refreshReport, clearLogs,
    updateMode, toggleAutoMask, toggleLlmMinimization, toggleShowConfirmation,
    setRetentionDays, addExemptDomain, removeExemptDomain, forgetDomainMemory,
    exportData, resetAll
  } = useCastPrivacyStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'storage' | 'manifest'>('overview');
  const [logFilter, setLogFilter] = useState<OutboundCategory | 'all'>('all');
  const [logSearch, setLogSearch] = useState('');

  useEffect(() => { if (!isInitialized) init(); }, [isInitialized, init]);
  useEffect(() => { const t = setInterval(refreshReport, 10000); return () => clearInterval(t); }, [refreshReport]);

  const filteredLogs = useMemo(() => {
    let result = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    if (logFilter !== 'all') result = result.filter(l => l.category === logFilter);
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      result = result.filter(l => l.url.toLowerCase().includes(q) || l.domain.toLowerCase().includes(q));
    }
    return result.slice(0, 100);
  }, [logs, logFilter, logSearch]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const cat of Object.keys(OUTBOUND_CATEGORY_LABELS)) stats[cat] = 0;
    for (const log of logs) stats[log.category] = (stats[log.category] || 0) + 1;
    return stats;
  }, [logs]);

  if (!report) return <div className="cast-security-loading">加载安全仪表盘...</div>;

  const gradeStyle = GRADE_COLORS[report.grade] || GRADE_COLORS['B'];

  return (
    <div className="cast-security-dashboard">
      <div className="cast-security-header">
        <h2><span className="cast-security-icon">🛡️</span> 安全与隐私中心</h2>
        <span className="cast-security-badge" style={{ background: gradeStyle.bg, color: gradeStyle.text, borderColor: gradeStyle.border }}>
          安全评级: {report.grade}
        </span>
      </div>

      <div className="cast-security-tabs">
        {[
          { key: 'overview' as const, label: '总览', icon: '📊' },
          { key: 'logs' as const, label: '审计日志', icon: '📋' },
          { key: 'storage' as const, label: '存储分析', icon: '💾' },
          { key: 'manifest' as const, label: '安全声明', icon: '📜' }
        ].map(tab => (
          <button
            key={tab.key}
            className={`cast-security-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="cast-security-overview">
          <div className="cast-security-score-card">
            <div className="cast-security-score-ring">
              <svg viewBox="0 0 120 120" width={120} height={120}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none"
                  stroke={report.score >= 80 ? '#22c55e' : report.score >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 52 * report.score / 100} ${2 * Math.PI * 52}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="cast-security-score-value">{report.score}</div>
            </div>
            <div className="cast-security-score-info">
              <h3>{report.score >= 85 ? '安全状态良好' : report.score >= 60 ? '存在安全风险' : '需要立即关注'}</h3>
              <p>共记录 {report.totalOutboundCalls} 次出站操作</p>
              <p>数据传输总量: {formatBytes(report.dataTransferredBytes)}</p>
            </div>
          </div>

          <div className="cast-security-stats-grid">
            <div className="cast-security-stat-card stat-allowed">
              <div className="stat-number">{report.allowedCalls}</div>
              <div className="stat-label">已允许</div>
            </div>
            <div className="cast-security-stat-card stat-denied">
              <div className="stat-number">{report.deniedCalls}</div>
              <div className="stat-label">已拦截</div>
            </div>
            <div className="cast-security-stat-card stat-pending">
              <div className="stat-number">{report.pendingCalls}</div>
              <div className="stat-label">待确认</div>
            </div>
            <div className="cast-security-stat-card stat-domains">
              <div className="stat-number">{report.uniqueDomains.size}</div>
              <div className="stat-label">外部域名</div>
            </div>
          </div>

          <div className="cast-security-outbound-points">
            <h3>外部通信点状态</h3>
            <div className="outbound-points-list">
              {(Object.entries(OUTBOUND_CATEGORY_LABELS) as [OutboundCategory, typeof OUTBOUND_CATEGORY_LABELS[OutboundCategory]][]).map(([key, info]) => {
                const count = categoryStats[key] || 0;
                return (
                  <div key={key} className={`outbound-point-item ${count > 0 ? 'has-activity' : ''}`}>
                    <span className="point-icon">{info.icon}</span>
                    <span className="point-name">{info.label}</span>
                    <span className="point-desc">{info.description}</span>
                    <span className={`point-count ${count > 10 ? 'high' : count > 0 ? 'medium' : 'none'}`}>
                      {count} 次
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cast-security-policy-quick">
            <h3>快速策略切换</h3>
            <div className="policy-mode-buttons">
              {([
                { mode: 'allow_all' as PrivacyPolicyMode, label: '允许全部', color: '#ef4444', desc: '⚠️ 不推荐' },
                { mode: 'prompt_all' as PrivacyPolicyMode, label: '逐次确认', color: '#f59e0b', desc: '✅ 推荐' },
                { mode: 'deny_all' as PrivacyPolicyMode, label: '全部禁止', color: '#22c55e', desc: '最严格' }
              ]).map(opt => (
                <button
                  key={opt.mode}
                  className={`policy-mode-btn ${config.mode === opt.mode ? 'active' : ''}`}
                  style={{ '--mode-color': opt.color } as React.CSSProperties}
                  onClick={() => updateMode(opt.mode)}
                >
                  <span className="mode-label">{opt.label}</span>
                  <span className="mode-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cast-security-recommendations">
            <h3>安全建议</h3>
            <ul>
              {report.recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>

          <div className="cast-security-actions-bar">
            <button className="security-btn danger" onClick={() => { if (confirm('确定清除所有审计日志？')) clearLogs(); }}>
              🗑️ 清除日志
            </button>
            <button className="security-btn warning" onClick={forgetDomainMemory}>
              🧹 清除域名记忆
            </button>
            <button className="security-btn normal" onClick={() => {
              const data = exportData();
              navigator.clipboard?.writeText(data).catch(() => {});
              alert('隐私报告已复制到剪贴板');
            }}>
              📋 复制报告
            </button>
            <button className="security-btn danger-outline" onClick={() => { if (confirm('将重置所有隐私设置和日志，确定吗？')) resetAll(); }}>
              🔄 重置全部
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="cast-security-logs-panel">
          <div className="cast-security-logs-toolbar">
            <input
              type="text"
              className="cast-security-search-input"
              placeholder="搜索 URL 或域名..."
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
            />
            <div className="cast-security-filter-chips">
              <button className={`filter-chip ${logFilter === 'all' ? 'active' : ''}`} onClick={() => setLogFilter('all')}>
                全部 ({logs.length})
              </button>
              {(Object.entries(OUTBOUND_CATEGORY_LABELS) as [OutboundCategory, typeof OUTBOUND_CATEGORY_LABELS[OutboundCategory]][]).map(([key, info]) => (
                <button key={key} className={`filter-chip ${logFilter === key ? 'active' : ''}`} onClick={() => setLogFilter(key)}>
                  {info.icon} {info.label} ({categoryStats[key] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="cast-security-logs-timeline">
            {filteredLogs.length === 0 ? (
              <div className="cast-security-empty-state">暂无审计日志记录</div>
            ) : filteredLogs.map(log => (
              <AuditLogItem key={log.id} log={log} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="cast-security-storage-panel">
          <h3>本地存储使用情况</h3>
          <div className="cast-storage-list">
            {(Object.entries(report.storageUsage) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([key, size]) => (
              <div key={key} className="cast-storage-item">
                <span className="storage-key">{key}</span>
                <div className="storage-bar-wrap">
                  <div className="storage-bar" style={{ width: `${Math.min(100, (size / 5000000) * 100)}%` }} />
                </div>
                <span className="storage-size">{formatBytes(size)}</span>
              </div>
            ))}
            {Object.keys(report.storageUsage).length === 0 && (
              <div className="cast-security-empty-state">暂无 Cast 相关存储数据</div>
            )}
          </div>

          <div className="cast-security-exempt-domains">
            <h3>免审域名白名单</h3>
            <div className="exempt-domain-list">
              {config.exemptDomains.map((d: string) => (
                <span key={d} className="exempt-tag">
                  {d}
                  <button onClick={() => removeExemptDomain(d)}>×</button>
                </span>
              ))}
            </div>
            <div className="add-exempt-row">
              <input id="newExemptDomain" placeholder="输入域名如 api.example.com" onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) { addExemptDomain(val); (e.target as HTMLInputElement).value = ''; }
                }
              }} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'manifest' && (
        <div className="cast-security-manifest-panel">
          <pre className="cast-security-manifest-text">{getSecuritySummary()}</pre>
          <div className="cast-security-guarantees">
            <h3>安全承诺</h3>
            <ol>
              {CAST_SECURITY_MANIFEST.guarantees.map((g, i) => (
                <li key={i}><span className="guarantee-check">✅</span> {g}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogItem({ log }: { log: OutboundAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const catInfo = OUTBOUND_CATEGORY_LABELS[log.category];
  const levelInfo = PRIVACY_LEVEL_LABELS[log.privacyLevel];
  const decisionColors: Record<OutboundDecision, string> = {
    allowed: '#22c55e',
    denied: '#ef4444',
    pending_confirmation: '#f59e0b',
    blocked: '#6b7280'
  };

  return (
    <div className={`audit-log-item decision-${log.decision}`} onClick={() => setExpanded(!expanded)}>
      <div className="audit-log-main">
        <span className="audit-log-category">{catInfo?.icon || '?'}</span>
        <div className="audit-log-info">
          <span className="audit-log-url">{log.domain}{log.url.length > 60 ? '' : log.url.slice(log.domain.length)}</span>
          <span className="audit-log-meta">
            {log.method} · {formatBytes(log.dataSize)} · {timeAgo(log.timestamp)}
          </span>
        </div>
        <span className="audit-log-decision" style={{ color: decisionColors[log.decision] }}>
          {log.decision === 'allowed' ? '✅ 允许' : log.decision === 'denied' ? '❌ 拦截' : log.decision === 'pending_confirmation' ? '⏳ 待确认' : '🚫 封锁'}
        </span>
      </div>
      {expanded && (
        <div className="audit-log-detail">
          <div className="detail-row"><label>完整URL</label><code>{log.url}</code></div>
          <div className="detail-row"><label>方法</label><span>{log.method}</span></div>
          <div className="detail-row"><label>分类</label><span>{catInfo?.label} ({catInfo?.description})</span></div>
          <div className="detail-row"><label>隐私级别</label><span style={{ color: levelInfo?.color }}>{levelInfo?.icon} {levelInfo?.label}</span></div>
          <div className="detail-row"><label>数据大小</label><span>{formatBytes(log.dataSize)}</span></div>
          <div className="detail-row"><label>原因</label><span>{log.reason}</span></div>
          <div className="detail-row"><label>用户确认</label><span>{log.userConfirmed ? '是' : '否（自动）'}</span></div>
          <div className="detail-row"><label>时间</label><span>{new Date(log.timestamp).toLocaleString('zh-CN')}</span></div>
          {log.statusCode && <div className="detail-row"><label>状态码</label><span>{log.statusCode}</span></div>}
          {log.duration != null && <div className="detail-row"><label>耗时</label><span>{log.duration}ms</span></div>}
        </div>
      )}
    </div>
  );
}

export default SecurityDashboard;
