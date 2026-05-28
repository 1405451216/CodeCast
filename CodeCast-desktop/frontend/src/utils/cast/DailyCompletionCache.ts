import type { LanguageCode } from '../../types/cast-types';

interface CompletionItem {
  text: string;
  display: string;
  description: string;
  category: 'writing' | 'translate' | 'schedule' | 'knowledge' | 'email' | 'general';
  priority: number;
}

const DAILY_COMPLETIONS: CompletionItem[] = [
  { text: '帮我写一篇关于', display: '✍️ 帮我写一篇关于...', description: 'AI 写作助手', category: 'writing', priority: 100 },
  { text: '翻译成英文：', display: '🌐 翻译成英文：', description: '中英翻译', category: 'translate', priority: 95 },
  { text: '翻译成中文：', display: '🌐 翻译成中文：', description: '外中翻译', category: 'translate', priority: 95 },
  { text: '帮我安排今天的', display: '📋 帮我安排今天的...', description: '日程规划', category: 'schedule', priority: 90 },
  { text: '提醒我明天', display: '⏰ 提醒我明天...', description: '设置提醒', category: 'schedule', priority: 88 },
  { text: '写一封邮件给', display: '📧 写一封邮件给...', description: '邮件起草', category: 'email', priority: 85 },
  { text: '总结一下以下内容：', display: '📝 总结一下...', description: '内容摘要', category: 'writing', priority: 82 },
  { text: '润色这段文字：', display: '✨ 润色这段文字：', description: '文本润色', category: 'writing', priority: 80 },
  { text: '把以下内容扩写：', display: '📖 把以下内容扩写：', description: '文章扩写', category: 'writing', priority: 78 },
  { text: '精简以下内容：', display: '✂️ 精简以下内容：', description: '内容精简', category: 'writing', priority: 76 },
  { text: '生成会议纪要：', display: '📋 生成会议纪要：', description: '会议记录整理', category: 'general', priority: 74 },
  { text: '分析以下数据：', display: '📊 分析以下数据：', description: '数据分析', category: 'general', priority: 72 },
  { text: '头脑风暴一下', display: '💡 头脑风暴一下...', description: '创意发散', category: 'general', priority: 70 },
  { text: '创建一个笔记：', display: '📚 创建一个笔记：', description: '知识库笔记', category: 'knowledge', priority: 68 },
  { text: '搜索我的笔记：', display: '🔍 搜索我的笔记：', description: '笔记搜索', category: 'knowledge', priority: 66 },
  { text: '帮我写周报', display: '📊 帮我写周报', description: '周报模板', category: 'writing', priority: 94 },
  { text: '帮我写方案书', display: '📄 帮我写方案书', description: '方案模板', category: 'writing', priority: 92 },
  { text: '帮我写PPT大纲', display: '📑 帮我写PPT大纲', description: 'PPT模板', category: 'writing', priority: 90 },
  { text: '翻译成日语：', display: '🌐 翻译成日语：', description: '中日翻译', category: 'translate', priority: 85 },
  { text: '翻译成韩语：', display: '🌐 翻译成韩语：', description: '中韩翻译', category: 'translate', priority: 83 },
  { text: '本周工作总结', display: '📋 本周工作总结', description: '快速周报', category: 'schedule', priority: 87 },
  { text: '下周计划制定', display: '📅 下周计划制定', description: '周计划', category: 'schedule', priority: 84 },
  { text: '起草一封申请信', display: '📧 起草一封申请信', description: '申请邮件', category: 'email', priority: 80 },
  { text: '起草一封感谢信', display: '🙏 起草一封感谢信', description: '感谢邮件', category: 'email', priority: 78 },
  { text: '提取关键词：', display: '🔑 提取关键词：', description: '关键词提取', category: 'general', priority: 75 },
  { text: '对比分析两段文本', display: '⚖️ 对比分析两段文本', description: '文本对比', category: 'general', priority: 73 },
  { text: '格式转换：将', display: '🔄 格式转换：将...', description: '格式转换', category: 'general', priority: 70 },
  { text: '尊敬的', display: '📧 尊敬的...', description: '正式称呼', category: 'email', priority: 65 },
  { text: '您好！我是', display: '👋 您好！我是...', description: '自我介绍开场', category: 'email', priority: 63 },
  { text: '特此函告', display: '📢 特此函告', description: '通知结尾', category: 'email', priority: 60 },
  { text: '此致 敬礼', display: '🙇 此致 敬礼', description: '正式落款', category: 'email', priority: 58 },
  { text: '# ', display: '📝 # 标题', description: 'Markdown 标题', category: 'writing', priority: 55 },
  { text: '## ', display: '📝 ## 二级标题', description: 'Markdown H2', category: 'writing', priority: 53 },
  { text: '- ', display: '📝 - 列表项', description: 'Markdown 列表', category: 'writing', priority: 51 },
  { text: '> ', display: '💬 > 引用块', description: 'Markdown 引用', category: 'writing', priority: 49 },
  { text: '```', display: '💻 ``` 代码块', description: '代码块', category: 'writing', priority: 47 }
];

const CATEGORY_WEIGHTS: Record<CompletionItem['category'], number> = {
  writing: 1.2,
  translate: 1.15,
  schedule: 1.1,
  knowledge: 1.05,
  email: 1.08,
  general: 1.0
};

export class DailyCompletionCache {
  private cache: Map<string, CompletionItem[]>;
  private history: string[];
  private maxHistory: number;

  constructor(maxHistory = 50) {
    this.cache = new Map();
    this.history = [];
    this.maxHistory = maxHistory;
    this.loadHistory();
  }

  getCompletions(input: string, limit = 8): CompletionItem[] {
    if (!input.trim()) {
      return DAILY_COMPLETIONS
        .sort((a, b) => b.priority - a.priority)
        .slice(0, limit);
    }

    const lowerInput = input.toLowerCase();

    const scored = DAILY_COMPLETIONS.map(item => {
      let score = 0;

      if (item.text.startsWith(input)) {
        score += 100;
      } else if (lowerInput.includes(item.text.toLowerCase()) || item.text.toLowerCase().includes(lowerInput)) {
        score += 60;
      } else if (item.display.toLowerCase().includes(lowerInput)) {
        score += 45;
      } else {
        const inputWords = lowerInput.split(/\s+/);
        const itemWords = item.text.toLowerCase().split(/\s+/);
        const overlap = inputWords.filter(w => itemWords.some(iw => iw.includes(w) || iw.includes(w))).length;
        score += overlap * 15;
      }

      const recentBonus = this.history.filter(h => h === item.text).length > 0 ? 10 : 0;
      const categoryWeight = CATEGORY_WEIGHTS[item.category] || 1;

      return {
        ...item,
        score: (score + recentBonus) * item.priority * categoryWeight / 100
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => (b as any).score - (a as any).score)
    .slice(0, limit);

    return scored;
  }

  getByCategory(category: CompletionItem['category']): CompletionItem[] {
    return DAILY_COMPLETIONS
      .filter(item => item.category === category)
      .sort((a, b) => b.priority - a.priority);
  }

  recordUsage(text: string): void {
    this.history.unshift(text);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
    this.saveHistory();
  }

  getRecentUsage(count = 10): string[] {
    return [...this.history].slice(0, count);
  }

  getStatistics(): { total: number; byCategory: Record<string, number>; recentUnique: number } {
    const byCategory: Record<string, number> = {};
    DAILY_COMPLETIONS.forEach(item => {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    });

    return {
      total: DAILY_COMPLETIONS.length,
      byCategory,
      recentUnique: new Set(this.history).size
    };
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem('codecast_daily_completion_history');
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch {}
  }

  private saveHistory(): void {
    try {
      localStorage.setItem('codecast_daily_completion_history', JSON.stringify(this.history));
    } catch {}
  }
}

export const dailyCompletionCache = new DailyCompletionCache();
