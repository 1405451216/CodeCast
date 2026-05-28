import React, { useState, useEffect } from 'react';
import { useMemoryStore } from '../store/useMemoryStore';
import { useCastMemoryStore } from '../store/useCastMemoryStore';
import { useCastSchedulerStore } from '../store/useCastSchedulerStore';
import { useCastPrivacyStore } from '../store/useCastPrivacyStore';
import { CastErrorBoundary } from '../utils/cast/cast-error-boundary';
import type { CastWorkspaceTab } from '../types/cast-types';
import { CAST_TABS } from '../types/cast-types';
import WritingAssistant from './cast/WritingAssistant';
import TranslationWorkbench from './cast/TranslationWorkbench';
import ScheduleManager from './cast/ScheduleManager';
import KnowledgeBase from './cast/KnowledgeBase';
import EmailComposer from './cast/EmailComposer';
import CastToolsHub from './cast/CastToolsHub';
import MemoryPanel from './cast/MemoryPanel';
import SchedulerPanel from './cast/SchedulerPanel';
import PluginManagerPanel from './cast/PluginManagerPanel';
import CastSettings from './cast/CastSettings';
import LearningDashboard from './cast/LearningDashboard';
import CollabPanel from './cast/CollabPanel';
import { ProductionStatusPanel } from './cast/ProductionStatusPanel';
import { getCastMemoryStats } from '../utils/cast/cast-memory-bridge';
import { bootstrapBuiltinCastTools } from '../tools/CastToolRegistry';
import '../styles/cast-workspace.css';
import '../styles/cast-security.css';

function SecurityIndicator({ onClick }: { onClick: () => void }) {
  const report = useCastPrivacyStore(state => state.report);
  if (!report) return null;

  const color = report.score >= 85 ? '#22c55e' : report.score >= 60 ? '#f59e0b' : '#ef4444';
  const label = report.score >= 85 ? '安全' : report.score >= 60 ? '注意' : '风险';

  return (
    <button
      className="workspace-settings-btn security-indicator-btn"
      onClick={onClick}
      title={`安全评级: ${report.grade} (${report.score}分) - ${label} · 点击查看详情`}
      style={{ color } as React.CSSProperties}
    >
      🛡️
    </button>
  );
}

interface CastModeWorkspaceProps {
  visible?: boolean;
  mode?: 'coding' | 'daily';
}

const CastModeWorkspace: React.FC<CastModeWorkspaceProps> = ({
  visible = true,
  mode = 'daily'
}) => {
  const [activeTab, setActiveTab] = useState<CastWorkspaceTab>('writing');
  const [workspaceHeight, setWorkspaceHeight] = useState(380);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [memoryStats, setMemoryStats] = useState({ total: 0, todayCount: 0, byPanel: {} as Record<string, number> });
  const [showMemoryTip, setShowMemoryTip] = useState(false);

  useEffect(() => {
    setMemoryStats(getCastMemoryStats());
    useMemoryStore.getState().fetchMemories();

    const castMemoryStore = useCastMemoryStore.getState();
    castMemoryStore.loadFromStorage();

    const schedulerStore = useCastSchedulerStore.getState();
    schedulerStore.loadFromStorage();

    try {
      bootstrapBuiltinCastTools();
    } catch (e) {
      console.warn('[CastModeWorkspace] Failed to bootstrap cast tools:', e);
    }

    const castMemories = castMemoryStore;
    setMemoryStats({
      total: castMemories.memories.length,
      todayCount: castMemories.memories.filter(m => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return m.timestamp >= todayStart.getTime();
      }).length,
      byPanel: (() => {
        const byPanel: Record<string, number> = {};
        castMemories.memories.forEach(m => {
          const panel = m.source || 'general';
          byPanel[panel] = (byPanel[panel] || 0) + 1;
        });
        return byPanel;
      })()
    });
    
    import('../store/useCastLearningStore').then(m => { try { m.useCastLearningStore.getState().loadFromStorage(); } catch { /* ignore */ } }).catch(() => { /* ignore */ });
    import('../store/useCastCollabStore').then(m => { try { m.useCastCollabStore.getState().loadFromStorage(); } catch { /* ignore */ } }).catch(() => { /* ignore */ });

    const privacyStore = useCastPrivacyStore.getState();
    if (!privacyStore.isInitialized) {
      privacyStore.init();
    }
  }, []);

  const quickActionsByTab: Record<CastWorkspaceTab, Array<{ icon: string; label: string; action: () => void }>> = {
    writing: [
      { icon: '📝', label: '新建文档', action: () => {} },
      { icon: '🔄', label: 'AI续写', action: () => {} },
      { icon: '✨', label: '润色', action: () => {} }
    ],
    translate: [
      { icon: '🌐', label: '翻译', action: () => {} },
      { icon: '💾', label: '术语表', action: () => {} },
      { icon: '📜', label: '历史', action: () => {} }
    ],
    schedule: [
      { icon: '➕', label: '新建待办', action: () => {} },
      { icon: '📅', label: '今日', action: () => {} },
      { icon: '🔍', label: 'AI排期', action: () => {} }
    ],
    knowledge: [
      { icon: '➕', label: '新建笔记', action: () => {} },
      { icon: '🔍', label: '搜索', action: () => {} },
      { icon: '📦', label: '导出', action: () => {} }
    ],
    email: [
      { icon: '📧', label: '新邮件', action: () => {} },
      { icon: '📋', label: '模板', action: () => {} },
      { icon: '📝', label: '签名', action: () => {} }
    ],
    tools: [],
    memory: [
      { icon: '🔍', label: '搜索记忆', action: () => {} },
      { icon: '📥', label: '导入', action: () => {} },
      { icon: '🧹', label: '清理', action: () => {} }
    ],
    scheduler: [
      { icon: '▶️', label: '启动', action: () => {} },
      { icon: '➕', label: '新建任务', action: () => {} },
      { icon: '📋', label: '日志', action: () => {} }
    ],
    plugins: [
      { icon: '🔎', label: '搜索工具', action: () => {} },
      { icon: '📦', label: '安装插件', action: () => {} },
      { icon: '🔄', label: '刷新', action: () => {} }
    ],
    settings: [
      { icon: '💾', label: '导出配置', action: () => {} },
      { icon: '📥', label: '导入配置', action: () => {} },
      { icon: '↩️', label: '恢复默认', action: () => {} }
    ],
    learning: [
      { icon: '🔍', label: '检测模式', action: () => {} },
      { icon: '⚡', label: '生成技能', action: () => {} },
      { icon: '📊', label: '学习报告', action: () => {} }
    ],
    collab: [
      { icon: '➕', label: '邀请成员', action: () => {} },
      { icon: '📦', label: '导出同步包', action: () => {} },
      { icon: '🔗', label: '分享工作区', action: () => {} }
    ],
    production: [
      { icon: '💾', label: '创建备份', action: () => {} },
      { icon: '🔍', label: '存储检查', action: () => {} },
      { icon: '📤', label: '导出全部', action: () => {} }
    ]
  };

  if (!visible || mode !== 'daily') return null;

  return (
    <CastErrorBoundary moduleName="CastModeWorkspace">
    <div className={`cast-mode-workspace ${showWorkspace ? 'visible' : 'collapsed'}`}>
      <div className="cast-workspace-header">
        <div className="workspace-title">
          <span className="title-icon">🎬</span>
          <h3>Cast 工作台</h3>
          {memoryStats.total > 0 && (
            <div
              className="cast-memory-indicator"
              onMouseEnter={() => setShowMemoryTip(true)}
              onMouseLeave={() => setShowMemoryTip(false)}
              title={`${memoryStats.total} 条记忆 · 今日新增 ${memoryStats.todayCount}`}
            >
              🧠
              <span className="memory-count">{memoryStats.total}</span>
              {showMemoryTip && memoryStats.todayCount > 0 && (
                <div className="memory-tip">
                  <div className="memory-tip-title">今日新增 {memoryStats.todayCount} 条</div>
                  {Object.entries(memoryStats.byPanel).map(([panel, count]) => (
                    <div key={panel}>{panel}: {count}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="workspace-tabs">
          {CAST_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`workspace-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              title={`${tab.label} - ${tab.description}`}
              style={{ '--tab-color': tab.color } as React.CSSProperties}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          className="workspace-settings-btn"
          onClick={() => setActiveTab('settings')}
          title="Cast 设置"
        >
          ⚙️
        </button>
        <SecurityIndicator onClick={() => setActiveTab('settings')} />
        <button
          className="toggle-workspace"
          onClick={() => setShowWorkspace(!showWorkspace)}
          title={showWorkspace ? '收起工作台' : '展开工作台'}
        >
          {showWorkspace ? '▼' : '▲'}
        </button>
      </div>

      {showWorkspace && (
        <>
          {quickActionsByTab[activeTab].length > 0 && (
            <div className="quick-actions">
              {quickActionsByTab[activeTab].map((cmd, idx) => (
                <button
                  key={idx}
                  className="quick-action-btn cast-action"
                  onClick={cmd.action}
                  title={cmd.label}
                >
                  <span className="action-icon">{cmd.icon}</span>
                  <span className="action-label">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          <div
            className="workspace-content"
            style={{ height: `${workspaceHeight}px` }}
          >
            {activeTab === 'writing' && (
              <WritingAssistant />
            )}
            {activeTab === 'translate' && (
              <TranslationWorkbench />
            )}
            {activeTab === 'schedule' && (
              <ScheduleManager />
            )}
            {activeTab === 'knowledge' && (
              <KnowledgeBase />
            )}
            {activeTab === 'email' && (
              <EmailComposer />
            )}
            {activeTab === 'tools' && (
              <CastToolsHub />
            )}
            {activeTab === 'memory' && <MemoryPanel />}
            {activeTab === 'scheduler' && <SchedulerPanel />}
            {activeTab === 'plugins' && <PluginManagerPanel />}
            {activeTab === 'settings' && <CastSettings />}
            {activeTab === 'learning' && <LearningDashboard />}
            {activeTab === 'collab' && <CollabPanel />}
            {activeTab === 'production' && (
              <CastErrorBoundary moduleName="ProductionStatusPanel">
                <ProductionStatusPanel />
              </CastErrorBoundary>
            )}
          </div>

          <div
            className="resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = workspaceHeight;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const delta = startY - moveEvent.clientY;
                const newHeight = Math.max(250, Math.min(700, startHeight + delta));
                setWorkspaceHeight(newHeight);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        </>
      )}
    </div>
    </CastErrorBoundary>
  );
};

export default React.memo(CastModeWorkspace);
