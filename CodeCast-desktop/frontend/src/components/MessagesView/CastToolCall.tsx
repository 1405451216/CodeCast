import React, { useState } from 'react';

export interface CastToolCallProps {
  toolName: string;
  category: string;
  args: string;
  result: string;
  isError: boolean;
  durationMs: number;
  timestamp: number;
}

/**
 * CastToolCall 在对话流中展示一次 Cast AP Tool 调用。
 * 折叠态：单行 chip（icon + 工具名 + 耗时）
 * 展开态：完整 args + result 预览
 */
export const CastToolCall: React.FC<CastToolCallProps> = ({
  toolName,
  category,
  args,
  result,
  isError,
  durationMs,
  timestamp,
}) => {
  const [expanded, setExpanded] = useState(false);
  const icon = categoryIcon(category);
  const isSuccess = !isError;

  let preview = '';
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === 'string') preview = parsed.slice(0, 120);
    else if (parsed.content) preview = String(parsed.content).slice(0, 120);
    else if (parsed.title) preview = String(parsed.title);
    else preview = JSON.stringify(parsed).slice(0, 120);
  } catch {
    preview = result.slice(0, 120);
  }

  return (
    <div
      className={`cast-tool-call ${isSuccess ? 'success' : 'error'}`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
    >
      <div className="cast-tool-call-header">
        <span className="cast-tool-call-icon">{icon}</span>
        <span className="cast-tool-call-name">{toolName}</span>
        <span className="cast-tool-call-cat">{category}</span>
        <span className="cast-tool-call-duration">{durationMs}ms</span>
        <span className="cast-tool-call-toggle">{expanded ? '▾' : '▸'}</span>
      </div>
      {!expanded && preview && (
        <div className="cast-tool-call-preview">{preview}…</div>
      )}
      {expanded && (
        <div className="cast-tool-call-detail">
          <div className="cast-tool-call-section">
            <div className="cast-tool-call-section-title">Args</div>
            <pre>{args}</pre>
          </div>
          <div className="cast-tool-call-section">
            <div className="cast-tool-call-section-title">
              {isError ? 'Error' : 'Result'}
            </div>
            <pre>{result}</pre>
          </div>
          <div className="cast-tool-call-section">
            <div className="cast-tool-call-section-title">Time</div>
            <pre>{new Date(timestamp).toLocaleString()}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

function categoryIcon(category: string): string {
  const map: Record<string, string> = {
    writing: '✍️',
    translation: '🌐',
    knowledge: '📚',
    email: '📧',
    schedule: '📅',
    todo: '✅',
    misc: '🧰',
    plugin: '🔌',
    sandbox: '🧪',
    memory: '🧠',
    perf: '📊',
    learning: '💡',
    security: '🔒',
    channel: '📡',
    collab: '🤝',
    soul: '🎭',
    marketplace: '🏪',
  };
  return map[category] || '🔧';
}

export default CastToolCall;
