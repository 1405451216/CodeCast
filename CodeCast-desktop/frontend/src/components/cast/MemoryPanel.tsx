import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useCastMemoryStore,
  type CastMemoryItem,
  type CastMemoryStats
} from '../../store/useCastMemoryStore';
import SoulEditor from './SoulEditor';
import type { CastMemoryItemType, CastWorkspaceTab } from '../../types/cast-types';
import '../../styles/cast-workspace.css';

const TYPE_LABELS: Record<CastMemoryItemType | 'all', string> = {
  all: '全部',
  conversation: '对话',
  context: '上下文',
  preference: '偏好',
  insight: '洞察',
  decision: '决策',
  fact: '事实'
};

const TYPE_COLORS: Record<CastMemoryItemType, string> = {
  conversation: '#3b82f6',
  context: '#8b5cf6',
  preference: '#10b981',
  insight: '#f59e0b',
  decision: '#ef4444',
  fact: '#6366f1'
};

const SOURCE_LABELS: Record<string, string> = {
  writing: '写作',
  translate: '翻译',
  schedule: '日程',
  knowledge: '知识库',
  email: '邮件',
  tools: '工具'
};

const HealthIndicator: React.FC<{ health: CastMemoryStats['memoryHealth'] }> = React.memo(({ health }) => {
  const colors = { good: '#10b981', warning: '#f59e0b', full: '#ef4444' };
  const labels = { good: '健康', warning: '接近上限', full: '已满' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: colors[health],
        boxShadow: `0 0 6px ${colors[health]}60`
      }} />
      <span style={{ color: colors[health], fontSize: 12 }}>{labels[health]}</span>
    </span>
  );
});

interface MemoryCardProps {
  memory: CastMemoryItem;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onImportanceChange: (id: string, value: number) => void;
}

const MemoryCard: React.FC<MemoryCardProps> = React.memo(({
  memory, expanded, onToggle, onDelete, onImportanceChange
}) => {
  const summary = memory.content.length > 120
    ? memory.content.slice(0, 120) + '...'
    : memory.content;

  const timeAgo = useMemo(() => {
    const diff = Date.now() - memory.timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }, [memory.timestamp]);

  return (
    <div className="cast-memory-card" style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }} onClick={onToggle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: `${TYPE_COLORS[memory.type]}20`,
              color: TYPE_COLORS[memory.type],
              fontWeight: 500
            }}>
              {TYPE_LABELS[memory.type]}
            </span>
            <span style={{ fontSize: 11, color: '#666' }}>
              {SOURCE_LABELS[memory.source] || memory.source}
            </span>
            <span style={{ fontSize: 11, color: '#555' }}>{timeAgo}</span>
          </div>

          <p style={{
            margin: 0,
            fontSize: 13,
            color: '#d4d4d4',
            lineHeight: 1.5,
            whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
            overflow: expanded ? 'visible' : 'hidden',
            textOverflow: expanded ? 'clip' : 'ellipsis'
          }}>
            {expanded ? memory.content : summary}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {memory.tags.slice(0, 5).map(tag => (
              <span key={tag} style={{
                fontSize: 10,
                padding: '1px 7px',
                borderRadius: 10,
                background: 'rgba(192,132,252,0.1)',
                color: '#c084fc99',
                border: '1px solid rgba(192,132,252,0.15)'
              }}>
                #{tag}
              </span>
            ))}
            {memory.tags.length > 5 && (
              <span style={{ fontSize: 10, color: '#555' }}>+{memory.tags.length - 5}</span>
            )}
          </div>

          {expanded && memory.metadata && Object.keys(memory.metadata).length > 0 && (
            <div style={{
              marginTop: 10,
              padding: '8px 10px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 6,
              fontSize: 11,
              color: '#888',
              fontFamily: 'monospace'
            }}>
              {Object.entries(memory.metadata).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            background: memory.importance >= 70 ? 'rgba(239,68,68,0.15)' :
                       memory.importance >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
            color: memory.importance >= 70 ? '#ef4444' :
                   memory.importance >= 40 ? '#f59e0b' : '#6b7280'
          }}>
            {memory.importance}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 10,
          paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)'
        }} onClick={(e) => e.stopPropagation()}>
          <button
            className="cast-mem-action-btn"
            onClick={() => onDelete(memory.id)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid #ef444440',
              background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer'
            }}
          >
            删除
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>重要度:</span>
            {[30, 50, 70, 90].map(val => (
              <button
                key={val}
                className="cast-importance-btn"
                onClick={() => onImportanceChange(memory.id, val)}
                style={{
                  width: 26, height: 22, borderRadius: 4,
                  border: memory.importance === val ? '2px solid #c084fc' : '1px solid #3c3c3c',
                  background: memory.importance === val ? 'rgba(192,132,252,0.2)' : 'transparent',
                  color: memory.importance === val ? '#c084fc' : '#888',
                  fontSize: 10, cursor: 'pointer'
                }}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const MemoryPanel: React.FC = () => {
  const {
    memories, searchQuery, filterType,
    setSearchQuery, setFilterType: setFilterType_,
    addMemory, updateMemory, deleteMemory, clearAll,
    searchMemories, getRecentMemories, getContextString,
    loadFromStorage, saveToStorage,
    exportMemories, importMemories,
    clearExpired, compactMemories
  } = useCastMemoryStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [activeTab, setActiveTab] = useState<'memories' | 'soul'>('memories');

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const stats: CastMemoryStats = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayCount = memories.filter(m => m.timestamp >= todayStart.getTime()).length;
    const weekCount = memories.filter(m => m.timestamp >= weekAgo.getTime()).length;

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    memories.forEach(m => {
      byType[m.type] = (byType[m.type] || 0) + 1;
      bySource[m.source] = (bySource[m.source] || 0) + 1;
      m.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    let health: CastMemoryStats['memoryHealth'] = 'good';
    if (memories.length >= 500) health = 'full';
    else if (memories.length >= 400) health = 'warning';

    return { total: memories.length, todayCount, weekCount, byType, bySource, topTags, memoryHealth: health };
  }, [memories]);

  const displayedMemories = useMemo(() => {
    let result: CastMemoryItem[];

    if (searchQuery.trim()) {
      result = searchMemories(searchQuery, 50);
    } else {
      result = [...getRecentMemories(200)];
    }

    if (filterType !== 'all') {
      result = result.filter(m => m.type === filterType);
    }
    if (sourceFilter !== 'all') {
      result = result.filter(m => m.source === sourceFilter);
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [memories, searchQuery, filterType, sourceFilter, searchMemories, getRecentMemories]);

  const handleDelete = useCallback((id: string) => {
    deleteMemory(id);
    if (expandedId === id) setExpandedId(null);
  }, [deleteMemory, expandedId]);

  const handleImportanceChange = useCallback((id: string, value: number) => {
    updateMemory(id, { importance: value });
  }, [updateMemory]);

  const handleImportSubmit = useCallback(() => {
    if (!importText.trim()) return;
    const result = importMemories(importText);
    alert(result.success ? `成功导入 ${result.count} 条记忆` : '导入失败，请检查JSON格式');
    setShowImportDialog(false);
    setImportText('');
  }, [importText, importMemories]);

  const handleClearExpired = useCallback(() => {
    const removed = clearExpired();
    if (removed > 0) {
      alert(`已清理 ${removed} 条过期记忆`);
    } else {
      alert('没有过期记忆需要清理');
    }
  }, [clearExpired]);

  const handleCompact = useCallback(() => {
    const removed = compactMemories(300);
    if (removed > 0) {
      alert(`已压缩，移除 ${removed} 条低优先级记忆`);
    } else {
      alert('无需压缩');
    }
  }, [compactMemories]);

  const handlePromoteLongTerm = useCallback((memory: CastMemoryItem) => {
    updateMemory(memory.id, {
      importance: Math.min(memory.importance + 20, 100),
      expiresAt: undefined
    });
  }, [updateMemory]);

  return (
    <div className="cast-panel-container cast-memory-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e0d0ff' }}>
          🧠 Cast 记忆中心
        </h3>
        <HealthIndicator health={stats.memoryHealth} />
      </div>

      <div style={{
        display: 'flex', gap: 6, marginBottom: 14,
        background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8
      }}>
        {(['memories', 'soul'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
              background: activeTab === tab ? '#c084fc' : 'transparent',
              color: activeTab === tab ? 'white' : '#808080',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'memories' ? '📝 记忆管理' : '✨ 人格设定'}
          </button>
        ))}
      </div>

      {activeTab === 'memories' && (
        <>
          <div className="cast-memory-stats-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14
          }}>
            {[
              { label: '总记忆', value: stats.total, icon: '🧠', color: '#c084fc' },
              { label: '今日新增', value: stats.todayCount, icon: '📅', color: '#10b981' },
              { label: '本周活跃', value: stats.weekCount, icon: '📊', color: '#3b82f6' }
            ].map(card => (
              <div key={card.label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '10px 12px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{card.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#777' }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center'
          }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索记忆内容..."
              style={{
                flex: 1, minWidth: 160,
                padding: '7px 12px', borderRadius: 8, border: '1px solid #3c3c3c',
                background: 'rgba(0,0,0,0.2)', color: '#d4d4d4', fontSize: 12,
                outline: 'none'
              }}
            />

            <select
              value={filterType}
              onChange={(e) => setFilterType_(e.target.value as CastMemoryItemType | 'all')}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid #3c3c3c',
                background: 'rgba(0,0,0,0.2)', color: '#d4d4d4', fontSize: 11,
                outline: 'none', cursor: 'pointer'
              }}
            >
              {(Object.keys(TYPE_LABELS) as Array<keyof typeof TYPE_LABELS>).map(k => (
                <option key={k} value={k}>{TYPE_LABELS[k]}</option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: '7px 8px', borderRadius: 8, border: '1px solid #3c3c3c',
                background: 'rgba(0,0,0,0.2)', color: '#d4d4d4', fontSize: 11,
                outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all">全部来源</option>
              {(Object.keys(SOURCE_LABELS) as Array<CastWorkspaceTab>).map(k => (
                <option key={k} value={k}>{SOURCE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap'
          }}>
            <button onClick={exportMemories} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #3b82f640',
              background: 'transparent', color: '#3b82f6', fontSize: 11, cursor: 'pointer'
            }}>
              📤 导出
            </button>
            <button onClick={() => setShowImportDialog(true)} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #10b98140',
              background: 'transparent', color: '#10b981', fontSize: 11, cursor: 'pointer'
            }}>
              📥 导入
            </button>
            <button onClick={handleClearExpired} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #f59e0b40',
              background: 'transparent', color: '#f59e0b', fontSize: 11, cursor: 'pointer'
            }}>
              🧹 清理过期
            </button>
            <button onClick={handleCompact} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #ef444440',
              background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer'
            }}>
              🗜️ 压缩
            </button>
            <button onClick={() => {
              if (confirm('确定要清空所有记忆吗？')) clearAll();
            }} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #666',
              background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer'
            }}>
              🗑️ 清空全部
            </button>
          </div>

          {stats.topTags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>热门标签:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {stats.topTags.map(({ tag, count }) => (
                  <span key={tag} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(192,132,252,0.08)', color: '#c084fc99',
                    border: '1px solid rgba(192,132,252,0.12)', cursor: 'pointer'
                  }} onClick={() => setSearchQuery(tag)}>
                    #{tag} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            共 {displayedMemories.length} 条记忆
          </div>

          <div className="cast-memory-list">
            {displayedMemories.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 0', color: '#555', fontSize: 13
              }}>
                💭 暂无记忆数据。在 Cast 工作台中使用各功能时，系统会自动记录重要信息。
              </div>
            ) : (
              displayedMemories.map(mem => (
                <MemoryCard
                  key={mem.id}
                  memory={mem}
                  expanded={expandedId === mem.id}
                  onToggle={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
                  onDelete={handleDelete}
                  onImportanceChange={handleImportanceChange}
                />
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'soul' && (
        <SoulEditor />
      )}

      {showImportDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowImportDialog(false)}>
          <div style={{
            background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 12,
            padding: 24, width: '90%', maxWidth: 520, maxHeight: '80vh',
            overflow: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 14px', color: '#e0d0ff', fontSize: 15 }}>
              📥 导入记忆数据
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>
              粘贴之前导出的 JSON 格式记忆数据
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              placeholder='粘贴 JSON 数据...'
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.3)',
                color: '#d4d4d4', fontSize: 12, resize: 'vertical',
                fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowImportDialog(false); setImportText(''); }}
                style={{
                  padding: '7px 18px', borderRadius: 6, border: '1px solid #555',
                  background: 'transparent', color: '#aaa', fontSize: 12, cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleImportSubmit}
                style={{
                  padding: '7px 18px', borderRadius: 6, border: 'none',
                  background: '#10b981', color: 'white', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MemoryPanel);
