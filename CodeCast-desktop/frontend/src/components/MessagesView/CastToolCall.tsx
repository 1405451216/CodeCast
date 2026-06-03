import React, { useState, useMemo, useCallback } from 'react';

export interface CastToolCallProps {
  toolName: string;
  category: string;
  args: string;
  result: string;
  isError: boolean;
  durationMs: number;
  timestamp: number;
}

type View = 'preview' | 'args' | 'result';

/**
 * CastToolCall 在对话流 / ToolPanel 中展示一次 Cast AP Tool 调用。
 * 三种状态：折叠（预览）、展开 args、展开 result。
 * 含复制按钮 + 状态徽章 + 类别色条。
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
  const [view, setView] = useState<View>('preview');
  const [copied, setCopied] = useState(false);

  const meta = categoryMeta(category);
  const isSuccess = !isError;
  const formattedTime = useMemo(() => formatTime(timestamp), [timestamp]);
  const durationLabel = useMemo(() => formatDuration(durationMs), [durationMs]);
  const argsPretty = useMemo(() => prettyJSON(args), [args]);
  const resultPretty = useMemo(() => prettyJSON(result), [result]);
  const resultPreview = useMemo(() => previewText(result), [result, isError]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = view === 'args' ? args : view === 'result' ? result : resultPreview;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [view, args, result, resultPreview]);

  return (
    <div
      className={`cast-tool-call ${isSuccess ? 'success' : 'error'}`}
      role="region"
      aria-label={`工具调用 ${toolName}`}
    >
      {/* 左侧类别色条 */}
      <div
        className="cast-tool-call-stripe"
        style={{ background: meta.color }}
        aria-hidden="true"
      />

      {/* 头部：单行摘要（永远显示） */}
      <div
        className="cast-tool-call-header"
        onClick={() => setView(view === 'preview' ? 'result' : 'preview')}
        role="button"
        tabIndex={0}
      >
        <span className="cast-tool-call-icon" style={{ background: meta.bg }}>
          {meta.icon}
        </span>
        <div className="cast-tool-call-info">
          <div className="cast-tool-call-name">{toolName}</div>
          <div className="cast-tool-call-meta">
            <span className="cast-tool-call-cat">{meta.label}</span>
            <span className="cast-tool-call-dot">·</span>
            <span className="cast-tool-call-time">{formattedTime}</span>
          </div>
        </div>
        <div className="cast-tool-call-badges">
          <span className={`cast-tool-call-status ${isSuccess ? 'ok' : 'err'}`}>
            {isSuccess ? '✓' : '✗'}
          </span>
          <span className="cast-tool-call-duration" title="耗时">
            {durationLabel}
          </span>
        </div>
        <span className={`cast-tool-call-toggle ${view === 'preview' ? '' : 'open'}`}>
          ▸
        </span>
      </div>

      {/* 折叠态：预览 */}
      {view === 'preview' && (
        <div className="cast-tool-call-preview">
          {resultPreview}
        </div>
      )}

      {/* 展开态：tab 切换 args / result */}
      {view !== 'preview' && (
        <div className="cast-tool-call-body">
          <div className="cast-tool-call-tabs">
            <button
              className={`cast-tool-call-tab ${view === 'args' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setView('args'); }}
            >
              参数
            </button>
            <button
              className={`cast-tool-call-tab ${view === 'result' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setView('result'); }}
            >
              {isError ? '错误' : '结果'}
            </button>
            <button
              className="cast-tool-call-copy"
              onClick={handleCopy}
              title="复制内容"
            >
              {copied ? '✓ 已复制' : '复制'}
            </button>
          </div>
          <pre className="cast-tool-call-code">
            {view === 'args' ? argsPretty : resultPretty}
          </pre>
        </div>
      )}
    </div>
  );
};

// ============ Helpers ============

interface CategoryMeta {
  icon: string;
  label: string;
  color: string;
  bg: string;
}

function categoryMeta(category: string): CategoryMeta {
  const map: Record<string, CategoryMeta> = {
    writing:     { icon: '✍️', label: '写作',   color: '#1890ff', bg: '#e6f7ff' },
    translation: { icon: '🌐', label: '翻译',   color: '#52c41a', bg: '#f6ffed' },
    knowledge:   { icon: '📚', label: '知识库', color: '#722ed1', bg: '#f9f0ff' },
    email:       { icon: '📧', label: '邮件',   color: '#fa541c', bg: '#fff2e8' },
    schedule:    { icon: '📅', label: '日程',   color: '#13c2c2', bg: '#e6fffb' },
    todo:        { icon: '✅', label: '待办',   color: '#52c41a', bg: '#f6ffed' },
    misc:        { icon: '🧰', label: '工具',   color: '#2f54eb', bg: '#e6ebff' },
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
  return map[category] || { icon: '🔧', label: category, color: '#8c8c8c', bg: '#f5f5f5' };
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '–';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function prettyJSON(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function previewText(raw: string, isError?: boolean): string {
  if (!raw) return isError ? '（无错误信息）' : '（无输出）';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return truncate(parsed, 160);
    if (parsed.content) return truncate(String(parsed.content), 160);
    if (parsed.title) return truncate(String(parsed.title), 160);
    if (parsed.text) return truncate(String(parsed.text), 160);
    if (parsed.error) return `❌ ${truncate(String(parsed.error), 140)}`;
    return truncate(JSON.stringify(parsed), 160);
  } catch {
    return truncate(raw, 160);
  }
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

export default CastToolCall;
