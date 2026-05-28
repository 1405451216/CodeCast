import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_EXTENDED_SOUL,
  SOUL_PRESETS,
  SOUL_VOICE_PRESETS,
  CELEBRITY_SOUL_TEMPLATES,
  getExtendedSoulSystemPrompt,
  createSoulFromDimensions,
  mutateSoul,
  generateRandomSoul,
  exportExtendedSoul,
  importExtendedSoul,
  type ExtendedSoulConfig,
  type SoulPersonalityDimension,
  type VoiceStyle,
} from '../../utils/cast/soul-engine';
import { useCastMemoryStore } from '../../store/useCastMemoryStore';

const DIMENSION_KEYS: (keyof SoulPersonalityDimension)[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
const DIMENSION_LABELS: Record<keyof SoulPersonalityDimension, string> = {
  openness: '开放性',
  conscientiousness: '尽责性',
  extraversion: '外向性',
  agreeableness: '宜人性',
  neuroticism: '稳定性'
};
const DIMENSION_COLORS = ['#c084fc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const PRESET_QUICK_SELECT = [
  { key: 'professional', label: '专业助手' },
  { key: 'creative', label: '创意伙伴' },
  { key: 'tutor', label: '学习导师' },
  { key: 'assistant', label: '效率助手' },
];

const CELEBRITY_QUICK_SELECT = [
  { key: 'sherlock_holmes', label: '福尔摩斯' },
  { key: 'tony_stark', label: '钢铁侠' },
  { key: 'yoda', label: '尤达大师' },
  { key: 'japanese_teacher', label: '日式教师' },
  { key: 'startup_founder', label: '创业者' },
];

interface HistoryEntry {
  config: ExtendedSoulConfig;
  timestamp: number;
  description: string;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

const RadarChart: React.FC<{
  dimensions: SoulPersonalityDimension;
  onDimensionChange: (key: keyof SoulPersonalityDimension, value: number) => void;
  readonly?: boolean;
}> = React.memo(({ dimensions, onDimensionChange, readonly }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<keyof SoulPersonalityDimension | null>(null);

  const drawRadar = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) - 30;
    const levels = 5;
    const angleStep = (Math.PI * 2) / DIMENSION_KEYS.length;
    const startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, width, height);

    for (let i = 1; i <= levels; i++) {
      const r = (maxRadius * i) / levels;
      ctx.beginPath();
      for (let j = 0; j < DIMENSION_KEYS.length; j++) {
        const angle = startAngle + j * angleStep;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(192,132,252,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (i === levels) {
        ctx.fillStyle = 'rgba(192,132,252,0.03)';
        ctx.fill();
      }
    }

    for (let j = 0; j < DIMENSION_KEYS.length; j++) {
      const angle = startAngle + j * angleStep;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * maxRadius,
        centerY + Math.sin(angle) * maxRadius
      );
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.beginPath();
    for (let j = 0; j < DIMENSION_KEYS.length; j++) {
      const key = DIMENSION_KEYS[j];
      const value = dimensions[key] / 10;
      const angle = startAngle + j * angleStep;
      const x = centerX + Math.cos(angle) * maxRadius * value;
      const y = centerY + Math.sin(angle) * maxRadius * value;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(192,132,252,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let j = 0; j < DIMENSION_KEYS.length; j++) {
      const key = DIMENSION_KEYS[j];
      const value = dimensions[key] / 10;
      const angle = startAngle + j * angleStep;
      const x = centerX + Math.cos(angle) * maxRadius * value;
      const y = centerY + Math.sin(angle) * maxRadius * value;

      ctx.beginPath();
      ctx.arc(x, y, dragging === key ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = DIMENSION_COLORS[j];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const labelRadius = maxRadius + 18;
      const lx = centerX + Math.cos(angle) * labelRadius;
      const ly = centerY + Math.sin(angle) * labelRadius;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillStyle = '#bbb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${DIMENSION_LABELS[key]} ${dimensions[key]}`, lx, ly);
    }
  }, [dimensions, dragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(rect.width, 320);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        drawRadar(ctx, size, size);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawRadar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = parseFloat(canvas.style.width) || 280;
    drawRadar(ctx, size, size);
  }, [drawRadar]);

  const getDimensionAtPoint = useCallback((clientX: number, clientY: number): keyof SoulPersonalityDimension | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const size = rect.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = Math.min(centerX, centerY) - 30;
    const angleStep = (Math.PI * 2) / DIMENSION_KEYS.length;
    const startAngle = -Math.PI / 2;

    for (let j = 0; j < DIMENSION_KEYS.length; j++) {
      const key = DIMENSION_KEYS[j];
      const value = dimensions[key] / 10;
      const angle = startAngle + j * angleStep;
      const px = centerX + Math.cos(angle) * maxRadius * value;
      const py = centerY + Math.sin(angle) * maxRadius * value;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist <= 12) return key;
    }
    return null;
  }, [dimensions]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || readonly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = rect.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = Math.min(centerX, centerY) - 30;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const value = Math.max(0, Math.min(10, Math.round((dist / maxRadius) * 10)));
    onDimensionChange(dragging, value);
  }, [dragging, onDimensionChange, readonly]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [dragging, handleMouseUp]);

  return (
    <div ref={containerRef} className="cast-soul-radar-container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        className={`cast-soul-radar-canvas ${readonly ? '' : 'cast-soul-radar-interactive'}`}
        onMouseDown={(e) => {
          if (readonly) return;
          const dim = getDimensionAtPoint(e.clientX, e.clientY);
          if (dim) setDragging(dim);
        }}
        onMouseMove={handleMouseMove}
        style={{ cursor: dragging ? 'grabbing' : readonly ? 'default' : 'pointer', display: 'block' }}
      />
    </div>
  );
});

RadarChart.displayName = 'RadarChart';

const SliderGroup: React.FC<{
  voice: ExtendedSoulConfig['voice'];
  onChange: (key: 'formalityLevel' | 'warmthLevel' | 'detailLevel' | 'humorLevel', value: number) => void;
}> = React.memo(({ voice, onChange }) => {
  const sliders: Array<{ key: 'formalityLevel' | 'warmthLevel' | 'detailLevel' | 'humorLevel'; label: string; color: string }> = [
    { key: 'formalityLevel', label: '正式程度', color: '#3b82f6' },
    { key: 'warmthLevel', label: '温暖程度', color: '#f59e0b' },
    { key: 'detailLevel', label: '详细程度', color: '#10b981' },
    { key: 'humorLevel', label: '幽默程度', color: '#ef4444' },
  ];

  return (
    <div className="cast-soul-sliders">
      {sliders.map(s => (
        <div key={s.key} className="cast-soul-slider-row">
          <label className="cast-soul-slider-label">
            <span>{s.label}</span>
            <strong style={{ color: s.color }}>{voice[s.key]}</strong>
            <span style={{ color: '#666', fontSize: 10 }}>/10</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={voice[s.key]}
            onChange={(e) => onChange(s.key, parseInt(e.target.value, 10))}
            className="cast-soul-slider"
            style={{
              accentColor: s.color,
              width: '100%',
              height: 4,
              cursor: 'pointer'
            }}
          />
        </div>
      ))}
    </div>
  );
});

SliderGroup.displayName = 'SliderGroup';

const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = React.memo(({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cast-soul-collapse">
      <button
        className="cast-soul-collapse-header"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 0', border: 'none', background: 'none',
          color: '#ccc', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', textAlign: 'left'
        }}
      >
        <span style={{
          display: 'inline-block', transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          fontSize: 10, color: '#c084fc'
        }}>▶</span>
        {title}
      </button>
      {open && <div className="cast-soul-collapse-body">{children}</div>}
    </div>
  );
});

CollapsibleSection.displayName = 'CollapsibleSection';

const SoulEditor: React.FC = () => {
  const { soulConfig, updateSoul, setSoulPreset } = useCastMemoryStore();

  const [extendedConfig, setExtendedConfig] = useState<ExtendedSoulConfig>(() => ({
    ...DEFAULT_EXTENDED_SOUL,
    name: soulConfig.name,
    personality: soulConfig.personality,
    tone: soulConfig.tone,
    expertise: soulConfig.expertise,
    constraints: soulConfig.constraints,
    responseLength: soulConfig.responseLength,
    emojiUsage: soulConfig.emojiUsage,
  }));

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const pushHistory = useCallback((config: ExtendedSoulConfig, desc: string) => {
    const entry: HistoryEntry = {
      config: JSON.parse(JSON.stringify(config)),
      timestamp: Date.now(),
      description: desc
    };
    setHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1);
      newHist.push(entry);
      return newHist.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const updateExtendedConfig = useCallback((updates: Partial<ExtendedSoulConfig>) => {
    setExtendedConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const debouncedSyncToStore = useMemo(() =>
    debounce((config: ExtendedSoulConfig) => {
      updateSoul({
        name: config.name,
        personality: config.personality,
        tone: config.tone,
        expertise: config.expertise,
        constraints: config.constraints,
        examples: config.examples.map(e => typeof e === 'string' ? e : e.goodResponse),
        responseLength: config.responseLength,
        emojiUsage: config.emojiUsage,
      });
    }, 200)
  , [updateSoul]);

  useEffect(() => {
    debouncedSyncToStore(extendedConfig);
  }, [extendedConfig, debouncedSyncToStore]);

  const systemPrompt = useMemo(
    () => getExtendedSoulSystemPrompt(extendedConfig),
    [extendedConfig]
  );

  const handlePresetSelect = useCallback((presetKey: string) => {
    const preset = SOUL_PRESETS[presetKey];
    if (!preset) return;
    const newConfig: ExtendedSoulConfig = {
      ...DEFAULT_EXTENDED_SOUL,
      ...preset,
      voice: { ...DEFAULT_EXTENDED_SOUL.voice },
      personalityDimensions: { ...DEFAULT_EXTENDED_SOUL.personalityDimensions },
      domainExpertise: [...DEFAULT_EXTENDED_SOUL.domainExpertise],
      interactionRules: [...DEFAULT_EXTENDED_SOUL.interactionRules],
      examples: [...DEFAULT_EXTENDED_SOUL.examples],
      evolutionLog: [...DEFAULT_EXTENDED_SOUL.evolutionLog],
    };
    pushHistory(newConfig, `应用预设: ${preset.name}`);
    setExtendedConfig(newConfig);
    setSoulPreset(presetKey);
  }, [pushHistory, setSoulPreset]);

  const handleCelebritySelect = useCallback((celebrityKey: string) => {
    const template = CELEBRITY_SOUL_TEMPLATES[celebrityKey];
    if (!template) return;
    const newConfig = JSON.parse(JSON.stringify(template)) as ExtendedSoulConfig;
    pushHistory(newConfig, `应用名人模板: ${template.name}`);
    setExtendedConfig(newConfig);
  }, [pushHistory]);

  const handleRandomGenerate = useCallback(() => {
    const random = generateRandomSoul();
    pushHistory(random, '随机生成人格');
    setExtendedConfig(random);
  }, [pushHistory]);

  const handleDimensionChange = useCallback((key: keyof SoulPersonalityDimension, value: number) => {
    setExtendedConfig(prev => {
      const newDims = { ...prev.personalityDimensions, [key]: value };
      const mutated = createSoulFromDimensions(newDims);
      return {
        ...prev,
        personalityDimensions: newDims,
        voice: { ...mutated.voice },
      };
    });
  }, []);

  const handleVoiceSliderChange = useCallback((
    key: 'formalityLevel' | 'warmthLevel' | 'detailLevel' | 'humorLevel',
    value: number
  ) => {
    setExtendedConfig(prev => ({
      ...prev,
      voice: { ...prev.voice, [key]: value }
    }));
  }, []);

  const handleMutate = useCallback((direction: Parameters<typeof mutateSoul>[1]) => {
    setExtendedConfig(prev => {
      const result = mutateSoul(prev, direction);
      pushHistory(result, `渐变调整: ${direction}`);
      return result;
    });
  }, [pushHistory]);

  const handleTestVoice = useCallback(() => {
    const greeting = extendedConfig.voice.greetingTemplate.replace('{name}', extendedConfig.name);
    const sampleResponse = `${greeting}\n\n关于你刚才提到的问题，${extendedConfig.voice.preferredPhrases[Math.floor(Math.random() * extendedConfig.voice.preferredPhrases.length)]}，让我来详细分析一下...\n\n${extendedConfig.voice.closingTemplate}`;
    setPreviewText(sampleResponse);
    setShowPreview(true);
  }, [extendedConfig]);

  const handleSave = useCallback(() => {
    pushHistory(extendedConfig, '手动保存');
    alert(`人格 "${extendedConfig.name}" 已保存！`);
  }, [extendedConfig, pushHistory]);

  const handleReset = useCallback(() => {
    if (confirm('确定要重置为默认人格配置吗？')) {
      const fresh = { ...DEFAULT_EXTENDED_SOUL };
      pushHistory(fresh, '重置为默认');
      setExtendedConfig(fresh);
    }
  }, [pushHistory]);

  const handleExport = useCallback(() => {
    const json = exportExtendedSoul(extendedConfig);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codecast-soul-${extendedConfig.name}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [extendedConfig]);

  const handleImportSubmit = useCallback(() => {
    try {
      const imported = importExtendedSoul(importText);
      pushHistory(imported, '从文本导入');
      setExtendedConfig(imported);
      setShowImportDialog(false);
      setImportText('');
    } catch (err) {
      alert(`导入失败: ${(err as Error).message}`);
    }
  }, [importText, pushHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setExtendedConfig(history[newIndex].config);
    } else if (historyIndex === 0 && history.length > 0) {
      setExtendedConfig(history[0].config);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;

  const addDomainExpertise = useCallback(() => {
    const domain = prompt('输入领域名称:', '新领域');
    if (!domain) return;
    setExtendedConfig(prev => ({
      ...prev,
      domainExpertise: [...prev.domainExpertise, { domain, level: 5, description: '' }]
    }));
  }, []);

  const removeDomainExpertise = useCallback((index: number) => {
    setExtendedConfig(prev => ({
      ...prev,
      domainExpertise: prev.domainExpertise.filter((_, i) => i !== index)
    }));
  }, []);

  const updateDomainExpertise = useCallback((index: number, field: 'domain' | 'level' | 'description', value: string | number) => {
    setExtendedConfig(prev => ({
      ...prev,
      domainExpertise: prev.domainExpertise.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  }, []);

  const addInteractionRule = useCallback(() => {
    const rule = prompt('输入交互规则:');
    if (!rule) return;
    setExtendedConfig(prev => ({
      ...prev,
      interactionRules: [...prev.interactionRules, rule]
    }));
  }, []);

  const removeInteractionRule = useCallback((index: number) => {
    setExtendedConfig(prev => ({
      ...prev,
      interactionRules: prev.interactionRules.filter((_, i) => i !== index)
    }));
  }, []);

  return (
    <div className="cast-soul-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e0d0ff' }}>
          ✨ Cast 人格工坊
        </h3>
        <div style={{
          padding: '3px 10px', borderRadius: 12,
          background: 'linear-gradient(135deg, #c084fc40, #3b82f640)',
          fontSize: 10, color: '#c084fc', fontWeight: 600
        }}>
          Phase 4.2 完整版
        </div>
      </div>

      <div className="cast-soul-quick-select" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>快速选择</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_QUICK_SELECT.map(p => (
            <button
              key={p.key}
              onClick={() => handlePresetSelect(p.key)}
              className="cast-soul-quick-btn"
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #3c3c3c',
                background: extendedConfig.name === SOUL_PRESETS[p.key]?.name ? 'rgba(192,132,252,0.15)' : 'transparent',
                color: extendedConfig.name === SOUL_PRESETS[p.key]?.name ? '#c084fc' : '#aaa',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {p.label}
            </button>
          ))}
          {CELEBRITY_QUICK_SELECT.map(c => (
            <button
              key={c.key}
              onClick={() => handleCelebritySelect(c.key)}
              className="cast-soul-quick-btn cast-soul-celebrity-btn"
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #c084fc40',
                background: extendedConfig.name === CELEBRITY_SOUL_TEMPLATES[c.key]?.name ? 'rgba(192,132,252,0.2)' : 'transparent',
                color: extendedConfig.name === CELEBRITY_SOUL_TEMPLATES[c.key]?.name ? '#c084fc' : '#c084fc99',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {c.label}
            </button>
          ))}
          <button
            onClick={handleRandomGenerate}
            className="cast-soul-quick-btn"
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px dashed #666',
              background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer'
            }}
          >
            🎲 随机生成
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="cast-soul-quick-btn"
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px dashed #10b98160',
              background: 'transparent', color: '#10b98199', fontSize: 11, cursor: 'pointer'
            }}
          >
            从文本导入
          </button>
        </div>
      </div>

      <div className="cast-soul-main-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14
      }}>
        <div className="cast-soul-radar-section" style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '14px'
        }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 600, textAlign: 'center' }}>
            人格五维雷达图 (拖拽节点调整)
          </div>
          <RadarChart
            dimensions={extendedConfig.personalityDimensions}
            onDimensionChange={handleDimensionChange}
          />
        </div>

        <div className="cast-soul-voice-section" style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '14px'
        }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 600 }}>
            语音风格调节
          </div>
          <SliderGroup
            voice={extendedConfig.voice}
            onChange={handleVoiceSliderChange}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {(['more_formal', 'more_casual', 'more_warm', 'more_cool', 'more_detailed', 'more_concise'] as const).map(dir => {
              const labels: Record<string, string> = {
                more_formal: '更正式', more_casual: '更随意', more_warm: '更温暖',
                more_cool: '更冷淡', more_detailed: '更详细', more_concise: '更精简'
              };
              return (
                <button
                  key={dir}
                  onClick={() => handleMutate(dir)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, border: '1px solid #333',
                    background: 'transparent', color: '#999', fontSize: 10, cursor: 'pointer'
                  }}
                >
                  {labels[dir]}
                </button>
              );
            })}
            <button
              onClick={handleTestVoice}
              style={{
                padding: '3px 10px', borderRadius: 4, border: '1px solid #c084fc40',
                background: 'rgba(192,132,252,0.1)', color: '#c084fc', fontSize: 10, cursor: 'pointer'
              }}
            >
              🔊 试听语音
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div style={{
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>🔊 语音试听效果</span>
            <button
              onClick={() => setShowPreview(false)}
              style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: 'transparent', color: '#666', fontSize: 10, cursor: 'pointer' }}
            >
              关闭
            </button>
          </div>
          <pre style={{
            margin: 0, fontSize: 12, color: '#10b981cc', whiteSpace: 'pre-wrap',
            fontFamily: 'inherit', lineHeight: 1.6
          }}>
            {previewText}
          </pre>
        </div>
      )}

      <div className="cast-soul-details" style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '14px', marginBottom: 14
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10
        }}>
          <div>
            <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>名称</label>
            <input
              type="text"
              value={extendedConfig.name}
              onChange={(e) => updateExtendedConfig({ name: e.target.value })}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                color: '#d4d4d4', fontSize: 12, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>语言风格</label>
            <select
              value={extendedConfig.voice.languageStyle}
              onChange={(e) => updateExtendedConfig({
                voice: { ...extendedConfig.voice, languageStyle: e.target.value as ExtendedSoulConfig['voice']['languageStyle'] }
              })}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 6,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                color: '#d4d4d4', fontSize: 12, outline: 'none', boxSizing: 'border-box'
              }}
            >
              <option value="modern">现代</option>
              <option value="classic">经典</option>
              <option value="technical">技术</option>
              <option value="poetic">诗意</option>
              <option value="conversational">对话式</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>性格描述</label>
          <textarea
            value={typeof extendedConfig.personality === 'string' ? extendedConfig.personality : ''}
            onChange={(e) => updateExtendedConfig({ personality: e.target.value })}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
              color: '#d4d4d4', fontSize: 12, outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
        </div>

        <CollapsibleSection title="语气选项">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>句式偏好</label>
              <select
                value={extendedConfig.voice.sentencePreference}
                onChange={(e) => updateExtendedConfig({
                  voice: { ...extendedConfig.voice, sentencePreference: e.target.value as 'short' | 'mixed' | 'long' }
                })}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                  color: '#d4d4d4', fontSize: 11, outline: 'none'
                }}
              >
                <option value="short">短句</option>
                <option value="mixed">混合</option>
                <option value="long">长句</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Emoji密度</label>
              <select
                value={extendedConfig.voice.emojiDensity}
                onChange={(e) => updateExtendedConfig({
                  voice: { ...extendedConfig.voice, emojiDensity: e.target.value as 'none' | 'sparse' | 'moderate' | 'generous' }
                })}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                  color: '#d4d4d4', fontSize: 11, outline: 'none'
                }}
              >
                <option value="none">无</option>
                <option value="sparse">稀疏</option>
                <option value="moderate">适度</option>
                <option value="generous">丰富</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={extendedConfig.voice.useMarkdown}
                onChange={(e) => updateExtendedConfig({
                  voice: { ...extendedConfig.voice, useMarkdown: e.target.checked }
                })}
                style={{ accentColor: '#c084fc' }}
              />
              使用 Markdown
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={extendedConfig.voice.useEmojis}
                onChange={(e) => updateExtendedConfig({
                  voice: { ...extendedConfig.voice, useEmojis: e.target.checked }
                })}
                style={{ accentColor: '#c084fc' }}
              />
              启用 Emoji
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>开场白模板</label>
            <input
              type="text"
              value={extendedConfig.voice.greetingTemplate}
              onChange={(e) => updateExtendedConfig({
                voice: { ...extendedConfig.voice, greetingTemplate: e.target.value }
              })}
              placeholder='使用 {name} 作为名称占位符'
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                color: '#d4d4d4', fontSize: 11, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>结束语模板</label>
            <input
              type="text"
              value={extendedConfig.voice.closingTemplate}
              onChange={(e) => updateExtendedConfig({
                voice: { ...extendedConfig.voice, closingTemplate: e.target.value }
              })}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                color: '#d4d4d4', fontSize: 11, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="禁用短语 (每行一条)">
          <textarea
            value={extendedConfig.voice.forbiddenPhrases.join('\n')}
            onChange={(e) => updateExtendedConfig({
              voice: {
                ...extendedConfig.voice,
                forbiddenPhrases: e.target.value.split('\n').filter(s => s.trim())
              }
            })}
            rows={3}
            placeholder='说实话&#10;你不懂&#10;显而易见'
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
              color: '#d4d4d4', fontSize: 11, outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 6
            }}
          />
        </CollapsibleSection>

        <CollapsibleSection title="偏好短语 (每行一条)">
          <textarea
            value={extendedConfig.voice.preferredPhrases.join('\n')}
            onChange={(e) => updateExtendedConfig({
              voice: {
                ...extendedConfig.voice,
                preferredPhrases: e.target.value.split('\n').filter(s => s.trim())
              }
            })}
            rows={3}
            placeholder='让我想想&#10;很好的问题&#10;这取决于'
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
              color: '#d4d4d4', fontSize: 11, outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 6
            }}
          />
        </CollapsibleSection>

        <CollapsibleSection title="领域专长">
          <div style={{ marginTop: 8 }}>
            {extendedConfig.domainExpertise.map((exp, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6,
                padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6
              }}>
                <input
                  type="text"
                  value={exp.domain}
                  onChange={(e) => updateDomainExpertise(idx, 'domain', e.target.value)}
                  placeholder="领域"
                  style={{
                    flex: 2, padding: '4px 8px', borderRadius: 4,
                    border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.3)',
                    color: '#d4d4d4', fontSize: 11, outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={exp.level}
                    onChange={(e) => updateDomainExpertise(idx, 'level', parseInt(e.target.value, 10))}
                    style={{ flex: 1, accentColor: '#c084fc', height: 3 }}
                  />
                  <span style={{ fontSize: 10, color: '#c084fc', minWidth: 20, textAlign: 'center' }}>{exp.level}</span>
                </div>
                <button
                  onClick={() => removeDomainExpertise(idx)}
                  style={{
                    padding: '2px 8px', borderRadius: 4, border: '1px solid #ef444440',
                    background: 'transparent', color: '#ef4444', fontSize: 10, cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={addDomainExpertise}
              style={{
                padding: '4px 12px', borderRadius: 4, border: '1px dashed #555',
                background: 'transparent', color: '#888', fontSize: 10, cursor: 'pointer', marginTop: 4
              }}
            >
              + 添加领域
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="交互规则">
          <div style={{ marginTop: 8 }}>
            {extendedConfig.interactionRules.map((rule, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 50,
                  background: 'rgba(192,132,252,0.15)', color: '#c084fc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0
                }}>{idx + 1}</span>
                <input
                  type="text"
                  value={rule}
                  onChange={(e) => {
                    const newRules = [...extendedConfig.interactionRules];
                    newRules[idx] = e.target.value;
                    updateExtendedConfig({ interactionRules: newRules });
                  }}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: 4,
                    border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.2)',
                    color: '#d4d4d4', fontSize: 11, outline: 'none'
                  }}
                />
                <button
                  onClick={() => removeInteractionRule(idx)}
                  style={{
                    padding: '2px 8px', borderRadius: 4, border: '1px solid #ef444440',
                    background: 'transparent', color: '#ef4444', fontSize: 10, cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={addInteractionRule}
              style={{
                padding: '4px 12px', borderRadius: 4, border: '1px dashed #555',
                background: 'transparent', color: '#888', fontSize: 10, cursor: 'pointer', marginTop: 4
              }}
            >
              + 添加规则
            </button>
          </div>
        </CollapsibleSection>
      </div>

      <div className="cast-soul-prompt-preview" style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 14
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>
            System Prompt 预览 (实时更新)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(systemPrompt).then(() => alert('已复制到剪贴板'));
              }}
              style={{
                padding: '3px 10px', borderRadius: 4, border: '1px solid #555',
                background: 'transparent', color: '#aaa', fontSize: 10, cursor: 'pointer'
              }}
            >
              复制
            </button>
          </div>
        </div>
        <pre style={{
          margin: 0, fontSize: 10, color: '#999', whiteSpace: 'pre-wrap',
          fontFamily: 'inherit', lineHeight: 1.6, maxHeight: 300, overflowY: 'auto'
        }}>
          {systemPrompt.slice(0, 2000)}{systemPrompt.length > 2000 ? '\n... (已截断，完整内容请点击复制)' : ''}
        </pre>
      </div>

      <div className="cast-soul-actions" style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14
      }}>
        <button onClick={handleSave} style={{
          padding: '7px 16px', borderRadius: 6, border: 'none',
          background: '#c084fc', color: 'white', fontSize: 11,
          fontWeight: 600, cursor: 'pointer'
        }}>
          💾 保存人格
        </button>
        <button onClick={handleReset} style={{
          padding: '7px 16px', borderRadius: 6, border: '1px solid #f59e0b60',
          background: 'transparent', color: '#f59e0b', fontSize: 11, cursor: 'pointer'
        }}>
          ↩️ 重置
        </button>
        <button onClick={handleExport} style={{
          padding: '7px 16px', borderRadius: 6, border: '1px solid #3b82f660',
          background: 'transparent', color: '#3b82f6', fontSize: 11, cursor: 'pointer'
        }}>
          📤 导出
        </button>
        <button onClick={() => setShowImportDialog(true)} style={{
          padding: '7px 16px', borderRadius: 6, border: '1px solid #10b98160',
          background: 'transparent', color: '#10b981', fontSize: 11, cursor: 'pointer'
        }}>
          📥 导入
        </button>
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          style={{
            padding: '7px 16px', borderRadius: 6, border: '1px solid #666',
            background: canUndo ? 'transparent' : 'rgba(255,255,255,0.03)',
            color: canUndo ? '#aaa' : '#444', fontSize: 11,
            cursor: canUndo ? 'pointer' : 'not-allowed'
          }}
        >
          🔄 撤销 {canUndo && `(${historyIndex})`}
        </button>
      </div>

      {history.length > 0 && (
        <div className="cast-soul-evolution" style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 8, padding: '10px 12px'
        }}>
          <div style={{ fontSize: 11, color: '#777', fontWeight: 600, marginBottom: 6 }}>
            🧬 进化历史 (最近{Math.min(history.length, 10)}条)
          </div>
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {history.slice().reverse().slice(0, 10).map((entry, idx) => (
              <div key={entry.timestamp} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '3px 0', borderBottom: idx < Math.min(history.length, 10) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                fontSize: 10
              }}>
                <span style={{ color: '#999' }}>{entry.description}</span>
                <span style={{ color: '#555' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
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
              📥 导入扩展SOUL配置
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>
              粘贴之前导出的扩展版 SOUL 配置 JSON (Phase 4.2 格式)
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              placeholder='粘贴 Phase 4.2 扩展 SOUL JSON...'
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                border: '1px solid #3c3c3c', background: 'rgba(0,0,0,0.3)',
                color: '#d4d4d4', fontSize: 11, resize: 'vertical',
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

export default React.memo(SoulEditor);
