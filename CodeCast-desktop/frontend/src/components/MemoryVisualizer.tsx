import React, { useState, useMemo, useCallback } from 'react';
import { useMemoryStore } from '../store/useMemoryStore';

interface MemoryVisualizerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({ isOpen = true, onClose }) => {
  const {
    memories,
    statistics,
    filters,
    setFilter,
    fetchMemories,
    deleteMemory,
    exportMemories,
    clearExpired
  } = useMemoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; message: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} });
  const [notification, setNotification] = useState<string | null>(null);

  const filteredMemories = useMemo(() => {
    let filtered = memories;

    if (searchQuery) {
      filtered = filtered.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(m =>
        filters.tags?.some(tag => m.tags.includes(tag))
      );
    }

    if (filters.source) {
      filtered = filtered.filter(m => m.source === filters.source);
    }

    return filtered.sort((a, b) => b.relevance - a.relevance);
  }, [memories, searchQuery, filters]);

  const tagCloudData = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    memories.forEach(memory => {
      memory.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [memories]);

  const activityChartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const chartData = days.map((day, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - ((today.getDay() + 6) % 7) + index);

      const dayMemories = memories.filter(m => {
        const memoryDate = new Date(m.timestamp);
        return (
          memoryDate.getDate() === date.getDate() &&
          memoryDate.getMonth() === date.getMonth() &&
          memoryDate.getFullYear() === date.getFullYear()
        );
      });

      return {
        day,
        count: dayMemories.length,
        maxCount: Math.max(...days.map(d => {
          const dDate = new Date(today);
          dDate.setDate(dDate.getDate() - ((today.getDay() + 6) % 7) + days.indexOf(d));
          return memories.filter(m => {
            const mDate = new Date(m.timestamp);
            return (
              mDate.getDate() === dDate.getDate() &&
              mDate.getMonth() === dDate.getMonth() &&
              mDate.getFullYear() === dDate.getFullYear()
            );
          }).length;
        }), 1)
      };
    });

    return chartData;
  }, [memories]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setFilter('tags', filters.tags?.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...(filters.tags || []), tag]
    );
  }, [filters.tags, setFilter]);

  const handleExportClick = useCallback(async () => {
    try {
      await exportMemories();
      setNotification('记忆已导出');
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('导出失败:', error);
      setNotification('导出失败');
      setTimeout(() => setNotification(null), 3000);
    }
  }, [exportMemories]);

  const handleClearExpiredClick = useCallback(async () => {
    setConfirmDialog({
      open: true,
      message: '确定要清理过期记忆吗？',
      onConfirm: async () => {
        try {
          await clearExpired();
          setNotification('已清理过期记忆');
          setTimeout(() => setNotification(null), 3000);
        } catch (error) {
          console.error('清理失败:', error);
          setNotification('清理失败');
          setTimeout(() => setNotification(null), 3000);
        }
      }
    });
  }, [clearExpired]);

  if (!isOpen) return null;

  // TODO: Replace inline styles with CSS classes to match app styling conventions.
  // The extensive inline styles below are inconsistent with the rest of the app
  // which uses CSS custom properties and class-based styling.
  return (
    <div className="memory-visualizer" style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      height: '100vh',
      backgroundColor: 'var(--bg-primary, #ffffff)',
      borderLeft: '1px solid var(--border-color, #e5e5e5)',
      boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.1)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <header className="memory-header" style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color, #e5e5e5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary, #f8f9fa)'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary, #1a1a1a)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🧠 情景记忆面板
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary, #666)',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(0,0,0,0.05))';
              e.currentTarget.style.color = 'var(--text-primary, #1a1a1a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary, #666)';
            }}
          >
            ×
          </button>
        )}
      </header>

      <div className="memory-content" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px'
      }}>
        <section className="memory-stats" style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: 'var(--bg-secondary, #f8f9fa)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e5e5e5)'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-secondary, #666)'
          }}>
            📊 记忆统计卡片
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: 'var(--bg-primary, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e5e5)'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--accent, #7c7cff)'
              }}>
                {statistics.totalCount}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #666)',
                marginTop: '4px'
              }}>
                总记忆数
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: 'var(--bg-primary, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e5e5)'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--success, #10b981)'
              }}>
                +{statistics.todayCount}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #666)',
                marginTop: '4px'
              }}>
                今日新增
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '12px',
              backgroundColor: 'var(--bg-primary, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e5e5)'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--warning, #f59e0b)'
              }}>
                {statistics.retentionRate}%
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #666)',
                marginTop: '4px'
              }}>
                7天留存率
              </div>
            </div>
          </div>
        </section>

        <section className="memory-search" style={{
          marginBottom: '20px'
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="🔍 搜索记忆内容或标签..."
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid var(--border-color, #e5e5e5)',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary, #ffffff)',
              color: 'var(--text-primary, #1a1a1a)',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent, #7c7cff)';
              e.target.style.boxShadow = '0 0 0 3px rgba(124, 124, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color, #e5e5e5)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </section>

        <section className="recent-memories" style={{
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-secondary, #666)'
          }}>
            🔍 最近召回的记忆
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {filteredMemories.slice(0, 10).map((memory) => (
              <div
                key={memory.id}
                onClick={() => setSelectedMemory(selectedMemory === memory.id ? null : memory.id)}
                style={{
                  padding: '12px',
                  backgroundColor: selectedMemory === memory.id
                    ? 'var(--accent-light, rgba(124, 124, 255, 0.1))'
                    : 'var(--bg-secondary, #f8f9fa)',
                  borderRadius: '8px',
                  border: `1px solid ${selectedMemory === memory.id ? 'var(--accent, #7c7cff)' : 'var(--border-color, #e5e5e5)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-primary, #1a1a1a)',
                  marginBottom: '8px',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {memory.type === 'conversation' ? '💬' : '📁'} "{memory.content.slice(0, 100)}..."
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-dim, #999)',
                  marginBottom: '8px'
                }}>
                  来源: {memory.source} · {new Date(memory.timestamp).toLocaleDateString()}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary, #666)' }}>相关度:</span>
                    <div style={{
                      width: '80px',
                      height: '6px',
                      backgroundColor: 'var(--border-color, #e5e5e5)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${memory.relevance}%`,
                        height: '100%',
                        backgroundColor: 'var(--accent, #7c7cff)',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary, #666)' }}>
                      {Math.round(memory.relevance)}%
                    </span>
                  </div>
                  {selectedMemory === memory.id && (
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`#session-${memory.sessionId}`, '_blank');
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: '1px solid var(--accent, #7c7cff)',
                          backgroundColor: 'transparent',
                          color: 'var(--accent, #7c7cff)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        查看原文
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMemory(memory.id);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: '1px solid var(--error, #ef4444)',
                          backgroundColor: 'transparent',
                          color: 'var(--error, #ef4444)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredMemories.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-dim, #999)',
                fontSize: '14px'
              }}>
                暂无匹配的记忆
              </div>
            )}
          </div>
        </section>

        <section className="tag-cloud" style={{
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-secondary, #666)'
          }}>
            🏷️ 热门标签云
          </h3>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {(() => {
              const maxCount = Math.max(...tagCloudData.map(t => t.count));
              const minCount = Math.min(...tagCloudData.map(t => t.count));
              return tagCloudData.map(({ tag, count }) => {
              const fontSize = 12 + ((count - minCount) / (maxCount - minCount || 1)) * 8;

              return (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  style={{
                    padding: '4px 10px',
                    fontSize: `${fontSize}px`,
                    border: `1px solid ${filters.tags?.includes(tag) ? 'var(--accent, #7c7cff)' : 'var(--border-color, #e5e5e5)'}`,
                    backgroundColor: filters.tags?.includes(tag) ? 'var(--accent-light, rgba(124, 124, 255, 0.1))' : 'var(--bg-secondary, #f8f9fa)',
                    color: filters.tags?.includes(tag) ? 'var(--accent, #7c7cff)' : 'var(--text-primary, #1a1a1a)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 500
                  }}
                  onMouseEnter={(e) => {
                    if (!filters.tags?.includes(tag)) {
                      e.currentTarget.style.borderColor = 'var(--accent, #7c7cff)';
                      e.currentTarget.style.backgroundColor = 'var(--accent-light, rgba(124, 124, 255, 0.05))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!filters.tags?.includes(tag)) {
                      e.currentTarget.style.borderColor = 'var(--border-color, #e5e5e5)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #f8f9fa)';
                    }
                  }}
                >
                  #{tag}
                </button>
              );
            })})()}
          </div>
        </section>

        <section className="activity-chart" style={{
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-secondary, #666)'
          }}>
            📈 记忆活跃度图表（近7天）
          </h3>
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--bg-secondary, #f8f9fa)',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #e5e5e5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              height: '120px',
              marginBottom: '8px'
            }}>
              {activityChartData.map(({ day, count, maxCount }) => {
                const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div
                    key={day}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: `${heightPercent}%`,
                      minHeight: count > 0 ? '8px' : '0',
                      backgroundColor: 'var(--accent, #7c7cff)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                    title={`${day}: ${count} 条记忆`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-hover, #6b6bef)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent, #7c7cff)';
                    }}
                    >
                      {count > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '-20px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '10px',
                          color: 'var(--text-secondary, #666)',
                          whiteSpace: 'nowrap'
                        }}>
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              fontSize: '11px',
              color: 'var(--text-dim, #999)'
            }}>
              {activityChartData.map(({ day }) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="memory-footer" style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color, #e5e5e5)',
        backgroundColor: 'var(--bg-secondary, #f8f9fa)',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={handleClearExpiredClick}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: '1px solid var(--error, #ef4444)',
            backgroundColor: 'transparent',
            color: 'var(--error, #ef4444)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          🗑 清理过期记忆
        </button>
        <button
          onClick={handleExportClick}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: '1px solid var(--accent, #7c7cff)',
            backgroundColor: 'transparent',
            color: 'var(--accent, #7c7cff)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(124, 124, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          📤 导出全部
        </button>
        <button
          onClick={() => {
            fetchMemories();
            setNotification('记忆已刷新');
            setTimeout(() => setNotification(null), 2000);
          }}
          title="刷新记忆"
          style={{
            padding: '10px 12px',
            border: '1px solid var(--border-color, #e5e5e5)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary, #666)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(0,0,0,0.05))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ⚙
        </button>
      </footer>

      {/* Inline Confirm Dialog */}
      {confirmDialog.open && (
        <div className="confirm-dialog-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001
        }}>
          <div style={{
            background: 'var(--bg-primary, #fff)', borderRadius: '12px',
            padding: '24px', maxWidth: '360px', width: '90%',
            boxShadow: '0 16px 32px rgba(0,0,0,0.2)'
          }}>
            <p style={{ margin: '0 0 16px', fontSize: '15px', color: 'var(--text-primary, #1a1a1a)' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDialog({ open: false, message: '', onConfirm: () => {} })} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color, #e5e5e5)', cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ open: false, message: '', onConfirm: () => {} }); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent, #7c7cff)', color: '#fff', cursor: 'pointer' }}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #1a1a1a)',
          padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 10001, fontSize: '14px'
        }}>
          {notification}
        </div>
      )}
    </div>
  );
};

export default React.memo(MemoryVisualizer);