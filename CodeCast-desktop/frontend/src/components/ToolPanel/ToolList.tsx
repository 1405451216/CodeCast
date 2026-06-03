import React, { useMemo } from 'react';
import { useAppStore, AppState } from '../../store';
import type { ToolDefinition } from '../../store/useToolsStore';

interface ToolListProps {
  onPick?: (tool: ToolDefinition) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  writing: '✍️ 写作',
  translation: '🌐 翻译',
  knowledge: '📚 知识库',
  email: '📧 邮件',
  schedule: '📅 日程',
  todo: '✅ 待办/番茄钟',
  misc: '🧰 工具箱',
  plugin: '🔌 插件',
  sandbox: '🧪 沙箱',
  memory: '🧠 记忆',
  perf: '📊 性能',
  learning: '💡 学习',
  security: '🔒 安全',
  channel: '📡 通知',
  collab: '🤝 协作',
  soul: '🎭 人格',
  marketplace: '🏪 市场',
};

/**
 * ToolList 展示所有可用的 AP Tool（按类别分组）。
 * 点击工具会触发 onPick（默认行为：把工具名注入到对话输入框）。
 */
export const ToolList: React.FC<ToolListProps> = ({ onPick }) => {
  const catalog = useAppStore((s: AppState) => (s as any).catalog) as ToolDefinition[];
  const setActiveTool = useAppStore((s: AppState) => (s as any).setActiveTool) as (id: string | null) => void;

  const grouped = useMemo(() => {
    const map = new Map<string, ToolDefinition[]>();
    for (const t of catalog || []) {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);

  if (!catalog || catalog.length === 0) {
    return (
      <div className="tool-list-empty">
        <p>工具目录为空。请确认后端已注册 Cast Tools。</p>
      </div>
    );
  }

  return (
    <div className="tool-list">
      {grouped.map(([category, tools]) => (
        <div key={category} className="tool-list-group">
          <div className="tool-list-group-title">
            {CATEGORY_LABELS[category] || category}
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
              >
                <div className="tool-list-item-name">{t.name}</div>
                <div className="tool-list-item-desc">{t.description}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolList;
