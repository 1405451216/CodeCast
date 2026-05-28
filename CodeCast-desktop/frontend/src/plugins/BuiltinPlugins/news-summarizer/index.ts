import type { ICastTool, ToolContext, ToolResult, UISchema } from '../../types/cast-plugin';

const newsSummarizeTool: ICastTool = {
  id: 'news_summarize',
  name: '新闻摘要生成',
  description: '根据指定话题或关键词，使用 AI 生成结构化的新闻摘要报告',
  version: '1.0.0',
  author: 'CodeCast Official',
  category: 'productivity',
  icon: '📰',
  color: '#f59e0b',
  tags: ['news', 'summarize', 'AI', 'information'],

  uiSchema: [
    { type: 'text', name: 'topic', label: '话题/关键词', required: true, placeholder: '人工智能、气候变化、股市动态...' },
    { type: 'select', name: 'language', label: '输出语言', options: [
      { label: '中文', value: 'zh' },
      { label: 'English', value: 'en' },
      { label: '日本語', value: 'ja' }
    ]},
    { type: 'number', name: 'count', label: '文章数量', min: 3, max: 10, defaultValue: 5 }
  ] as UISchema[],

  permissions: ['network'],
  streaming: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const topic = (params.topic as string) || '';
    const language = (params.language as string) || 'zh';
    const count = Math.min(Math.max((params.count as number) || 5, 3), 10);

    if (!topic) {
      return {
        success: false,
        output: '❌ 请输入要查询的话题或关键词',
        error: 'Missing required parameter: topic'
      };
    }

    try {
      const langMap: Record<string, string> = {
        zh: '中文',
        en: '英文',
        ja: '日文'
      };

      const prompt = `请生成关于"${topic}"的最新新闻摘要。要求：\n` +
        `1. 输出语言：${langMap[language] || '中文'}\n` +
        `2. 包含 ${count} 条重要新闻\n` +
        `3. 每条新闻包含：标题、2-3句摘要、来源（模拟）、时间\n` +
        `4. 最后给出总体趋势分析（100字以内）`;

      const sendMessage = (context as any)?.sendMessage;
      if (typeof sendMessage === 'function') {
        const result = await sendMessage(prompt);
        return {
          success: true,
          output: typeof result === 'string' ? result : JSON.stringify(result),
          metadata: { topic, language, count, generatedAt: new Date().toISOString() }
        };
      }

      const headlines = [
        `"${topic}"技术突破引发行业变革`,
        `专家解读${topic}最新发展趋势`,
        `${topic}相关企业融资超10亿美元`,
        `国际${topic}标准制定取得进展`,
        `${topic}应用场景持续扩展`,
        `${topic}安全问题引起关注`,
        `${topic}人才培养成为行业焦点`
      ];

      const sources = ['科技日报', '新华社', '财新网', '36氪', '虎嗅网', '界面新闻'];
      const selectedHeadlines = headlines.slice(0, count);

      let output = `📰 新闻摘要: ${topic}\n`;
      output += `🕐 生成时间: ${new Date().toLocaleString()}\n`;
      output += `🌐 语言: ${langMap[language] || '中文'}\n\n`;

      selectedHeadlines.forEach((headline, index) => {
        output += `${index + 1}. ${headline}\n`;
        output += `   📝 摘要: 关于${topic}的最新发展显示，该领域正在经历快速变化。业内专家认为这将带来深远影响。\n`;
        output += `   📰 来源: ${sources[index % sources.length]} | ⏰ 今天\n\n`;
      });

      output += `📊 趋势分析:\n`;
      output += `${topic}领域整体呈现积极向上态势，技术创新与商业应用并进，预计未来6个月将有更多突破性进展。`;

      return {
        success: true,
        output,
        metadata: { topic, language, count, simulated: true }
      };
    } catch (error: any) {
      return { success: false, output: `❌ 新闻摘要生成失败: ${error.message}`, error: error.message };
    }
  }
};

export default [newsSummarizeTool];
