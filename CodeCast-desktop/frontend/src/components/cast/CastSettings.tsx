import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCastSettingsStore } from '../../store/useCastSettingsStore';
import { useCastPrivacyStore } from '../../store/useCastPrivacyStore';
import type { CastWorkspaceTab } from '../../types/cast-types';
import {
  CAST_TABS,
  WRITING_DOC_TYPES,
  WRITING_STYLES,
  WRITING_MODES,
  LANGUAGES,
  TRANSLATION_STYLES,
  DEFAULT_NOTE_CATEGORIES,
  EMAIL_TEMPLATES,
} from '../../types/cast-types';
import { BUILTIN_PROVIDERS } from '../../types/builtin-providers';
import '../../styles/cast-workspace.css';

type SettingsSection = 'general' | 'writer' | 'translator' | 'schedule' | 'knowledge' | 'email' | 'scheduler' | 'advanced' | 'privacy';

const NAV_ITEMS: { key: SettingsSection; icon: string; label: string }[] = [
  { key: 'general', icon: '\u{1F3E0}', label: '通用' },
  { key: 'writer', icon: '\u270F\uFE0F', label: '写作' },
  { key: 'translator', icon: '\u{1F310}', label: '翻译' },
  { key: 'schedule', icon: '\u{1F4C5}', label: '日程' },
  { key: 'knowledge', icon: '\u{1F4DA}', label: '知识库' },
  { key: 'email', icon: '\u{1F4E7}', label: '邮件' },
  { key: 'scheduler', icon: '\u23F0', label: '调度器' },
  { key: 'advanced', icon: '\u{1F527}', label: '高级' },
  { key: 'privacy', icon: '\u{1F6E1}\uFE0F', label: '隐私与安全' },
];

const SECTION_META: Record<SettingsSection, { title: string; desc: string }> = {
  general:   { title: '通用设置', desc: '管理 Cast 工作区的基础行为和外观偏好' },
  writer:    { title: '写作设置', desc: '配置文档生成、编辑器和草稿保存行为' },
  translator:{ title: '翻译设置', desc: '设置语言偏好、翻译风格和历史记录策略' },
  schedule:  { title: '日程设置', desc: '自定义提醒通知方式和归档规则' },
  knowledge: { title: '知识库设置', desc: '管理笔记分类、摘要和导出格式' },
  email:     { title: '邮件设置', desc: '配置邮件模板、签名和润色选项' },
  scheduler: { title: '调度器设置', desc: '控制后台任务执行参数和日志级别' },
  advanced:  { title: '高级设置', desc: '开发者选项、网络配置和实验性功能' },
  privacy:   { title: '隐私与安全', desc: '控制数据出站策略、审计日志和安全声明' },
};

function getAllModelOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (const provider of BUILTIN_PROVIDERS) {
    for (const model of provider.models) {
      options.push({
        value: model.id,
        label: `${model.displayName || model.name} (${provider.name})`,
      });
    }
  }
  return options;
}

const MODEL_OPTIONS = getAllModelOptions();

const TAB_OPTIONS = CAST_TABS.map(t => ({ value: t.key, label: `${t.icon} ${t.label}` }));

const DOC_TYPE_OPTIONS = WRITING_DOC_TYPES.map(d => ({ value: d.key, label: d.label }));
const STYLE_OPTIONS = WRITING_STYLES.map(s => ({ value: s.key, label: s.label }));
const MODE_OPTIONS = WRITING_MODES.map(m => ({ value: m.key, label: m.label }));

const LANG_OPTIONS = LANGUAGES.map(l => ({ value: l.code, label: `${l.nativeName} (${l.name})` }));
const TRANS_STYLE_OPTIONS = TRANSLATION_STYLES.map(s => ({ value: s.key, label: s.label }));

const CATEGORY_OPTIONS = DEFAULT_NOTE_CATEGORIES.map(c => ({ value: c.id, label: c.name }));
const EXPORT_FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'both', label: '两者都导出' },
];

const TEMPLATE_OPTIONS = EMAIL_TEMPLATES.map(t => ({ value: t.key, label: t.label }));
const TONE_OPTIONS = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '轻松' },
  { value: 'professional', label: '专业' },
  { value: 'friendly', label: '友好' },
];
const LOG_LEVEL_OPTIONS = [
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const CastSettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const store = useCastSettingsStore();
  const privacyStore = useCastPrivacyStore();

  useEffect(() => {
    if (!store.isInitialized) {
      store.loadFromStorage();
    }
  }, [store.isInitialized]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleExport = useCallback(() => {
    try {
      const json = store.exportSettings();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cast-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('设置已导出', 'success');
    } catch {
      showToast('导出失败', 'error');
    }
  }, [store, showToast]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const result = store.importSettings(text);
        if (result.success) {
          showToast(`导入成功${result.errors.length ? ` (${result.errors.length}项警告)` : ''}`, 'success');
          if (result.errors.length > 0) {
            result.errors.forEach(err => console.warn('[CastSettings] Import warning:', err));
          }
        } else {
          showToast(result.errors[0] || '导入失败', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [store, showToast]);

  const handleResetSection = useCallback(() => {
    store.resetToDefaults(activeSection);
    showToast(`${SECTION_META[activeSection].title}已恢复默认`, 'success');
  }, [store, activeSection, showToast]);

  const handleResetAll = useCallback(() => {
    store.resetToDefaults();
    setShowResetConfirm(false);
    showToast('全部设置已恢复默认', 'success');
  }, [store, showToast]);

  const renderToggle = (checked: boolean, onChange: () => void) => (
    <label className="cast-settings-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="cast-settings-toggle-slider" />
    </label>
  );

  const renderSelect = (
    value: string,
    options: { value: string; label: string }[],
    onChange: (val: string) => void,
    width?: number
  ) => (
    <select
      className="cast-settings-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={width ? { maxWidth: `${width}px` } : undefined}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  const renderNumberInput = (
    value: number,
    onChange: (val: number) => void,
    opts?: { min?: number; max?: number; step?: number; width?: number }
  ) => (
    <input
      className="cast-settings-number"
      type="number"
      value={value}
      min={opts?.min}
      max={opts?.max}
      step={opts?.step ?? 1}
      onChange={(e) => onChange(Number(e.target.value))}
      style={opts?.width ? { width: `${opts.width}px` } : undefined}
    />
  );

  const renderTextInput = (value: string, onChange: (val: string) => void, placeholder?: string) => (
    <input
      className="cast-settings-text-input"
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  const renderTextarea = (value: string, onChange: (val: string) => void, placeholder?: string) => (
    <textarea
      className="cast-settings-textarea"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
    />
  );

  const renderRange = (value: number, onChange: (val: number) => void, min: number, max: number) => (
    <div className="cast-settings-range-wrapper">
      <input
        className="cast-settings-range"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="cast-settings-range-value">{value}</span>
    </div>
  );

  const debouncedSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      store.saveToStorage();
    }, 300);
  }, [store]);

  const renderGeneral = () => {
    const g = store.general;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">模型与记忆</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认 LLM 模型</span>
              <span className="label-desc">Cast 功能使用的默认大语言模型</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(g.defaultLLMModel, MODEL_OPTIONS, (v) => {
                store.updateGeneral({ defaultLLMModel: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动保存记忆</span>
              <span className="label-desc">将交互内容自动保存到 Cast 记忆系统</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(g.autoSaveMemory, () => {
                store.updateGeneral({ autoSaveMemory: !g.autoSaveMemory });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">记忆保存阈值</span>
              <span className="label-desc">内容长度超过此值时才自动保存</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(g.memoryAutoSaveThreshold, (v) => {
                store.updateGeneral({ memoryAutoSaveThreshold: Math.max(10, Math.min(500, v)) });
                debouncedSave();
              }, { min: 10, max: 500 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">显示记忆指示器</span>
              <span className="label-desc">在标题栏显示记忆计数徽章</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(g.showMemoryIndicator, () => {
                store.updateGeneral({ showMemoryIndicator: !g.showMemoryIndicator });
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">界面与布局</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">启动默认面板</span>
              <span className="label-desc">打开 Cast 时默认显示的功能面板</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(g.startupTab, TAB_OPTIONS, (v) => {
                store.updateGeneral({ startupTab: v as CastWorkspaceTab });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">工作区高度</span>
              <span className="label-desc">Cast 面板的默认像素高度</span>
            </div>
            <div className="cast-settings-row-control">
              {renderRange(g.workspaceDefaultHeight, (v) => {
                store.updateGeneral({ workspaceDefaultHeight: v });
                debouncedSave();
              }, 250, 700)}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">动画效果</span>
              <span className="label-desc">启用面板切换和交互动画</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(g.enableAnimations, () => {
                store.updateGeneral({ enableAnimations: !g.enableAnimations });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">紧凑模式</span>
              <span className="label-desc">减少间距以显示更多内容</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(g.compactMode, () => {
                store.updateGeneral({ compactMode: !g.compactMode });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">UI 语言</span>
              <span className="label-desc">界面显示语言</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(g.language, [
                { value: 'zh-CN', label: '简体中文' },
                { value: 'en-US', label: 'English' },
              ], (v) => {
                store.updateGeneral({ language: v as 'zh-CN' | 'en-US' });
                debouncedSave();
              }, 140)}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderWriter = () => {
    const w = store.writer;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">文档默认值</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认文档类型</span>
              <span className="label-desc">新建文档时的默认类型</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(w.defaultDocType, DOC_TYPE_OPTIONS, (v) => {
                store.updateWriter({ defaultDocType: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认写作风格</span>
              <span className="label-desc">AI 生成文本的默认风格</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(w.defaultWritingStyle, STYLE_OPTIONS, (v) => {
                store.updateWriter({ defaultWritingStyle: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认写作模式</span>
              <span className="label-desc">进入写作面板时的默认模式</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(w.defaultWritingMode, MODE_OPTIONS, (v) => {
                store.updateWriter({ defaultWritingMode: v });
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">编辑器与预览</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动保存草稿</span>
              <span className="label-desc">按间隔自动保存当前编辑内容</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(w.autoSaveDraft, () => {
                store.updateWriter({ autoSaveDraft: !w.autoSaveDraft });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">草稿保存间隔</span>
              <span className="label-desc">自动保存的时间间隔（秒）</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(w.draftSaveInterval, (v) => {
                store.updateWriter({ draftSaveInterval: Math.max(5, Math.min(300, v)) });
                debouncedSave();
              }, { min: 5, max: 300 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">字数统计显示</span>
              <span className="label-desc">在编辑器底部显示字数统计</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(w.wordCountDisplay, () => {
                store.updateWriter({ wordCountDisplay: !w.wordCountDisplay });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动提取大纲</span>
              <span className="label-desc">生成内容后自动提取文档大纲</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(w.outlineAutoExtract, () => {
                store.updateWriter({ outlineAutoExtract: !w.outlineAutoExtract });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">Markdown 预览</span>
              <span className="label-desc">默认开启分屏 Markdown 预览</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(w.markdownPreview, () => {
                store.updateWriter({ markdownPreview: !w.markdownPreview });
                debouncedSave();
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderTranslator = () => {
    const t = store.translator;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">语言设置</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认源语言</span>
              <span className="label-desc">翻译输入文本的默认语言</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(t.defaultSourceLang, LANG_OPTIONS, (v) => {
                store.updateTranslator({ defaultSourceLang: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认目标语言</span>
              <span className="label-desc">翻译输出结果的默认目标语言</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(t.defaultTargetLang, LANG_OPTIONS, (v) => {
                store.updateTranslator({ defaultTargetLang: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认翻译风格</span>
              <span className="label-desc">AI 翻译时使用的默认风格</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(t.defaultTranslationStyle, TRANS_STYLE_OPTIONS, (v) => {
                store.updateTranslator({ defaultTranslationStyle: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动检测语言</span>
              <span className="label-desc">自动识别输入文本的语言</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(t.autoDetectLanguage, () => {
                store.updateTranslator({ autoDetectLanguage: !t.autoDetectLanguage });
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">历史与工具</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">历史记录上限</span>
              <span className="label-desc">最多保留的历史翻译条目数</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(t.maxHistoryItems, (v) => {
                store.updateTranslator({ maxHistoryItems: Math.max(10, Math.min(500, v)) });
                debouncedSave();
              }, { min: 10, max: 500 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">显示置信度评分</span>
              <span className="label-desc">在翻译结果旁显示置信度</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(t.showConfidenceScore, () => {
                store.updateTranslator({ showConfidenceScore: !t.showConfidenceScore });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">术语表</span>
              <span className="label-desc">启用术语表辅助翻译</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(t.termTableEnabled, () => {
                store.updateTranslator({ termTableEnabled: !t.termTableEnabled });
                debouncedSave();
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderSchedule = () => {
    const s = store.schedule;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">提醒通知</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">提前提醒时间</span>
              <span className="label-desc">日程/待办提前多少分钟提醒</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(s.defaultReminderAdvance, (v) => {
                store.updateSchedule({ defaultReminderAdvance: Math.max(1, Math.min(1440, v)) });
                debouncedSave();
              }, { min: 1, max: 1440 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">声音提醒</span>
              <span className="label-desc">到期时播放提示音</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(s.enableSoundNotification, () => {
                store.updateSchedule({ enableSoundNotification: !s.enableSoundNotification });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">桌面通知</span>
              <span className="label-desc">发送系统桌面推送通知</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(s.enableDesktopNotification, () => {
                store.updateSchedule({ enableDesktopNotification: !s.enableDesktopNotification });
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">归档规则</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动归档已完成</span>
              <span className="label-desc">自动将完成的待办移入归档</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(s.autoArchiveCompleted, () => {
                store.updateSchedule({ autoArchiveCompleted: !s.autoArchiveCompleted });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">归档天数</span>
              <span className="label-desc">完成多少天后自动归档</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(s.archiveAfterDays, (v) => {
                store.updateSchedule({ archiveAfterDays: Math.max(1, Math.min(365, v)) });
                debouncedSave();
              }, { min: 1, max: 365 })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">工作时间</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">工作日时间段</span>
              <span className="label-desc">日程安排的工作时间范围</span>
            </div>
            <div className="cast-settings-row-control">
              <div className="cast-settings-time-pair">
                {renderNumberInput(s.workingHoursStart, (v) => {
                  store.updateSchedule({ workingHoursStart: Math.max(0, Math.min(23, v)) });
                  debouncedSave();
                }, { min: 0, max: 23, width: 60 })}
                <span className="time-sep">:</span>
                <span>00</span>
                <span className="time-sep"> ~ </span>
                {renderNumberInput(s.workingHoursEnd, (v) => {
                  store.updateSchedule({ workingHoursEnd: Math.max(1, Math.min(24, v)) });
                  debouncedSave();
                }, { min: 1, max: 24, width: 60 })}
                <span className="time-sep">:</span>
                <span>00</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderKnowledge = () => {
    const k = store.knowledge;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">笔记默认值</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认分类</span>
              <span className="label-desc">新建笔记时的默认归属分类</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(k.defaultCategory, CATEGORY_OPTIONS, (v) => {
                store.updateKnowledge({ defaultCategory: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自动生成摘要</span>
              <span className="label-desc">创建/更新笔记时自动生成摘要</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(k.autoGenerateSummary, () => {
                store.updateKnowledge({ autoGenerateSummary: !k.autoGenerateSummary });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">标签云</span>
              <span className="label-desc">在知识库中启用标签云可视化</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(k.enableTagCloud, () => {
                store.updateKnowledge({ enableTagCloud: !k.enableTagCloud });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">每分类最大笔记数</span>
              <span className="label-desc">单个分类下最多保存的笔记数量</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(k.maxNotesPerCategory, (v) => {
                store.updateKnowledge({ maxNotesPerCategory: Math.max(10, Math.min(2000, v)) });
                debouncedSave();
              }, { min: 10, max: 2000 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">导出格式</span>
              <span className="label-desc">批量导出笔记时的文件格式</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(k.exportFormat, EXPORT_FORMAT_OPTIONS, (v) => {
                store.updateKnowledge({ exportFormat: v as 'json' | 'markdown' | 'both' });
                debouncedSave();
              }, 150)}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderEmail = () => {
    const e = store.email;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">模板与签名</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认邮件模板</span>
              <span className="label-desc">打开邮件面板时的默认模板</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(e.defaultTemplate, TEMPLATE_OPTIONS, (v) => {
                store.updateEmail({ defaultTemplate: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}>
            <div className="cast-settings-row-label" style={{ width: '100%' }}>
              <span className="label-text">默认签名</span>
              <span className="label-desc">附加在邮件末尾的签名内容</span>
            </div>
            {renderTextarea(e.signature, (v) => {
              store.updateEmail({ signature: v });
              debouncedSave();
            }, '输入您的邮件签名...')}
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">润色选项</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">发送前自动润色</span>
              <span className="label-desc">发送前自动优化邮件措辞</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(e.autoPolish, () => {
                store.updateEmail({ autoPolish: !e.autoPolish });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">默认润色语气</span>
              <span className="label-desc">自动润色使用的语气风格</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(e.defaultTone, TONE_OPTIONS, (v) => {
                store.updateEmail({ defaultTone: v });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">阅读时间估算</span>
              <span className="label-desc">显示邮件预估阅读时长</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(e.readingTimeEstimate, () => {
                store.updateEmail({ readingTimeEstimate: !e.readingTimeEstimate });
                debouncedSave();
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderScheduler = () => {
    const sc = store.scheduler;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">运行控制</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">启动时自动运行</span>
              <span className="label-desc">应用启动时自动启动任务调度器</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(sc.enableOnStartup, () => {
                store.updateScheduler({ enableOnStartup: !sc.enableOnStartup });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">日志级别</span>
              <span className="label-desc">调度器输出的最低日志级别</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(sc.defaultLogLevel, LOG_LEVEL_OPTIONS, (v) => {
                store.updateScheduler({ defaultLogLevel: v as 'debug' | 'info' | 'warn' | 'error' });
                debouncedSave();
              }, 120)}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">最大并发任务数</span>
              <span className="label-desc">同时执行的任务上限</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(sc.maxConcurrentTasks, (v) => {
                store.updateScheduler({ maxConcurrentTasks: Math.max(1, Math.min(10, v)) });
                debouncedSave();
              }, { min: 1, max: 10 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">任务超时</span>
              <span className="label-desc">单个任务的执行超时时间（秒）</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(sc.taskTimeout, (v) => {
                store.updateScheduler({ taskTimeout: Math.max(10, Math.min(600, v)) });
                debouncedSave();
              }, { min: 10, max: 600 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">日志保留天数</span>
              <span className="label-desc">调度器日志的保留周期</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(sc.retainLogDays, (v) => {
                store.updateScheduler({ retainLogDays: Math.max(1, Math.min(90, v)) });
                debouncedSave();
              }, { min: 1, max: 90 })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderAdvanced = () => {
    const a = store.advanced;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">开发者选项</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">开发者模式</span>
              <span className="label-desc">显示调试信息和内部状态面板</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(a.developerMode, () => {
                store.updateAdvanced({ developerMode: !a.developerMode });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">遥测数据收集</span>
              <span className="label-desc">匿名发送使用统计数据帮助改进产品</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(a.telemetryEnabled, () => {
                store.updateAdvanced({ telemetryEnabled: !a.telemetryEnabled });
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">实验性功能</span>
              <span className="label-desc">启用正在开发中的新功能</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(a.experimentalFeatures, () => {
                store.updateAdvanced({ experimentalFeatures: !a.experimentalFeatures });
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">网络与性能</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">缓存大小限制 (MB)</span>
              <span className="label-desc">本地缓存的最大存储空间</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(a.cacheSizeMB, (v) => {
                store.updateAdvanced({ cacheSizeMB: Math.max(10, Math.min(1024, v)) });
                debouncedSave();
              }, { min: 10, max: 1024 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">自定义 API 端点</span>
              <span className="label-desc">覆盖默认的 API 请求地址</span>
            </div>
            <div className="cast-settings-row-control">
              {renderTextInput(a.customApiEndpoint, (v) => {
                store.updateAdvanced({ customApiEndpoint: v });
                debouncedSave();
              }, 'https://...')}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">请求超时 (秒)</span>
              <span className="label-desc">API 请求的最大等待时间</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(a.requestTimeout, (v) => {
                store.updateAdvanced({ requestTimeout: Math.max(5, Math.min(300, v)) });
                debouncedSave();
              }, { min: 5, max: 300 })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">最大重试次数</span>
              <span className="label-desc">失败请求的自动重试上限</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(a.maxRetries, (v) => {
                store.updateAdvanced({ maxRetries: Math.max(0, Math.min(10, v)) });
                debouncedSave();
              }, { min: 0, max: 10 })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderPrivacy = () => {
    const p = store.privacy;
    return (
      <>
        <div className="cast-settings-group">
          <div className="cast-settings-group-title">出站控制</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">出站控制模式</span>
              <span className="label-desc">控制外部网络请求的处理策略</span>
            </div>
            <div className="cast-settings-row-control">
              {renderSelect(p.outboundMode, [
                { value: 'allow_all', label: '允许全部（不推荐）' },
                { value: 'prompt_all', label: '逐次确认（推荐）' },
                { value: 'deny_all', label: '全部禁止' },
              ], (v) => {
                store.updatePrivacy({ outboundMode: v as 'allow_all' | 'prompt_all' | 'deny_all' });
                privacyStore.updateMode(v as 'allow_all' | 'prompt_all' | 'deny_all');
                debouncedSave();
              }, 180)}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">显示出站确认弹窗</span>
              <span className="label-desc">每次外部请求前弹出确认对话框</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(p.showOutboundConfirmation, () => {
                store.updatePrivacy({ showOutboundConfirmation: !p.showOutboundConfirmation });
                privacyStore.toggleShowConfirmation();
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">LLM 数据最小化</span>
              <span className="label-desc">减少发送给 LLM 的上下文数据量</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(p.llmDataMinimization, () => {
                store.updatePrivacy({ llmDataMinimization: !p.llmDataMinimization });
                privacyStore.toggleLlmMinimization();
                debouncedSave();
              })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">数据脱敏与审计</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">敏感数据自动脱敏</span>
              <span className="label-desc">在日志预览中自动遮蔽 API Key 等敏感字段</span>
            </div>
            <div className="cast-settings-row-control">
              {renderToggle(p.autoMaskSensitiveData, () => {
                store.updatePrivacy({ autoMaskSensitiveData: !p.autoMaskSensitiveData });
                privacyStore.toggleAutoMask();
                debouncedSave();
              })}
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">审计日志保留天数</span>
              <span className="label-desc">出站审计日志的保留周期</span>
            </div>
            <div className="cast-settings-row-control">
              {renderNumberInput(p.auditLogRetentionDays, (v) => {
                const val = Math.max(7, Math.min(90, v));
                store.updatePrivacy({ auditLogRetentionDays: val });
                privacyStore.setRetentionDays(val);
                debouncedSave();
              }, { min: 7, max: 90 })}
            </div>
          </div>
        </div>

        <div className="cast-settings-group">
          <div className="cast-settings-group-title">操作</div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">清除审计日志</span>
              <span className="label-desc">删除所有已记录的出站审计日志</span>
            </div>
            <div className="cast-settings-row-control">
              <button
                className="cast-settings-btn danger"
                style={{ padding: '6px 16px', fontSize: '12px' }}
                onClick={() => { if (confirm('确定清除所有审计日志？')) { privacyStore.clearLogs(); showToast('审计日志已清除', 'success'); } }}
              >
                🗑️ 清除
              </button>
            </div>
          </div>

          <div className="cast-settings-row">
            <div className="cast-settings-row-label">
              <span className="label-text">导出隐私报告</span>
              <span className="label-desc">导出完整的隐私审计报告为 JSON 文件</span>
            </div>
            <div className="cast-settings-row-control">
              <button
                className="cast-settings-btn primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
                onClick={() => {
                  try {
                    const data = privacyStore.exportData();
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `cast-privacy-report-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('隐私报告已导出', 'success');
                  } catch { showToast('导出失败', 'error'); }
                }}
              >
                📋 导出报告
              </button>
            </div>
          </div>
        </div>

        <div className="cast-settings-group" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div className="cast-settings-group-title" style={{ color: '#22c55e' }}>🛡️ CodeCast 安全承诺</div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.9, color: '#d1d5db' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>CodeCast 是纯本地 Agent，你的数据永不离开设备：</p>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li>所有用户数据存储在你的本地设备上</li>
              <li>不向任何云服务器同步用户数据</li>
              <li>不内置遥测或分析 SDK</li>
              <li>LLM 调用仅限你自行配置的 API Key</li>
              <li>插件市场完全离线运行，无远程拉取</li>
              <li>API Key 使用 AES-256-GCM 加密存储</li>
            </ul>
          </div>
        </div>
      </>
    );
  };

  const sectionRenderers: Record<SettingsSection, () => React.ReactNode> = {
    general: renderGeneral,
    writer: renderWriter,
    translator: renderTranslator,
    schedule: renderSchedule,
    knowledge: renderKnowledge,
    email: renderEmail,
    scheduler: renderScheduler,
    advanced: renderAdvanced,
    privacy: renderPrivacy,
  };

  const meta = SECTION_META[activeSection];

  return (
    <div className="cast-settings-container">
      {/* Sidebar Navigation */}
      <nav className="cast-settings-sidebar">
        <div className="cast-settings-sidebar-header">
          <span className="header-icon">&#x2699;&#xFE0F;</span>
          <span>Cast 设置中心</span>
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`cast-settings-nav-item${activeSection === item.key ? ' active' : ''}`}
            onClick={() => setActiveSection(item.key)}
          >
            <span className="cast-settings-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <div className="cast-settings-main">
        <div className="cast-settings-content">
          <h2 className="cast-settings-section-title">
            <span className="section-icon">{NAV_ITEMS.find(n => n.key === activeSection)?.icon}</span>
            {meta.title}
          </h2>
          <p className="cast-settings-section-desc">{meta.desc}</p>

          {sectionRenderers[activeSection]()}
        </div>

        {/* Bottom Action Bar */}
        <div className="cast-settings-actions">
          <button className="cast-settings-btn" onClick={handleResetSection}>
            &#x21BA;&#xFE0F; 恢复本页默认
          </button>
          <button className="cast-settings-btn danger" onClick={() => setShowResetConfirm(true)}>
            &#x26A0;&#xFE0F; 全部恢复默认
          </button>
          <button className="cast-settings-btn primary" onClick={handleExport}>
            &#x1F4E4; 导出设置
          </button>
          <button className="cast-settings-btn primary" onClick={handleImport}>
            &#x1F4C1; 导入设置
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="cast-settings-import-input"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`cast-settings-toast ${toast.type}`}>
          {toast.type === 'success' ? '&#x2705;' : '&#x274C;'} {toast.message}
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000,
        }} onClick={() => setShowResetConfirm(false)}>
          <div style={{
            background: 'var(--bg-secondary, #252526)',
            border: '1px solid var(--border-color, #3c3c3c)',
            borderRadius: 12, padding: '28px 32px',
            maxWidth: 400, width: '90%',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--text-primary, #d4d4d4)' }}>
              确认重置所有设置?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '12.5px', color: 'var(--text-muted, #808080)', lineHeight: 1.6 }}>
              此操作将把所有 8 个分组的设置恢复为出厂默认值，且无法撤销。
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="cast-settings-btn"
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: '8px 20px' }}
              >
                取消
              </button>
              <button
                className="cast-settings-btn danger"
                onClick={handleResetAll}
                style={{ padding: '8px 20px', fontWeight: 700 }}
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CastSettings;
