import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CastToolRegistry,
  bootstrapBuiltinCastTools
} from '../../tools/CastToolRegistry';
import {
  pluginLoader,
  type PluginSource
} from '../../utils/cast/plugin-loader';
import type {
  ICastTool,
  CastToolCategory,
  CastPluginManifest,
  UISchema,
  ToolContext,
  ToolResult
} from '../../types/cast-plugin';
import MarketplacePanel from './MarketplacePanel';
import '../../styles/cast-workspace.css';

interface CategoryDef {
  key: CastToolCategory | 'all';
  label: string;
  icon: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'analysis', label: '分析', icon: '📊' },
  { key: 'meeting', label: '会议', icon: '📝' },
  { key: 'management', label: '管理', icon: '📋' },
  { key: 'utility', label: '实用', icon: '⚙️' },
  { key: 'creative', label: '创意', icon: '💡' },
  { key: 'communication', label: '沟通', icon: '💬' },
  { key: 'productivity', label: '效率', icon: '⚡' },
  { key: 'custom', label: '自定义', icon: '🎯' }
];

type TabType = 'installed' | 'builtin' | 'thirdparty' | 'marketplace';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'installed', label: '已安装', icon: '\uD83D\uDCE6' },
  { key: 'marketplace', label: '插件市场', icon: '\uD83D\uDED2' },
  { key: 'builtin', label: '内置', icon: '\uD83D\uDD27' },
  { key: 'thirdparty', label: '第三方', icon: '\uD83C\uDF0F' }
];

interface ToolDetailProps {
  tool: ICastTool;
  onClose: () => void;
  onExecute?: (toolId: string) => void;
}

const ToolDetailPanel: React.FC<ToolDetailProps> = ({ tool, onClose, onExecute }) => {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleParamChange = useCallback((name: string, value: unknown) => {
    setParams(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!onExecute) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const context: ToolContext = {};
      const execResult = await tool.execute(params, context);

      setResult(execResult.success ? execResult.output : `❌ 错误: ${execResult.error}`);
      onExecute(tool.id);
    } catch (error: any) {
      setResult(`❌ 执行失败: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [tool, params, onExecute]);

  return (
    <div className="cast-panel-container" style={{ padding: 0 }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{tool.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{tool.name}</h3>
            <span className="cast-tag" style={{ marginTop: 2, display: 'inline-block' }}>v{tool.version}</span>
          </div>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>描述</label>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{tool.description}</p>
        </div>

        {tool.tags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>标签</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tool.tags.map(tag => (
                <span key={tag} className="cast-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {tool.permissions && tool.permissions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>所需权限</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tool.permissions.map(perm => (
                <span key={perm} className={`cast-tag cast-tag-${perm === 'write' ? 'red' : perm === 'read' ? 'blue' : perm === 'execute' || perm === 'network' || perm === 'filesystem' ? 'yellow' : 'purple'}`}>
                  {perm}
                </span>
              ))}
            </div>
          </div>
        )}

        {tool.dependencies && tool.dependencies.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>依赖项</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tool.dependencies.map(depId => {
                const depAvailable = CastToolRegistry.has(depId);
                return (
                  <div key={depId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span>{depAvailable ? '✅' : '⚠️'}</span>
                    <span style={{ color: depAvailable ? 'var(--text-secondary)' : '#f59e0b' }}>{depId}</span>
                    {!depAvailable && <span style={{ fontSize: 10, color: '#f59e0b' }}>(未安装)</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tool.metadata && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>元信息</label>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>作者: <strong>{tool.author}</strong></div>
              {tool.metadata.homepage && <div><a href={tool.metadata.homepage} target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc' }}>主页</a></div>}
              {tool.metadata.repository && <div><a href={tool.metadata.repository} target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc' }}>代码仓库</a></div>}
              {tool.metadata.license && <div>许可证: {tool.metadata.license}</div>}
            </div>
          </div>
        )}

        {tool.uiSchema && tool.uiSchema.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'block' }}>参数配置</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tool.uiSchema.map((schema: UISchema) => (
                <div key={schema.name}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    {schema.label}
                    {schema.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                  </label>
                  {schema.description && (
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-muted)' }}>{schema.description}</p>
                  )}
                  {renderFormField(schema, params[schema.name], handleParamChange)}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className="cast-toolbar-btn active"
          onClick={handleExecute}
          disabled={isExecuting}
          style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 13 }}
        >
          {isExecuting ? '⏳ 执行中...' : `${tool.icon} 执行工具`}
        </button>

        {result && (
          <div style={{
            marginTop: 16,
            padding: 14,
            background: result.includes('❌') ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
            border: `1px solid ${result.includes('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: 8,
            fontSize: 12.5,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
};

function renderFormField(
  schema: UISchema,
  value: unknown,
  onChange: (name: string, val: unknown) => void
): React.ReactNode {
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
          style={{ height: '80px', resize: 'vertical' }}
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
          <option value="">请选择...</option>
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
          <span style={{ fontSize: 12 }}>{(value as boolean) ? '开启' : '关闭'}</span>
        </label>
      );

    case 'json':
      return (
        <textarea
          className="cast-editor-textarea"
          value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
          onChange={(e) => {
            try {
              onChange(schema.name, JSON.parse(e.target.value));
            } catch {
              onChange(schema.name, e.target.value);
            }
          }}
          placeholder='{"key": "value"}'
          style={{ height: '80px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
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

    case 'slider':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="range"
            value={(value as number) ?? schema.defaultValue ?? (schema.min || 0)}
            onChange={(e) => onChange(schema.name, Number(e.target.value))}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, minWidth: 40, textAlign: 'right', color: 'var(--text-secondary)' }}>
            {(value as number) ?? schema.defaultValue ?? 0}
          </span>
        </div>
      );

    default:
      return null;
  }
}

const PluginManagerPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('installed');
  const [selectedCategory, setSelectedCategory] = useState<CastToolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<ICastTool | null>(null);
  const [tools, setTools] = useState<ICastTool[]>([]);
  const [plugins, setPlugins] = useState<CastPluginManifest[]>([]);
  const [loadedSources, setLoadedSources] = useState<Map<string, PluginSource>>(new Map());
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUninstallConfirm, setShowUninstallConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState('');
  const [usageStats, setUsageStats] = useState<Record<string, number>>({});

  useEffect(() => {
    bootstrapBuiltinCastTools();
    pluginLoader.loadPluginSources();
    refreshData();

    const unsubscribe = CastToolRegistry.subscribe(refreshData);
    return unsubscribe;
  }, []);

  const refreshData = useCallback(() => {
    setTools(CastToolRegistry.getAll());
    setPlugins(CastToolRegistry.getPlugins());
    setLoadedSources(pluginLoader.getLoadedPlugins());
    setUsageStats(CastToolRegistry.getUsageStats() as Record<string, number>);
  }, []);

  const filteredTools = useMemo(() => {
    let filtered = tools;

    if (activeTab === 'builtin') {
      filtered = filtered.filter(t => t.author === 'CodeCast Built-in');
    } else if (activeTab === 'thirdparty') {
      filtered = filtered.filter(t => t.author !== 'CodeCast Built-in');
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.id.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [tools, activeTab, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    for (const cat of CATEGORIES.slice(1)) {
      if (cat.key !== 'all') {
        counts[cat.key] = tools.filter(t => t.category === cat.key).length;
      }
    }
    return counts;
  }, [tools]);

  const handleInstallFromUrl = useCallback(async () => {
    if (!urlInput.trim()) return;

    setIsLoading(true);
    setLoadMessage('');

    try {
      const result = await pluginLoader.loadFromUrl(urlInput.trim());

      if (result.errors.length > 0) {
        setLoadMessage(`⚠️ 加载遇到问题:\n${result.errors.join('\n')}`);
      } else {
        setLoadMessage(`✅ 成功安装插件 "${result.plugin.name}"，包含 ${result.tools.length} 个工具`);
        refreshData();
      }
    } catch (error: any) {
      setLoadMessage(`❌ 安装失败: ${error.message}`);
    } finally {
      setIsLoading(false);
      setShowUrlDialog(false);
      setUrlInput('');
    }
  }, [urlInput, refreshData]);

  const handleUninstallPlugin = useCallback(async (pluginName: string) => {
    const success = await pluginLoader.unloadPlugin(pluginName);

    if (success) {
      refreshData();
    }

    setShowUninstallConfirm(null);
  }, [refreshData]);

  const handleTogglePlugin = useCallback((pluginName: string, currentEnabled: boolean) => {
    if (currentEnabled) {
      pluginLoader.disablePlugin(pluginName);
    } else {
      pluginLoader.enablePlugin(pluginName);
    }
    refreshData();
  }, [refreshData]);

  const handleToolExecute = useCallback((toolId: string) => {
    CastToolRegistry.incrementUsage(toolId);
    setUsageStats(CastToolRegistry.getUsageStats() as Record<string, number>);
  }, []);

  const handleInstallLocal = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = pluginLoader.loadFromManifest(text);

        if (result.errors.length > 0) {
          alert(`加载失败:\n${result.errors.join('\n')}`);
        } else {
          alert(`✅ 成功安装插件 "${result.plugin.name}"`);
          refreshData();
        }
      } catch (error: any) {
        alert(`读取文件失败: ${error.message}`);
      }
    };
    input.click();
  }, [refreshData]);

  if (selectedTool) {
    return (
      <ToolDetailPanel
        tool={selectedTool}
        onClose={() => setSelectedTool(null)}
        onExecute={handleToolExecute}
      />
    );
  }

  if (activeTab === 'marketplace') {
    return <MarketplacePanel />;
  }

  return (
    <div className="cast-panel-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🧩</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Cast 工具与插件中心</h3>
          <span className="cast-tag">已加载: {tools.length}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 搜索工具..."
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
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`cast-toolbar-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, minHeight: 400 }}>
        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>分类筛选</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className={`cast-list-item ${selectedCategory === cat.key ? 'active' : ''}`}
                style={{
                  padding: '8px 10px',
                  border: 'none',
                  background: selectedCategory === cat.key ? 'rgba(192,132,252,0.15)' : 'transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  color: selectedCategory === cat.key ? '#c084fc' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onClick={() => setSelectedCategory(cat.key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </span>
                {categoryCounts[cat.key] > 0 && (
                  <span className="cast-tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {categoryCounts[cat.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          {filteredTools.length === 0 ? (
            <div className="cast-empty-state">
              <div className="cast-empty-icon">🔍</div>
              <h4>没有找到匹配的工具</h4>
              <p>尝试调整搜索条件或分类筛选</p>
              <p className="hint">提示：可以点击下方按钮安装新插件</p>
            </div>
          ) : (
            <div className="cast-card-grid">
              {filteredTools.map(tool => {
                const usageCount = usageStats[tool.id] || 0;
                const sourceInfo = Array.from(loadedSources.values()).find(s =>
                  plugins.some(p => p.tools.some(t => t.id === tool.id))
                );
                const isThirdParty = tool.author !== 'CodeCast Built-in';

                return (
                  <div
                    key={tool.id}
                    className="cast-tool-card"
                    onClick={() => setSelectedTool(tool)}
                    style={{ position: 'relative' }}
                  >
                    {isThirdParty && (
                      <span style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        fontSize: 9,
                        padding: '1px 5px',
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                        borderRadius: 4,
                        fontWeight: 600
                      }}>
                        第三方
                      </span>
                    )}
                    <div className="cast-tool-card-icon" style={{ filter: `drop-shadow(0 2px 4px ${tool.color}33)` }}>
                      {tool.icon}
                    </div>
                    <div className="cast-tool-card-name">{tool.name}</div>
                    <div className="cast-tool-card-desc">{tool.description.slice(0, 50)}...</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span className="cast-tag cast-tag-purple" style={{ fontSize: 9, padding: '1px 5px' }}>
                        {tool.category}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>v{tool.version}</span>
                      {usageCount > 0 && (
                        <span style={{ fontSize: 9, color: '#10b981' }}>使用 {usageCount} 次</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button className="cast-toolbar-btn active" onClick={handleInstallLocal}>
          ➕ 安装本地插件
        </button>
        <button className="cast-toolbar-btn active" onClick={() => setShowUrlDialog(true)}>
          🌐 从URL安装
        </button>
        <button className="cast-toolbar-btn">
          📦 插件文档
        </button>
      </div>

      {plugins.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>
            已安装的插件 ({plugins.length})
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plugins.map(plugin => {
              const source = loadedSources.get(plugin.name);
              const isEnabled = source?.enabled !== false;

              return (
                <div
                  key={plugin.name}
                  className="cast-list-item"
                  style={{ padding: '10px 14px', borderRadius: 8 }}
                >
                  <div className="cast-list-item-icon">📦</div>
                  <div className="cast-list-item-content">
                    <div className="cast-list-item-title">
                      {plugin.name}
                      <span className="cast-tag cast-tag-blue" style={{ marginLeft: 8, fontSize: 10 }}>
                        v{plugin.version}
                      </span>
                    </div>
                    <div className="cast-list-item-subtitle">
                      {plugin.description.slice(0, 60)}... · {plugin.tools.length} 个工具
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: isEnabled ? '#10b981' : 'var(--text-muted)'
                    }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleTogglePlugin(plugin.name, isEnabled)}
                        style={{ accentColor: '#10b981', width: 14, height: 14 }}
                      />
                      {isEnabled ? '启用' : '禁用'}
                    </label>
                    {showUninstallConfirm === plugin.name ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#ef4444' }}>确认卸载?</span>
                        <button
                          className="cast-toolbar-btn"
                          onClick={() => handleUninstallPlugin(plugin.name)}
                          style={{ fontSize: 10, padding: '3px 8px', borderColor: '#ef4444', color: '#ef4444' }}
                        >
                          确认
                        </button>
                        <button
                          className="cast-toolbar-btn"
                          onClick={() => setShowUninstallConfirm(null)}
                          style={{ fontSize: 10, padding: '3px 8px' }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        className="cast-toolbar-btn"
                        onClick={() => setShowUninstallConfirm(plugin.name)}
                        style={{ fontSize: 10, padding: '3px 8px', borderColor: '#ef4444', color: '#ef4444' }}
                      >
                        卸载
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUrlDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={(e) => e.target === e.currentTarget && setShowUrlDialog(false)}>
          <div style={{
            background: 'var(--bg-secondary, #252526)',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 480,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🌐 从URL安装插件</h3>
            <input
              type="url"
              placeholder="输入插件的 manifest.json URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstallFromUrl()}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="cast-toolbar-btn" onClick={() => setShowUrlDialog(false)}>
                取消
              </button>
              <button
                className="cast-toolbar-btn active"
                onClick={handleInstallFromUrl}
                disabled={!urlInput.trim() || isLoading}
              >
                {isLoading ? '⏳ 安装中...' : '✅ 确认安装'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadMessage && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 20px',
          background: loadMessage.includes('✅') ? 'rgba(16,185,129,0.95)' : 'rgba(245,158,11,0.95)',
          color: 'white',
          borderRadius: 8,
          fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 2000,
          whiteSpace: 'pre-line',
          maxWidth: '80%',
          textAlign: 'center'
        }}>
          {loadMessage}
          <button
            onClick={() => setLoadMessage('')}
            style={{
              marginLeft: 12,
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: 16,
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

export default React.memo(PluginManagerPanel);
