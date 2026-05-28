import React, { useState, useCallback } from 'react';
import type { MiniToolDef } from '../../types/cast-types';
import * as api from '../../api';

const MINI_TOOLS: MiniToolDef[] = [
  { id: 'data-analysis', name: '数据分析', icon: '\u{1F4CA}', description: '智能数据分析与可视化摘要', category: 'analysis', color: '#3b82f6' },
  { id: 'meeting-notes', name: '会议纪要', icon: '\u{1F4DD}', description: '提炼会议要点并生成行动项', category: 'meeting', color: '#f59e0b' },
  { id: 'okr-manager', name: 'OKR 管理', icon: '\u{1F3AF}', description: '目标与关键结果追踪', category: 'management', color: '#ef4444' },
  { id: 'calculator', name: '计算器', icon: '\u{1F9EA}', description: '智能计算与单位换算', category: 'utility', color: '#10b981' },
  { id: 'speech-to-text', name: '语音转文字', icon: '\u{1F3A4}', description: '语音识别转写工具', category: 'utility', color: '#8b5cf6' },
  { id: 'voting', name: '投票决策', icon: '\u{1F3AF}', description: '多方案对比决策辅助', category: 'creative', color: '#ec4899' },
  { id: 'reading-comprehension', name: '阅读理解', icon: '\u{1F4D6}', description: '长文精读与要点提取', category: 'analysis', color: '#06b6d4' },
  { id: 'color-scheme', name: '配色方案', icon: '\u{1F3A8}', description: '专业配色推荐与调色板', category: 'creative', color: '#f43f5e' },
  { id: 'news-summary', name: '新闻摘要', icon: '\U0001F4F0', description: '新闻聚合与要点提炼', category: 'analysis', color: '#f97316' },
  { id: 'brainstorm', name: '头脑风暴', icon: '\U0001F4A1', description: '创意发散与思维导图生成', category: 'creative', color: '#eab308' },
  { id: 'ocr-text', name: 'OCR文字识别', icon: '\U0001F4F7', description: '图片中的文字提取', category: 'utility', color: '#14b8a6' },
  { id: 'pomodoro', name: '番茄钟', icon: '\u23F1\uFE0F', description: '专注计时与时间管理', category: 'management', color: '#a855f7' }
];

interface ToolWidgetProps {
  tool: MiniToolDef;
  onClose: () => void;
}

const DataAnalysisWidget: React.FC<ToolWidgetProps> = ({ tool, onClose }) => {
  const [inputData, setInputData] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!inputData.trim()) return;
    setIsLoading(true);
    setResult('');

    try {
      const response = await api.sendMessageEx(
        'cast-tool-session',
        `请对以下数据进行综合分析：

${inputData}

请输出结构化的分析报告，包含：
1. 数据概览（关键数字）
2. 趋势分析（如有时间序列）
3. 异常点识别
4. 结论和建议`,
        '',
        false
      );
      if (typeof response === 'string') setResult(response);
    } catch (error: any) {
      setResult('\u274C 分析失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [inputData]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{tool.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{tool.name}</span>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>✕</button>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>输入数据（数字/文本均可）</label>
          <textarea className="cast-editor-textarea" value={inputData} onChange={(e) => setInputData(e.target.value)}
            placeholder="粘贴数据或输入分析需求，例如：&#10;Q1销售额: 120万&#10;Q2销售额: 150万&#10;Q3销售额: 135万&#10;请分析趋势..."
            style={{ height: '120px', fontSize: 12 }} onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleAnalyze()} />
        </div>
        <button className="cast-toolbar-btn active" style={{ alignSelf: 'flex-start' }} disabled={!inputData.trim() || isLoading} onClick={handleAnalyze}>
          {isLoading ? '\u{23F3} 分析中...' : '\u{1F4CA} 分析数据'}
        </button>
        {result && (
          <div className="cast-preview-area" style={{ flex: 1, background: 'rgba(59,130,246,0.04)', borderRadius: 8, padding: 12 }}
            dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br/>') + (isLoading ? '<span style="color:#3b82f6">\u25B6</span>' : '') }} />
        )}
      </div>
    </div>
  );
};

const MeetingNotesWidget: React.FC<ToolWidgetProps> = ({ tool, onClose }) => {
  const [rawNotes, setRawNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!rawNotes.trim()) return;
    setIsLoading(true);
    setSummary('');

    try {
      const response = await api.sendMessageEx(
        'cast-tool-session',
        `请将以下会议记录整理为结构化会议纪要：

${rawNotes}

要求：
1. 会议基本信息（主题、参与人）
2. 讨论要点（按议题分类）
3. 决议事项
4. 行动项（负责人+截止日期），格式为 - [ ] 任务 (@负责人) [截止日期]`,
        '',
        false
      );
      if (typeof response === 'string') setSummary(response);
    } catch (error: any) {
      setSummary('\u274C 生成失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [rawNotes]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{tool.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{tool.name}</span>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>✕</button>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>输入会议原始记录</label>
          <textarea className="cast-editor-textarea" value={rawNotes} onChange={(e) => setRawNotes(e.target.value)}
            placeholder="粘贴会议记录或逐条输入讨论要点...&#10;&#10;例如：&#10;1. 讨论了 Q3 产品路线图&#10;2. 决定优先做用户反馈功能&#10;3. 小王负责原型设计，周五完成"
            style={{ height: '140px', fontSize: 12 }} />
        </div>
        <button className="cast-toolbar-btn active" style={{ alignSelf: 'flex-start' }} disabled={!rawNotes.trim() || isLoading} onClick={handleGenerate}>
          {isLoading ? '\u{23F3} 生成中...' : '\u2728 生成纪要'}
        </button>
        {summary && (
          <div className="cast-preview-area" style={{ flex: 1, background: 'rgba(245,158,11,0.04)', borderRadius: 8, padding: 12 }}
            dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') + (isLoading ? '<span style="color:#f59e0b">\u25B6</span>' : '') }} />
        )}
      </div>
    </div>
  );
};

const BrainstormWidget: React.FC<ToolWidgetProps> = ({ tool, onClose }) => {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleBrainstorm = useCallback(async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setIdeas([]);

    try {
      const rawResult = await api.sendMessageEx(
        'cast-tool-session',
        `你是一位创意思维专家。请围绕用户给出的主题，生成有深度、有创意的想法。每个想法用序号标注，格式为：序号. 名称 — 核心思路（一句话）| 潜在价值（一句话）。只输出想法列表，不要其他内容。

请围绕"${topic}"进行头脑风暴，给出 8 个不同的创意方向。`,
        '',
        false
      );

      const text = typeof rawResult === 'string' ? rawResult : '';
      const parsedIdeas = text.split(/\n/).filter(line => /^\d+\./.test(line)).map(line => line.replace(/^\d+\.\s*/, '').trim());
      setIdeas(parsedIdeas.length > 0 ? parsedIdeas : text.split('\n').filter(l => l.trim()));
    } catch (error: any) {
      setIdeas(['\u274C 失败: ' + error.message]);
    } finally {
      setIsLoading(false);
    }
  }, [topic]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{tool.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{tool.name}</span>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>✕</button>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>头脑风暴主题</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：如何提升团队协作效率？"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()} />
        </div>
        <button className="cast-toolbar-btn active" style={{ alignSelf: 'flex-start' }} disabled={!topic.trim() || isLoading} onClick={handleBrainstorm}>
          {isLoading ? '\u{23F3} 发散中...' : '\U0001F4A1 发散思维'}
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {ideas.map((idea, i) => (
            <div key={i} style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ color: '#eab308', fontWeight: 600, marginRight: 8 }}>#{i + 1}</span>{idea}
            </div>
          ))}
          {ideas.length === 0 && !isLoading && topic && (
            <div className="cast-empty-state" style={{ padding: '20px' }}>
              <p style={{ fontSize: 12 }}>输入主题后点击发散，AI 将为你生成多个创意方向</p>
            </div>
          )}
          {isLoading && ideas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
              <span style={{ animation: 'blink 1s infinite' }}>💡 AI 正在发散思维...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PomodoroWidget: React.FC<ToolWidgetProps> = ({ tool, onClose }) => {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState(0);

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setSessions(s => s + 1);
            return 25 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ fontSize: 56, fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="cast-toolbar-btn active" onClick={() => setIsRunning(!isRunning)} style={{ padding: '10px 24px', fontSize: 13 }}>
          {isRunning ? '\u23F8 暂停' : '\u25B6 开始'}
        </button>
        <button className="cast-toolbar-btn" onClick={() => { setSeconds(25 * 60); setIsRunning(false); }}>↺ 重置</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {[15, 25, 45].map(m => (
          <button key={m} className={`cast-toolbar-btn ${seconds === m * 60 ? 'active' : ''}`} onClick={() => { setSeconds(m * 60); setIsRunning(false); }}>{m}分钟</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        已完成 {sessions} 个番茄 · 专注中保持高效 💪
      </div>
    </div>
  );
};

const WIDGET_MAP: Record<string, React.FC<ToolWidgetProps>> = {
  'data-analysis': DataAnalysisWidget,
  'meeting-notes': MeetingNotesWidget,
  'brainstorm': BrainstormWidget,
  'pomodoro': PomodoroWidget
};

const CastToolsHub: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const ActiveWidget = activeToolId ? WIDGET_MAP[activeToolId] : null;
  const activeTool = MINI_TOOLS.find(t => t.id === activeToolId);

  if (ActiveWidget && activeTool) {
    return (
      <div className="cast-panel-container" style={{ padding: 0 }}>
        <ActiveWidget tool={activeTool} onClose={() => setActiveToolId(null)} />
      </div>
    );
  }

  const groupedTools = Object.entries(
    MINI_TOOLS.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<string, MiniToolDef[]>)
  );

  const categoryNames: Record<string, string> = {
    analysis: '\u{1F4CA} 数据分析',
    meeting: '\u{1F4DD} 会议办公',
    management: '\u{1F3AF} 效率管理',
    utility: '\u{1F527} 实用工具',
    creative: '\U0001F4A1 创意辅助'
  };

  return (
    <div className="cast-panel-container">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--text-primary)' }}>🚀 工具箱</h3>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>轻量 AI 工具，快速完成日常任务</p>
      </div>

      {groupedTools.map(([category, tools]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, paddingLeft: 2 }}>
            {categoryNames[category] || category}
          </div>
          <div className="cast-card-grid">
            {tools.map(tool => (
              <div key={tool.id} className="cast-tool-card" onClick={() => setActiveToolId(tool.id)}>
                <div className="cast-tool-card-icon" style={{ filter: `drop-shadow(0 2px 4px ${tool.color}33)` }}>{tool.icon}</div>
                <div className="cast-tool-card-name">{tool.name}</div>
                <div className="cast-tool-card-desc">{tool.description}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(CastToolsHub);
