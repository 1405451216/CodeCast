import React, { useMemo, useState } from 'react';
import { useAppStore, AppState } from '../../store';
import type { CastTool } from '../../store/useToolsStore';
import EmptyState from './EmptyState';

interface ToolListProps {
  onPick?: (tool: CastTool) => void;
}

interface CategoryMeta {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  writing:     { icon: '✍️', label: '写作',   color: '#1890ff', bg: '#e6f7ff' },
  translation: { icon: '🌐', label: '翻译',   color: '#52c41a', bg: '#f6ffed' },
  knowledge:   { icon: '📚', label: '知识库', color: '#722ed1', bg: '#f9f0ff' },
  email:       { icon: '📧', label: '邮件',   color: '#fa541c', bg: '#fff2e8' },
  schedule:    { icon: '📅', label: '日程',   color: '#13c2c2', bg: '#e6fffb' },
  todo:        { icon: '✅', label: '待办',   color: '#52c41a', bg: '#f6ffed' },
  misc:        { icon: '🧰', label: '工具箱', color: '#2f54eb', bg: '#e6ebff' },
  plugin:      { icon: '🔌', label: '插件',   color: '#9254de', bg: '#f4e9ff' },
  sandbox:     { icon: '🧪', label: '沙箱',   color: '#eb2f96', bg: '#fff0f6' },
  memory:      { icon: '🧠', label: '记忆',   color: '#1890ff', bg: '#e6f7ff' },
  perf:        { icon: '📊', label: '性能',   color: '#fa8c16', bg: '#fff7e6' },
  learning:    { icon: '💡', label: '学习',   color: '#fadb14', bg: '#fffbe6' },
  security:    { icon: '🔒', label: '安全',   color: '#f5222d', bg: '#fff1f0' },
  channel:     { icon: '📡', label: '通知',   color: '#fa541c', bg: '#fff2e8' },
  collab:      { icon: '🤝', label: '协作',   color: '#2f54eb', bg: '#e6ebff' },
  soul:        { icon: '🎭', label: '人格',   color: '#722ed1', bg: '#f9f0ff' },
  marketplace: { icon: '🏪', label: '市场',   color: '#13c2c2', bg: '#e6fffb' },
};

const PREFERRED_ORDER = [
  'writing', 'translation', 'knowledge', 'email', 'schedule', 'todo', 'misc',
  'plugin', 'sandbox', 'memory', 'perf', 'learning', 'security', 'channel',
  'collab', 'soul', 'marketplace',
];

/**
 * ToolList 展示所有可用的 AP Tool（按类别分组）。
 * - 类别顺序按 PREFERRED_ORDER 固定
 * - 每个工具一行：图标 + 名称 + 描述
 * - 搜索框过滤
 * - 点击触发 onPick（默认行为：注入到对话输入框）
 */
export const ToolList: React.FC<ToolListProps> = ({ onPick }) => {
  const catalog = useAppStore((s: AppState) => (s as any).catalog) as CastTool[];
  const setActiveTool = useAppStore((s: AppState) => (s as any).setActiveTool) as (id: string | null) => void;
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CastTool[]>();
    for (const t of filtered) {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    }
    // 按 PREFERRED_ORDER 排序，未知类别追加到末尾
    const known = PREFERRED_ORDER.filter((c) => map.has(c));
    const unknown = Array.from(map.keys()).filter((c) => !PREFERRED_ORDER.includes(c)).sort();
    return [...known, ...unknown].map((c) => [c, map.get(c)!] as [string, CastTool[]]);
  }, [filtered]);

  if (!catalog || catalog.length === 0) {
    return (
      <EmptyState
        icon="🧰"
        title="工具目录为空"
        hint="后端尚未注册 Cast Tools，或 Wails 绑定尚未生成"
      />
    );
  }

  return (
    <div className="tool-list">
      {/* 搜索框 */}
      <div className="tool-list-search">
        <span className="tool-list-search-icon">🔍</span>
        <input
          type="text"
          placeholder="搜索工具..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tool-list-search-input"
        />
        {search && (
          <button
            className="tool-list-search-clear"
            onClick={() => setSearch('')}
            title="清空"
          >
            ✕
          </button>
        )}
      </div>

      {/* 类别分组 */}
      {grouped.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="未找到匹配工具"
          hint={`没有工具名/描述包含 "${search}"`}
        />
      ) : (
        grouped.map(([category, tools]) => {
          const meta = CATEGORY_META[category] || { icon: '🔧', label: category, color: '#8c8c8c', bg: '#f5f5f5' };
          return (
            <div key={category} className="tool-list-group">
              <div className="tool-list-group-title">
                <span
                  className="tool-list-group-icon"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.icon}
                </span>
                <span className="tool-list-group-label">{meta.label}</span>
                <span className="tool-list-group-count">{tools.length}</span>
              </div>
              <div className="tool-list-items">
                {tools.map((t) => (
                  <div
                    key={t.name}
                    className="tool-list-item"
                    onClick={() => {
                      setActiveTool(t.name);
                      onPick?.(t);
                    }}
                    role="button"
                    tabIndex={0}
                    title={t.description}
                  >
                    <div className="tool-list-item-name">
                      <code>{t.name}</code>
                    </div>
                    <div className="tool-list-item-desc">{t.description}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ToolList;
