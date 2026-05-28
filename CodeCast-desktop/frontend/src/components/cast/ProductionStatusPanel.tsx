import React, { useState, useEffect, useCallback } from 'react';
import { castBackupManager } from '../../utils/cast/cast-backup-manager';
import { castStorageHealthChecker } from '../../utils/cast/cast-storage-health';
import { castOfflineDetector } from '../../utils/cast/cast-offline-detector';
import { useCastPrivacyStore } from '../../store/useCastPrivacyStore';
import { PerformanceDashboard } from './PerformanceDashboard';

function formatKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN');
}

export function ProductionStatusPanel() {
  const [activeTab, setActiveTab] = useState<'backup' | 'storage' | 'network' | 'system' | 'performance'>('backup');
  const [backups, setBackups] = useState(castBackupManager.getBackups());
  const [storageStats, setStorageStats] = useState(castBackupManager.getStorageStats());
  const [healthReport, setHealthReport] = useState<any>(null);
  const [networkState, setNetworkState] = useState(castOfflineDetector.getState());
  const [isCreating, setIsCreating] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const privacyReport = useCastPrivacyStore(s => s.report);

  useEffect(() => {
    const unsub = castOfflineDetector.onStateChange(setNetworkState);
    return () => unsub();
  }, []);

  const refreshBackups = useCallback(() => {
    setBackups(castBackupManager.getBackups());
    setStorageStats(castBackupManager.getStorageStats());
  }, []);

  const handleCreateBackup = useCallback(async () => {
    setIsCreating(true);
    try {
      await castBackupManager.createBackup();
      refreshBackups();
      setRestoreResult({ success: true, message: '备份创建成功' });
    } catch (e: any) {
      setRestoreResult({ success: false, message: `备份失败: ${e.message}` });
    }
    setIsCreating(false);
    setTimeout(() => setRestoreResult(null), 3000);
  }, [refreshBackups]);

  const handleRestore = useCallback(async (id: string) => {
    if (!confirm(`确定从备份恢复？当前数据将被覆盖。\n\n备份时间: ${new Date(castBackupManager.getBackup(id)?.createdAt || 0).toLocaleString()}`)) return;

    try {
      const result = await castBackupManager.restoreBackup(id);
      if (result.success) {
        setRestoreResult({ success: true, message: `恢复成功！已恢复 ${result.restoredStores.length} 个存储` });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRestoreResult({ success: false, message: `部分恢复: ${result.errors.join('; ')}` });
      }
    } catch (e: any) {
      setRestoreResult({ success: false, message: e.message });
    }
    setTimeout(() => setRestoreResult(null), 5000);
  }, []);

  const handleCheckHealth = useCallback(async () => {
    const report = await castStorageHealthChecker.check();
    setHealthReport(report);
  }, []);

  const handleRepair = useCallback(async () => {
    const result = await castStorageHealthChecker.repair();
    alert(`修复完成:\n${result.actionsTaken.length > 0 ? result.actionsTaken.join('\n') : '无需修复'}\n${result.errors.length > 0 ? '\n错误:\n' + result.errors.join('\n') : ''}`);
    handleCheckHealth();
  }, [handleCheckHealth]);

  const handleExportAll = useCallback(() => {
    const data = JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      stores: (() => {
        const s: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('codecast_cast_') || key.startsWith('cast_'))) {
            try { s[key] = JSON.parse(localStorage.getItem(key)!); } catch {}
          }
        }
        return s;
      })(),
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cast-full-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="production-status-panel">
      <div className="production-header">
        <h2>🏭 生产级控制台</h2>
        <div className="production-badges">
          <span className={`prod-badge network-${networkState.status}`}>
            {networkState.status === 'online' ? '🟢 在线' : networkState.status === 'offline' ? '🔴 离线' : '⚪ 未知'}
          </span>
          {privacyReport && (
            <span className="prod-badge security">
              🛡️ {privacyReport.grade}
            </span>
          )}
        </div>
      </div>

      <div className="production-tabs">
        {[
          { key: 'backup' as const, icon: '💾', label: '数据备份' },
          { key: 'storage' as const, icon: '📊', label: '存储健康' },
          { key: 'network' as const, icon: '🌐', label: '网络状态' },
          { key: 'system' as const, icon: '⚙️', label: '系统信息' },
          { key: 'performance' as const, icon: '📈', label: '性能监控' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`prod-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'backup' && (
        <div className="prod-tab-content">
          <div className="prod-action-bar">
            <button className="prod-btn primary" onClick={handleCreateBackup} disabled={isCreating}>
              {isCreating ? '创建中...' : '+ 创建新备份'}
            </button>
            <button className="prod-btn normal" onClick={handleExportAll}>
              📤 导出全部数据
            </button>
            <span className="prod-info">{backups.length} 个备份 · {formatKB(storageStats.totalSizeKB * 1024)}</span>
          </div>

          {restoreResult && (
            <div className={`prod-toast ${restoreResult.success ? 'success' : 'error'}`}>
              {restoreResult.message}
            </div>
          )}

          <div className="backup-list">
            {backups.length === 0 ? (
              <div className="prod-empty">暂无备份，点击上方按钮创建</div>
            ) : backups.map(bk => (
              <div key={bk.id} className="backup-item">
                <div className="backup-info">
                  <span className="backup-time">{formatTime(bk.createdAt)}</span>
                  <span className="backup-size">{formatKB(bk.size)}</span>
                  <span className="backup-stores">{bk.storeKeys.length} 个存储</span>
                </div>
                <div className="backup-actions">
                  <button className="prod-btn-sm success" onClick={() => {
                    const data = castBackupManager.exportBackup(bk.id);
                    if (data) {
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url;
                      a.download = `cast-backup-${new Date(bk.createdAt).toISOString().slice(0, 10)}.json`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    }
                  }}>导出</button>
                  <button className="prod-btn-sm warning" onClick={() => handleRestore(bk.id)}>恢复</button>
                  <button className="prod-btn-sm danger" onClick={() => {
                    castBackupManager.deleteBackup(bk.id);
                    refreshBackups();
                  }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="prod-tab-content">
          <div className="prod-action-bar">
            <button className="prod-btn primary" onClick={handleCheckHealth}>🔍 检查健康</button>
            <button className="prod-btn warning" onClick={handleRepair}>🔧 一键修复</button>
          </div>

          {healthReport && (
            <div className="health-report-card">
              <div className={`health-status ${healthReport.isHealthy ? 'healthy' : 'unhealthy'}`}>
                {healthReport.isHealthy ? '✅ 存储健康' : '⚠️ 发现问题'}
              </div>

              <div className="health-stats-grid">
                <div className="health-stat">
                  <span className="hs-value">{healthReport.usagePercent.toFixed(1)}%</span>
                  <span className="hs-label">使用率</span>
                </div>
                <div className="health-stat">
                  <span className="hs-value">{healthReport.castKeysCount}</span>
                  <span className="hs-label">Cast 键</span>
                </div>
                <div className="health-stat">
                  <span className="hs-value">{healthReport.totalKeysCount}</span>
                  <span className="hs-label">总键数</span>
                </div>
                <div className="health-stat">
                  <span className="hs-value">{formatKB(healthReport.usedSpaceBytes)}</span>
                  <span className="hs-label">已用空间</span>
                </div>
              </div>

              {healthReport.warnings.length > 0 && (
                <div className="health-warnings">
                  <h4>警告</h4>
                  <ul>{healthReport.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              <div className="health-recommendations">
                <h4>建议</h4>
                <ul>{healthReport.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
              </div>

              {healthReport.oversizedKeys.length > 0 && (
                <div className="health-oversized">
                  <h4>超大键值对</h4>
                  {healthReport.oversizedKeys.map((ok: any, i: number) => (
                    <div key={i} className="oversized-item">
                      <code>{ok.key}</code> — {ok.sizeKB} KB
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'network' && (
        <div className="prod-tab-content">
          <div className="network-status-card">
            <div className={`net-indicator ${networkState.status}`}>
              {networkState.status === 'online' ? '🟢 在线' :
               networkState.status === 'offline' ? '🔴 离线' : '⚪ 检测中'}
            </div>

            <div className="net-details">
              <div className="net-row"><label>连接质量</label><span>{networkState.quality === 'high' ? '优秀' : networkState.quality === 'medium' ? '一般' : networkState.quality === 'low' ? '较差' : '无'}</span></div>
              <div className="net-row"><label>上次在线</label><span>{networkState.lastOnlineAt ? formatTime(networkState.lastOnlineAt) : '未知'}</span></div>
              {networkState.status === 'offline' && (
                <div className="net-row"><label>离线时长</label><span>{(() => { const ms = networkState.offlineDuration; if (ms < 60000) return `${Math.floor(ms / 1000)}秒`; if (ms < 3600000) return `${Math.floor(ms / 60000)}分钟`; return `${Math.floor(ms / 3600000)}小时${Math.floor((ms % 3600000) / 60000)}分`; })()}</span></div>
              )}
              {(() => {
                const connInfo = castOfflineDetector.getConnectionInfo();
                return Object.entries(connInfo).length > 0 ? (
                  <div className="net-connection-info">
                    <h4>连接详情</h4>
                    {(Object.entries(connInfo) as [string, any][]).map(([k, v]) => (
                      <div key={k} className="net-row"><label>{k}</label><span>{String(v)}</span></div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="prod-tab-content">
          <div className="sys-info-grid">
            <div className="sys-info-item">
              <label>平台</label><span>{navigator.platform || '未知'}</span>
            </div>
            <div className="sys-info-item">
              <label>用户代理</label><span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{navigator.userAgent.slice(0, 80)}...</span>
            </div>
            <div className="sys-info-item">
              <label>语言</label><span>{navigator.language || '未知'}</span>
            </div>
            <div className="sys-info-item">
              <label>CPU 核心数</label><span>{(navigator as any).hardwareConcurrency || '未知'}</span>
            </div>
            <div className="sys-info-item">
              <label>设备内存</label><span>{(navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB` : '未知'}</span>
            </div>
            <div className="sys-info-item">
              <label>屏幕分辨率</label><span>{screen.width}×{screen.height}</span>
            </div>
            <div className="sys-info-item">
              <label>窗口尺寸</label><span>{window.innerWidth}×{window.innerHeight}</span>
            </div>
            <div className="sys-info-item">
              <label>时区</label><span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="prod-tab-content">
          <PerformanceDashboard />
        </div>
      )}
    </div>
  );
}

function CastOfflineDetector() {
  throw new Error('Reference only - use castOfflineDetector singleton');
}
export default ProductionStatusPanel;
