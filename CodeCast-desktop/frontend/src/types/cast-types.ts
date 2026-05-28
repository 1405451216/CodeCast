export type CastWorkspaceTab = 'writing' | 'translate' | 'schedule' | 'knowledge' | 'email' | 'tools' | 'memory' | 'scheduler' | 'plugins' | 'settings' | 'learning' | 'collab' | 'production';

export interface CastTabDefinition {
  key: CastWorkspaceTab;
  icon: string;
  label: string;
  description: string;
  color: string;
}

export const CAST_TABS: CastTabDefinition[] = [
  {
    key: 'writing',
    icon: '\u{1F4DD}',
    label: '写作',
    description: '文档、报告、文案、润色',
    color: '#f59e0b'
  },
  {
    key: 'translate',
    icon: '\u{1F310}',
    label: '翻译',
    description: '多语言互译、术语管理',
    color: '#10b981'
  },
  {
    key: 'schedule',
    icon: '\u{1F4CB}',
    label: '日程',
    description: '待办事项、日历、提醒',
    color: '#3b82f6'
  },
  {
    key: 'knowledge',
    icon: '\u{1F4DA}',
    label: '知识库',
    description: '笔记、标签、全文搜索',
    color: '#8b5cf6'
  },
  {
    key: 'email',
    icon: '\u{1F4E7}',
    label: '邮件',
    description: '起草邮件、模板管理',
    color: '#ef4444'
  },
  {
    key: 'tools',
    icon: '\u{1F680}',
    label: '更多',
    description: '数据分析、会议纪要等工具',
    color: '#ec4899'
  },
  {
    key: 'memory',
    icon: '🧠',
    label: '记忆',
    description: '长期记忆、人格设定、偏好管理',
    color: '#06b6d4'
  },
  {
    key: 'scheduler',
    icon: '⏰',
    label: '调度',
    description: '定时任务、自动化执行、执行日志',
    color: '#f97316'
  },
  {
    key: 'plugins',
    icon: '🧩',
    label: '插件',
    description: '工具市场、插件管理、扩展能力',
    color: '#a855f7'
  },
  {
    key: 'settings',
    icon: '⚙️',
    label: '设置',
    description: 'Cast全局配置、偏好设置',
    color: '#6b7280'
  },
  {
    key: 'learning',
    icon: '🧠',
    label: '学习',
    description: '自我进化、模式识别、复合技能、操作洞察',
    color: '#14b8a6'
  },
  {
    key: 'collab',
    icon: '👥',
    label: '协作',
    description: '多用户协作、文档共享、同步、权限管理',
    color: '#0ea5e9'
  },
  {
    key: 'production',
    icon: '\u{1F3ED}',
    label: '生产控制台',
    description: '数据备份、存储健康、网络状态、系统信息',
    color: '#6366f1'
  }
];

export type WritingDocType = 'weekly-report' | 'proposal' | 'copywriting' | 'summary' | 'email-body' | 'ppt-outline' | 'resume' | 'blog' | 'custom';

export type WritingMode = 'generate' | 'continue' | 'polish' | 'rewrite-expand' | 'rewrite-shrink' | 'tone-adjust';

export type WritingStyle = 'formal' | 'casual' | 'academic' | 'marketing' | 'technical' | 'creative';

export interface WritingDocument {
  id: string;
  title: string;
  docType: WritingDocType;
  style: WritingStyle;
  content: string;
  outline?: OutlineItem[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  versionHistory: DocumentVersion[];
}

export interface OutlineItem {
  id: string;
  level: number;
  title: string;
  content?: string;
  children?: OutlineItem[];
}

export interface DocumentVersion {
  id: string;
  content: string;
  timestamp: number;
  wordCount: number;
  changeSummary: string;
}

export const WRITING_DOC_TYPES: { key: WritingDocType; label: string; icon: string; template: string }[] = [
  { key: 'weekly-report', label: '周报', icon: '\u{1F4C5}', template: '## 本周工作总结\n\n### 完成事项\n- \n\n### 进行中\n- \n\n### 遇到的问题\n- \n\n### 下周计划\n- \n' },
  { key: 'proposal', label: '方案书', icon: '\u{1F4CD}', template: '# 项目方案\n\n## 背景\n\n## 目标\n\n## 实施计划\n\n## 预期成果\n\n## 风险评估\n' },
  { key: 'copywriting', label: '文案', icon: '\u{270F}\u{FE0F}', template: '' },
  { key: 'summary', label: '总结', icon: '\u{1F4DD}', template: '# 总结\n\n## 核心要点\n\n## 详细内容\n\n## 结论\n' },
  { key: 'email-body', label: '邮件正文', icon: '\u{1F4E7}', template: '' },
  { key: 'ppt-outline', label: 'PPT大纲', icon: '\u{1F4C4}', template: '# PPT 大纲\n\n## 第1页：封面\n\n## 第2页：目录\n\n## 第3页：\n\n## 第4页：\n\n## 结束页：感谢\n' },
  { key: 'resume', label: '简历', icon: '\u{1F4DC}', template: '# 个人简历\n\n## 基本信息\n\n## 工作经历\n\n## 项目经验\n\n## 技能特长\n\n## 教育背景\n' },
  { key: 'blog', label: '博客文章', icon: '\u{1F4D6}', template: '# 文章标题\n\n> 一句话摘要\n\n## 引言\n\n## 正文\n\n## 结论\n\n---\n*作者：CodeCast*' },
  { key: 'custom', label: '自定义', icon: '\u{2728}', template: '' }
];

export const WRITING_STYLES: { key: WritingStyle; label: string; desc: string }[] = [
  { key: 'formal', label: '正式', desc: '专业、严谨，适合商务场景' },
  { key: 'casual', label: '轻松', desc: '亲切、自然，适合日常交流' },
  { key: 'academic', label: '学术', desc: '客观、有据可查，适合论文报告' },
  { key: 'marketing', label: '营销', desc: '吸引人、有感染力，适合推广文案' },
  { key: 'technical', label: '技术', desc: '精确、简洁，适合技术文档' },
  { key: 'creative', label: '创意', desc: '生动、有趣，适合故事创作' }
];

export const WRITING_MODES: { key: WritingMode; label: string; icon: string; promptHint: string }[] = [
  { key: 'generate', label: '从零生成', icon: '\u{2728}', promptHint: '描述你想写的内容...' },
  { key: 'continue', label: '续写', icon: '\u{23ED}', promptHint: 'AI 将根据上文继续写作...' },
  { key: 'polish', label: '润色改写', icon: '\u{2728}', promptHint: '选择润色方向...' },
  { key: 'rewrite-expand', label: '扩写', icon: '\u{2197}\u{FE0F}', promptHint: '输入需要扩写的内容...' },
  { key: 'rewrite-shrink', label: '缩写', icon: '\u{2198}\u{FE0F}', promptHint: '输入需要精简的内容...' },
  { key: 'tone-adjust', label: '语气调整', icon: '\u{1F3A4}', promptHint: '选择目标语气风格...' }
];

export type LanguageCode = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru' | 'ar' | 'pt' | 'it' | 'nl' | 'tr' | 'vi' | 'th';

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' }
];

export type TranslationStyle = 'literal' | 'free' | 'colloquial' | 'formal' | 'academic';

export const TRANSLATION_STYLES: { key: TranslationStyle; label: string; desc: string }[] = [
  { key: 'literal', label: '直译', desc: '逐字翻译，保留原文结构' },
  { key: 'free', label: '意译', desc: '传达意思，符合目标语言习惯' },
  { key: 'colloquial', label: '口语化', desc: '自然流畅的口语表达' },
  { key: 'formal', label: '正式', desc: '正式书面语体' },
  { key: 'academic', label: '学术', desc: '学术专业术语和格式' }
];

export interface TranslationTerm {
  id: string;
  source: string;
  target: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  category: string;
  createdAt: number;
}

export interface TranslationHistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  style: TranslationStyle;
  timestamp: number;
}

export type TodoPriority = 'urgent' | 'important' | 'normal' | 'low';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  status: TodoStatus;
  tags: string[];
  dueDate?: number;
  reminderAt?: number;
  repeatRule?: RepeatRule;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RepeatRule {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  endDate?: number;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  color?: string;
  todoId?: string;
  description?: string;
}

export type CalendarView = 'month' | 'week' | 'day';

export const TODO_PRIORITIES: { key: TodoPriority; label: string; icon: string; color: string }[] = [
  { key: 'urgent', label: '紧急', icon: '\u{1F534}', color: '#ef4444' },
  { key: 'important', label: '重要', icon: '\u{1F7E1}', color: '#f59e0b' },
  { key: 'normal', label: '普通', icon: '\u{1F535}', color: '#3b82f6' },
  { key: 'low', label: '备忘', icon: '\u{26AA}', color: '#9ca3af' }
];

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  links: string[];
  createdAt: number;
  updatedAt: number;
  summary?: string;
}

export interface NoteCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'work', name: '工作', icon: '\u{1F4BC}', color: '#3b82f6', count: 0 },
  { id: 'study', name: '学习', icon: '\u{1F4D6}', color: '#10b981', count: 0 },
  { id: 'life', name: '生活', icon: '\u{1F3E0}', color: '#f59e0b', count: 0 },
  { id: 'project', name: '项目', icon: '\u{1F4C1}', color: '#8b5cf6', count: 0 }
];

export type EmailTemplateType = 'application' | 'report' | 'invitation' | 'apology' | 'thanks' | 'notice' | 'follow-up' | 'introduction' | 'leave' | 'custom';

export interface EmailDraft {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  templateType: EmailTemplateType;
  signatureId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EmailSignature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export const EMAIL_TEMPLATES: { key: EmailTemplateType; label: string; icon: string; subject: string; body: string }[] = [
  { key: 'application', label: '申请', icon: '\u{1F4CB}', subject: '关于{{topic}}的申请', body: '尊敬的{{recipient}}：\n\n您好！\n\n我是{{name}}，现就以下事项向您提出申请：\n\n{{content}}\n\n期待您的批复。\n\n此致\n敬礼！\n\n{{sender}}\n{{date}}' },
  { key: 'report', label: '汇报', icon: '\u{1F4C4}', subject: '{{period}}工作汇报 - {{name}}', body: '{{recipient}}您好：\n\n以下是{{period}}的工作汇报：\n\n## 一、主要工作\n\n{{work_content}}\n\n## 二、遇到问题\n\n{{problems}}\n\n## 三、下一步计划\n\n{{next_plan}}\n\n请审阅。' },
  { key: 'invitation', label: '邀请', icon: '\u{1F381}', subject: '诚挚邀请您参加{{event}}', body: '尊敬的{{recipient}}：\n\n诚邀您参加将于{{time}}在{{location}}举办的{{event}}。\n\n**活动详情：**\n- 时间：{{time}}\n- 地点：{{location}}\n- 主题：{{topic}}\n\n期待您的光临！\n\n{{sender}}' },
  { key: 'apology', label: '道歉', icon: '\u{164F}\u{FE0F}', subject: '关于{{incident}}的致歉信', body: '尊敬的{{recipient}}：\n\n对于{{incident}}一事，我深表歉意。\n\n事情经过如下：\n{{description}}\n\n我已采取以下补救措施：\n{{remedy}}\n\n今后我将避免类似情况再次发生，恳请您谅解。\n\n此致\n歉意！\n\n{{sender}}' },
  { key: 'thanks', label: '感谢', icon: '\u{1F389}', subject: '感谢您的{{favor}}', body: '尊敬的{{recipient}}：\n\n衷心感谢您在{{context}}中给予的帮助与支持！\n\n{{detail}}\n\n您的帮助对我意义重大，再次表示最诚挚的谢意！\n\n祝好！\n\n{{sender}}' },
  { key: 'notice', label: '通知', icon: '\u{1F4E2}', subject: '关于{{topic}}的通知', body: '各位同事/同学：\n\n现将有关{{topic}}的事项通知如下：\n\n{{content}}\n\n请知悉并相互转告。\n\n{{department}}\n{{date}}' },
  { key: 'follow-up', label: '跟进', icon: '\u{1F50D}', subject: 'Re: {{original_subject}} - 进展跟进', body: 'Hi {{recipient}}，\n\n希望这封邮件找到您时一切安好。\n\n我想就之前讨论的{{topic}}做一下进展跟进：\n\n{{update}}\n\n请问目前情况如何？如有任何需要我协助的地方，请随时告知。\n\nBest regards,\n{{sender}}' },
  { key: 'introduction', label: '介绍', icon: '\u{1F4AC}', subject: '介绍：{{person_name}} - {{relation}}', body: 'Hi {{recipient}}，\n\n我想向你介绍{{person_name}}（{{relation}}）。\n\n{{person_intro}}\n\n我认为你们可能会有共同感兴趣的话题/合作机会，所以冒昧介绍你们认识。\n\n{{person_name}}的联系邮箱：{{person_email}}\n\nBest,\n{{sender}}' },
  { key: 'leave', label: '请假', icon: '\u{1F4C5}', subject: '请假申请 - {{name}} ({{start_date}} ~ {{end_date}})', body: '尊敬的{{manager}}：\n\n因{{reason}}，我申请于{{start_date}}至{{end_date}}请假{{days}}天。\n\n请假期间的工作安排：\n{{handover}}\n\n紧急联系方式：{{contact}}\n\n恳请批准。\n\n申请人：{{name}}\n{{date}}' },
  { key: 'custom', label: '自定义', icon: '\u{2728}', subject: '', body: '' }
];

export interface MiniToolDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'analysis' | 'meeting' | 'management' | 'utility' | 'creative';
  color: string;
}

// === Phase 1: Cast Memory v2.0 Types ===
export type SoulTone = 'formal' | 'casual' | 'friendly' | 'professional' | 'witty' | 'empathetic';
export type ResponseLength = 'concise' | 'balanced' | 'detailed';
export type EmojiUsage = 'none' | 'minimal' | 'moderate' | 'generous';
export type MemoryHealth = 'good' | 'warning' | 'full';
export type CastMemoryItemType = 'conversation' | 'context' | 'preference' | 'insight' | 'decision' | 'fact';

// === Phase 1.3: Cast Plugin SDK Types ===
// 插件系统相关类型定义位于: types/cast-plugin.ts
// 包含:
//   - ICastTool: 插件工具接口（扩展自AgentTool，支持动态注册）
//   - CastPluginManifest: 插件清单格式
//   - UISchema: 参数表单自动渲染Schema
//   - ToolContext / ToolResult: 工具执行上下文和结果（插件增强版）
//   - CastToolRegistryState: 动态工具注册中心状态接口
//   - Permission: 权限类型枚举
//   - CastToolCategory: 工具分类类型（含communication/productivity/custom扩展）
// 注意: 为避免循环依赖，cast-types.ts不重导出cast-plugin.ts的类型
//       请直接从 '../types/cast-plugin' 导入插件相关类型
