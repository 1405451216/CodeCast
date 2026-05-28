import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCastMarketplaceStore } from '../../store/useCastMarketplaceStore';
import type {
  MarketplacePlugin,
  PluginReview
} from '../../utils/cast/cast-marketplace';
import type {
  ICastTool,
  UISchema,
  ToolContext,
  ToolResult,
  Permission
} from '../../types/cast-plugin';
import { castMarketplace, MARKETPLACE_CATEGORIES } from '../../utils/cast/cast-marketplace';
import '../../styles/cast-workspace.css';

function StarRating({ rating, size = 14, interactive = false, onRate }: { rating: number; size?: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.floor(displayRating);
    const halfFilled = !filled && i === Math.ceil(displayRating) && displayRating % 1 >= 0.5;

    let starChar = '\u2606';
    if (filled) starChar = '\u2605';
    else if (halfFilled) starChar = '\u2BD1';

    stars.push(
      <span
        key={i}
        style={{
          fontSize: size,
          color: i <= displayRating ? '#f59e0b' : '#444',
          cursor: interactive ? 'pointer' : 'default',
          transition: 'color 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={() => interactive && setHoverRating(i)}
        onMouseLeave={() => interactive && setHoverRating(0)}
        onClick={() => interactive && onRate?.(i)}
      >
        {starChar}
      </span>
    );
  }

  return <span style={{ display: 'inline-flex', gap: 1 }}>{stars}</span>;
}

interface PluginDetailPanelProps {
  plugin: MarketplacePlugin;
  onClose: () => void;
  onInstall: (plugin: MarketplacePlugin) => Promise<{ success: boolean; errors: string[] }>;
  onUninstall: (pluginId: string) => Promise<boolean>;
  onUpdate: (pluginId: string) => Promise<boolean>;
  onRate: (pluginId: string, rating: number) => void;
  onAddReview: (review: Omit<PluginReview, 'createdAt'>) => void;
}

const PluginDetailPanel: React.FC<PluginDetailPanelProps> = ({ plugin, onClose, onInstall, onUninstall, onUpdate, onRate, onAddReview }) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [selectedTool, setSelectedTool] = useState<ICastTool | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, unknown>>({});
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const reviews = useCastMarketplaceStore(s => s.getReviews(plugin.name));
  const pluginRating = castMarketplace.getPluginRating(plugin.name);
  const isInstalled = !!plugin.localInstallInfo;

  const handleInstall = async () => {
    await onInstall(plugin);
  };

  const handleUninstall = async () => {
    await onUninstall(plugin.name);
  };

  const handleUpdate = async () => {
    await onUpdate(plugin.name);
  };

  const handleSubmitReview = () => {
    if (!reviewTitle.trim()) return;

    onAddReview({
      pluginId: plugin.name,
      userName: '当前用户',
      rating: reviewRating,
      title: reviewTitle,
      content: reviewContent,
      helpful: 0
    });

    setShowReviewForm(false);
    setReviewTitle('');
    setReviewContent('');
    setReviewRating(5);
  };

  const handleTryRunTool = async (tool: ICastTool) => {
    setSelectedTool(tool);
    setToolResult(null);

    if (!tool.uiSchema || tool.uiSchema.length === 0) {
      setIsExecuting(true);
      try {
        const result = await tool.execute({}, {});
        setToolResult(result.success ? result.output : `Error: ${result.error}`);
      } catch (error: any) {
        setToolResult(`Execution failed: ${error.message}`);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const executeToolWithParams = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    try {
      const context: ToolContext = {
        sendMessage: (msg: string) => Promise.resolve(msg)
      };
      const result = await selectedTool.execute(toolParams, context);
      setToolResult(result.success ? result.output : `Error: ${result.error}`);
    } catch (error: any) {
      setToolResult(`Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderFormField = (schema: UISchema, value: unknown, onChange: (name: string, val: unknown) => void): React.ReactNode => {
    switch (schema.type) {
      case 'text':
        return (
          <input
            type="text"
            className="cast-toolbar-select"
            value={(value as string) || ''}
            onChange={(e) => onChange(schema.name, e.target.value)}
            placeholder={schema.placeholder}
            style={{ width: '100%' }}
          />
        );
      case 'textarea':
        return (
          <textarea
            className="cast-editor-textarea"
            value={(value as string) || ''}
            onChange={(e) => onChange(schema.name, e.target.value)}
            placeholder={schema.placeholder}
            style={{ height: '70px', resize: 'vertical' }}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            className="cast-toolbar-select"
            value={(value as number) ?? schema.defaultValue ?? ''}
            onChange={(e) => onChange(schema.name, Number(e.target.value))}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <select
            className="cast-toolbar-select"
            value={(value as string) || ''}
            onChange={(e) => onChange(schema.name, e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Select...</option>
            {(schema.options || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      case 'toggle':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => onChange(schema.name, e.target.checked)}
              style={{ accentColor: '#c084fc', width: 16, height: 16 }}
            />
            <span style={{ fontSize: 12 }}>{(value as boolean) ? 'On' : 'Off'}</span>
          </label>
        );
      case 'json':
        return (
          <textarea
            className="cast-editor-textarea"
            value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
            onChange={(e) => {
              try { onChange(schema.name, JSON.parse(e.target.value)); }
              catch { onChange(schema.name, e.target.value); }
            }}
            placeholder='{"key": "value"}'
            style={{ height: '70px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
          />
        );
      case 'color':
        return (
          <input
            type="color"
            value={(value as string) || (schema.defaultValue as string) || '#c084fc'}
            onChange={(e) => onChange(schema.name, e.target.value)}
            style={{ width: '100%', height: 32, border: '1px solid var(--border-color)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="cast-panel-container" style={{ padding: 0 }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{plugin.tools[0]?.icon || '\uD83D\uDCE6'}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{plugin.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span className="cast-tag">v{plugin.version}</span>
              {plugin.marketplaceMeta.verified && (
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>\u2705 Verified</span>
              )}
            </div>
          </div>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <StarRating rating={pluginRating.average} size={18} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {pluginRating.average} ({pluginRating.count} reviews)
            </span>
          </div>

          <p style={{ margin: '8px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {plugin.description}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 20,
          padding: 12,
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 8
        }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Author</label>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{plugin.author}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</label>
            <div style={{ fontSize: 12 }}>{plugin.marketplaceMeta.category}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>License</label>
            <div style={{ fontSize: 12 }}>{plugin.marketplaceMeta.license}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Size</label>
            <div style={{ fontSize: 12 }}>{plugin.marketplaceMeta.size}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Downloads</label>
            <div style={{ fontSize: 12 }}>{plugin.marketplaceMeta.downloads.toLocaleString()}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Published</label>
            <div style={{ fontSize: 12 }}>{plugin.marketplaceMeta.publishedAt}</div>
          </div>
        </div>

        {plugin.marketplaceMeta.tags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Tags</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {plugin.marketplaceMeta.tags.map(tag => (
                <span key={tag} className="cast-tag">#{tag}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'block' }}>
            Tools ({plugin.tools.length})
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plugin.tools.map((tool: ICastTool) => (
              <div
                key={tool.id}
                style={{
                  padding: '10px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  background: selectedTool?.id === tool.id ? 'rgba(192,132,252,0.1)' : 'rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => handleTryRunTool(tool)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{tool.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{tool.description.slice(0, 50)}...</div>
                    </div>
                  </div>
                  <button
                    className="cast-toolbar-btn active"
                    style={{ fontSize: 10, padding: '4px 10px' }}
                    onClick={(e) => { e.stopPropagation(); handleTryRunTool(tool); }}
                  >
                    Try Run
                  </button>
                </div>

                {selectedTool?.id === tool.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                    {tool.uiSchema && tool.uiSchema.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                        {tool.uiSchema.map((schema: UISchema) => (
                          <div key={schema.name}>
                            <label style={{ fontSize: 11.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                              {schema.label}
                              {schema.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                            </label>
                            {renderFormField(schema, toolParams[schema.name], (name, val) =>
                              setToolParams(prev => ({ ...prev, [name]: val }))
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                        No parameters required. Click "Execute" to run.
                      </p>
                    )}

                    <button
                      className="cast-toolbar-btn active"
                      onClick={executeToolWithParams}
                      disabled={isExecuting}
                      style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
                    >
                      {isExecuting ? 'Running...' : `${tool.icon} Execute ${tool.name}`}
                    </button>

                    {toolResult && (
                      <div style={{
                        marginTop: 10,
                        padding: 12,
                        background: toolResult.includes('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${toolResult.includes('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
                        borderRadius: 8,
                        fontSize: 11.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {toolResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Reviews ({reviews.length})
            </label>
            {!showReviewForm && (
              <button className="cast-toolbar-btn" onClick={() => setShowReviewForm(true)} style={{ fontSize: 10 }}>
                Write Review
              </button>
            )}
          </div>

          {showReviewForm && (
            <div style={{
              padding: 14,
              background: 'rgba(0,0,0,0.15)',
              borderRadius: 8,
              marginBottom: 12
            }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 500, display: 'block', marginBottom: 4 }}>Rating</label>
                <StarRating rating={reviewRating} size={20} interactive onRate={setReviewRating} />
              </div>
              <input
                type="text"
                placeholder="Review title..."
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  marginBottom: 8,
                  boxSizing: 'border-box'
                }}
              />
              <textarea
                placeholder="Your review..."
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '60px',
                  marginBottom: 10,
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="cast-toolbar-btn" onClick={() => setShowReviewForm(false)}>Cancel</button>
                <button
                  className="cast-toolbar-btn active"
                  onClick={handleSubmitReview}
                  disabled={!reviewTitle.trim()}
                >
                  Submit Review
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviews.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                No reviews yet. Be the first to review!
              </p>
            ) : (
              reviews.slice(0, 5).map((review, idx) => (
                <div key={idx} style={{
                  padding: 10,
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  borderLeft: '3px solid #c084fc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>{review.title}</strong>
                    <StarRating rating={review.rating} size={12} />
                  </div>
                  <p style={{ margin: '4px 0', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {review.content}
                  </p>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span>{review.userName}</span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                    <span>Helpful ({review.helpful})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        {!isInstalled ? (
          <button className="cast-toolbar-btn active" onClick={handleInstall}>
            Install Free
          </button>
        ) : (
          <>
            <button className="cast-toolbar-btn" style={{ borderColor: '#10b981', color: '#10b981' }}>
              Installed
            </button>
            {plugin.localInstallInfo?.updateAvailable && (
              <button className="cast-toolbar-btn active" onClick={handleUpdate}>
                Update Available
              </button>
            )}
            <button
              className="cast-toolbar-btn"
              onClick={handleUninstall}
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              Uninstall
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        <button className="cast-toolbar-btn" onClick={() => onRate(plugin.name, 5)}>
          Rate Plugin
        </button>

        {plugin.marketplaceMeta.homepage && (
          <a href={plugin.marketplaceMeta.homepage} target="_blank" rel="noopener noreferrer" className="cast-toolbar-btn" style={{ textDecoration: 'none' }}>
            Homepage
          </a>
        )}
        {plugin.marketplaceMeta.repository && (
          <a href={plugin.marketplaceMeta.repository} target="_blank" rel="noopener noreferrer" className="cast-toolbar-btn" style={{ textDecoration: 'none' }}>
            Repository
          </a>
        )}
      </div>
    </div>
  );
};

const FeaturedCarousel: React.FC<{ plugins: MarketplacePlugin[]; onSelect: (p: MarketplacePlugin) => void }> = ({ plugins, onSelect }) => {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>\u2B50</span>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Featured Plugins</h4>
      </div>
      <div style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
        scrollbarWidth: 'thin'
      }}>
        {plugins.map(plugin => (
          <div
            key={plugin.name}
            className="cast-marketplace-featured-card"
            onClick={() => onSelect(plugin)}
            style={{
              minWidth: 200,
              maxWidth: 220,
              padding: 16,
              background: 'linear-gradient(135deg, rgba(192,132,252,0.08), rgba(139,92,246,0.06))',
              border: '1px solid rgba(192,132,252,0.2)',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{plugin.tools[0]?.icon || '\uD83D\uDCE6'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {plugin.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <StarRating rating={plugin.marketplaceMeta.rating} size={11} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    ({plugin.marketplaceMeta.downloads.toLocaleString()})
                  </span>
                </div>
              </div>
              {plugin.localInstallInfo && (
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10b981',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  Installed
                </span>
              )}
            </div>
            <p style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {plugin.description}
            </p>
            <button
              className="cast-toolbar-btn active"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center', fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onSelect(plugin); }}
            >
              {plugin.localInstallInfo ? 'View Details' : 'Install Free'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PluginCard: React.FC<{
  plugin: MarketplacePlugin;
  viewMode: 'grid' | 'list';
  onClick: (p: MarketplacePlugin) => void;
}> = React.memo(({ plugin, viewMode, onClick }) => {
  const isInstalled = !!plugin.localInstallInfo;
  const hasUpdate = !!plugin.localInstallInfo?.updateAvailable;

  if (viewMode === 'list') {
    return (
      <div
        className="cast-list-item cast-marketplace-plugin-card"
        onClick={() => onClick(plugin)}
        style={{ padding: '12px 14px', borderRadius: 8 }}
      >
        <div className="cast-list-item-icon" style={{ fontSize: 22 }}>{plugin.tools[0]?.icon || '\uD83D\uDCE6'}</div>
        <div className="cast-list-item-content">
          <div className="cast-list-item-title">
            {plugin.name}
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {isInstalled && <span className="cast-tag cast-tag-green" style={{ fontSize: 9 }}>Installed</span>}
              {hasUpdate && <span className="cast-tag cast-tag-yellow" style={{ fontSize: 9 }}>Update</span>}
              {plugin.marketplaceMeta.featured && <span className="cast-tag cast-tag-purple" style={{ fontSize: 9 }}>Featured</span>}
              {plugin.marketplaceMeta.verified && <span style={{ fontSize: 9, color: '#10b981' }}>\u2705</span>}
            </div>
          </div>
          <div className="cast-list-item-subtitle">{plugin.description.slice(0, 80)}...</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 10.5, color: 'var(--text-muted)' }}>
            <StarRating rating={plugin.marketplaceMeta.rating} size={11} />
            <span>{plugin.marketplaceMeta.downloads.toLocaleString()} downloads</span>
            <span>v{plugin.version}</span>
            <span>{plugin.marketplaceMeta.category}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cast-tool-card cast-marketplace-plugin-card"
      onClick={() => onClick(plugin)}
      style={{ position: 'relative' }}
    >
      <div style={{
        position: 'absolute',
        top: 6,
        right: 6,
        display: 'flex',
        gap: 3,
        zIndex: 1
      }}>
        {isInstalled && (
          <span style={{
            fontSize: 8,
            padding: '1px 5px',
            background: 'rgba(16,185,129,0.15)',
            color: '#10b981',
            borderRadius: 4,
            fontWeight: 600
          }}>
            Installed
          </span>
        )}
        {hasUpdate && (
          <span style={{
            fontSize: 8,
            padding: '1px 5px',
            background: 'rgba(245,158,11,0.15)',
            color: '#f59e0b',
            borderRadius: 4,
            fontWeight: 600
          }}>
            Update
          </span>
        )}
      </div>

      <div className="cast-tool-card-icon" style={{ filter: `drop-shadow(0 2px 4px ${(plugin.tools[0]?.color || '#c084fc')}33)` }}>
        {plugin.tools[0]?.icon || '\uD83D\uDCE6'}
      </div>
      <div className="cast-tool-card-name">{plugin.name}</div>
      <div className="cast-tool-card-desc">{plugin.description.slice(0, 45)}...</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <StarRating rating={plugin.marketplaceMeta.rating} size={11} />
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          {plugin.marketplaceMeta.downloads > 1000
            ? `${(plugin.marketplaceMeta.downloads / 1000).toFixed(1)}k`
            : plugin.marketplaceMeta.downloads}
        </span>
      </div>
    </div>
  );
});

PluginCard.displayName = 'PluginCard';

const MarketplacePanel: React.FC = () => {
  const {
    plugins,
    officialPlugins,
    categories,
    selectedCategory,
    searchQuery,
    showInstalledOnly,
    isLoading,
    viewMode,
    selectedPlugin,

    refreshPlugins,
    filterByCategory,
    toggleInstalledFilter,
    setViewMode,
    setSearchQuery,

    install,
    uninstall,
    update,
    ratePlugin,
    addReview,
    getReviews,
    getStats,
    selectPlugin
  } = useCastMarketplaceStore();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshPlugins();
  }, [refreshPlugins]);

  const filteredPlugins = useMemo(() => {
    let result = plugins;

    if (showInstalledOnly) {
      result = result.filter(p => p.localInstallInfo !== undefined);
    }

    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(p => p.marketplaceMeta.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.author.toLowerCase().includes(query) ||
        p.marketplaceMeta.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [plugins, showInstalledOnly, selectedCategory, searchQuery]);

  const featuredPlugins = useMemo(() => {
    return officialPlugins
      .filter(p => p.marketplaceMeta.featured)
      .sort((a, b) => b.marketplaceMeta.rating - a.marketplaceMeta.rating)
      .slice(0, 6);
  }, [officialPlugins]);

  const stats = useMemo(() => getStats(), [filteredPlugins.length, plugins.length]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: plugins.length };
    for (const cat of categories.slice(1)) {
      counts[cat.id] = plugins.filter(p => p.marketplaceMeta.category === cat.id).length;
    }
    return counts;
  }, [plugins, categories]);

  const handleSelectPlugin = useCallback((plugin: MarketplacePlugin) => {
    selectPlugin(plugin);
  }, [selectPlugin]);

  const handleInstall = useCallback(async (plugin: MarketplacePlugin) => {
    const result = await install(plugin);
    if (result.success) {
      showToast(`Successfully installed "${plugin.name}"`);
    } else {
      showToast(`Installation failed: ${result.errors.join(', ')}`);
    }
    return result;
  }, [install]);

  const handleUninstall = useCallback(async (pluginId: string) => {
    const success = await uninstall(pluginId);
    if (success) {
      showToast(`Successfully uninstalled plugin`);
    } else {
      showToast('Failed to uninstall plugin');
    }
    return success;
  }, [uninstall]);

  const handleUpdate = useCallback(async (pluginId: string) => {
    const success = await update(pluginId);
    if (success) {
      showToast(`Plugin updated to latest version`);
    } else {
      showToast('Failed to update plugin');
    }
    return success;
  }, [update]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (selectedPlugin) {
    return (
      <PluginDetailPanel
        plugin={selectedPlugin}
        onClose={() => selectPlugin(null)}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onUpdate={handleUpdate}
        onRate={ratePlugin}
        onAddReview={addReview}
      />
    );
  }

  return (
    <div className="cast-panel-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>\uD83D\uDED2</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Cast Plugin Marketplace</h3>
          <span className="cast-tag">{plugins.length} plugins</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 180,
              padding: '6px 12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              fontSize: 12,
              outline: undefined
            }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 14,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <select
          className="cast-toolbar-select"
          value={selectedCategory || 'all'}
          onChange={(e) => filterByCategory(e.target.value)}
          style={{ minWidth: 120 }}
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name} ({categoryCounts[cat.id] || 0})</option>
          ))}
        </select>

        <button
          className={`cast-toolbar-btn ${showInstalledOnly ? 'active' : ''}`}
          onClick={toggleInstalledFilter}
        >
          {showInstalledOnly ? '\u2705 Installed Only' : 'Show Installed Only'}
        </button>

        <button className="cast-toolbar-btn" onClick={() => refreshPlugins()} disabled={isLoading}>
          {isLoading ? 'Loading...' : '\uD83D\uDD04 Refresh'}
        </button>

        <div style={{ flex: 1 }} />

        <button
          className={`cast-toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          {viewMode === 'grid' ? '\u25A8 Grid View' : '\u25B9 List View'}
        </button>
      </div>

      <FeaturedCarousel plugins={featuredPlugins} onSelect={handleSelectPlugin} />

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, minHeight: 300 }}>
        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: 12 }}>
          <label style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 8,
            display: 'block'
          }}>
            Categories
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`cast-list-item ${selectedCategory === cat.id ? 'active' : ''}`}
                style={{
                  padding: '8px 10px',
                  border: 'none',
                  background: selectedCategory === cat.id ? 'rgba(192,132,252,0.15)' : 'transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  color: selectedCategory === cat.id ? '#c084fc' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onClick={() => filterByCategory(cat.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </span>
                {categoryCounts[cat.id] > 0 && (
                  <span className="cast-tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {categoryCounts[cat.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          {filteredPlugins.length === 0 ? (
            <div className="cast-empty-state">
              <div className="cast-empty-icon">\uD83D\uDD0D</div>
              <h4>No plugins found</h4>
              <p>Try adjusting your search or filters</p>
              <p className="hint">Tip: Browse featured plugins above</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'cast-card-grid' : ''} style={
              viewMode === 'list'
                ? { display: 'flex', flexDirection: 'column', gap: 4 }
                : undefined
            }>
              {filteredPlugins.map(plugin => (
                <PluginCard
                  key={plugin.name}
                  plugin={plugin}
                  viewMode={viewMode}
                  onClick={handleSelectPlugin}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
        fontSize: 11.5,
        color: 'var(--text-muted)'
      }}>
        <span><strong style={{ color: 'var(--text-secondary)' }}>{stats.installedCount}</strong> installed</span>
        <span><strong style={{ color: '#f59e0b' }}>{stats.updateAvailableCount}</strong> updates available</span>
        <span><strong style={{ color: '#f59e0b' }}>
          {plugins.length > 0
            ? (plugins.reduce((sum, p) => sum + p.marketplaceMeta.rating, 0) / plugins.length).toFixed(1)
            : '0.0'}
        </strong> avg rating</span>
        <span><strong style={{ color: 'var(--text-secondary)' }}>{stats.totalPlugins}</strong> total</span>
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: toastMessage.includes('fail') || toastMessage.includes('Failed')
            ? 'rgba(239,68,68,0.95)'
            : 'rgba(16,185,129,0.95)',
          color: 'white',
          borderRadius: 8,
          fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 2000,
          whiteSpace: 'nowrap'
        }}>
          {toastMessage}
          <button
            onClick={() => setToastMessage(null)}
            style={{
              marginLeft: 12,
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              opacity: 0.8
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(MarketplacePanel);
