import type { AgentTool } from '../types';
import { ToolPermission } from '../types';
import * as api from '../../api';
import { generateWriting, polishText, extractOutline, countWords } from '../../utils/cast/writing-engine';
import { translate, batchTranslate, detectLanguage } from '../../utils/cast/translation-engine';
import { useScheduleStore } from '../../store/useScheduleStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { renderTemplate, polishEmail, extractActionItems } from '../../utils/cast/email-engine';

const castTools: AgentTool[] = [
  {
    id: 'write_document',
    name: '写文档',
    description: '根据用户需求生成各类文档，包括周报、方案书、文案、总结、PPT大纲等。支持多种写作模式和风格。',
    parameters: [
      { name: 'doc_type', type: 'string', description: '文档类型：weekly-report/proposal/copywriting/summary/email-body/ppt-outline/resume/blog', required: true },
      { name: 'content_requirement', type: 'string', description: '文档内容要求或主题描述', required: true },
      { name: 'style', type: 'string', description: '写作风格：formal/casual/academic/marketing/technical/creative', required: false },
      { name: 'mode', type: 'string', description: '写作模式：generate/continue/polish/rewrite-expand/rewrite-shrink/tone-adjust', required: false }
    ],
    permission: ToolPermission.WRITE,
    requiresPermission: false,
    category: 'writing' as any,
    execute: async (params, context) => {
      const docType = params.doc_type || 'custom';
      const content = params.content_requirement || '';
      const style = (params.style as any) || 'formal';
      const mode = (params.mode as any) || 'generate';

      try {
        const result = await generateWriting({
          mode,
          docType: docType as any,
          style: style as any,
          userInstruction: content
        });

        return {
          success: true,
          output: `✅ 文档已生成（${result.wordCount}字）：\n\n${result.content}`,
          metadata: { wordCount: result.wordCount, docType, mode }
        };
      } catch (error: any) {
        return { success: false, output: `❌ 文档生成失败: ${error.message}`, error: error.message };
      }
    }
  },
  {
    id: 'translate_text',
    name: '翻译',
    description: '在15+语言之间进行高质量翻译，支持直译/意译/口语化/正式/学术等风格，支持术语表管理。',
    parameters: [
      { name: 'text', type: 'string', description: '需要翻译的文本', required: true },
      { name: 'target_lang', type: 'string', description: '目标语言代码：en/ja/ko/fr/de/es/ru 等', required: true },
      { name: 'source_lang', type: 'string', description: '源语言（不指定则自动检测）', required: false },
      { name: 'style', type: 'string', description: '翻译风格：literal/free/colloquial/formal/academic', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'translate' as any,
    execute: async (params, context) => {
      const text = params.text || '';
      const targetLang = params.target_lang || 'en';
      const sourceLang = (params.source_lang as any) || detectLanguage(text);
      const style = (params.style as any) || 'free';

      if (!text.trim()) {
        return { success: false, output: '❌ 请提供需要翻译的文本' };
      }

      try {
        const result = await translate({
          sourceText: text,
          sourceLang,
          targetLang: targetLang as any,
          style: style as any
        });

        return {
          success: true,
          output: `🌐 翻译结果 (${sourceLang} → ${targetLang})：\n\n${result.translatedText}`,
          metadata: { confidence: result.confidence }
        };
      } catch (error: any) {
        return { success: false, output: `❌ 翻译失败: ${error.message}` };
      }
    }
  },
  {
    id: 'search_knowledge',
    name: '搜知识库',
    description: '搜索本地知识库笔记，支持标题、内容、标签全文检索。',
    parameters: [
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'limit', type: 'number', description: '返回结果数量限制', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'knowledge' as any,
    execute: async (params, context) => {
      const query = params.query || '';
      const limit = params.limit || 5;

      if (!query.trim()) {
        return { success: false, output: '❌ 请输入搜索关键词' };
      }

      const results = useKnowledgeStore.getState().searchNotes(query).slice(0, limit);

      if (results.length === 0) {
        return { success: true, output: `📚 搜索 "${query}" 未找到匹配的笔记` };
      }

      const output = results.map((note, i) =>
        `${i + 1}. **${note.title}** [${note.category}]\n   ${note.tags.map(t => `#${t}`).join(' ')}\n   ${note.content.slice(0, 150)}...`
      ).join('\n\n');

      return {
        success: true,
        output: `📚 找到 ${results.length} 条相关笔记：\n\n${output}`,
        metadata: { count: results.length }
      };
    }
  },
  {
    id: 'create_schedule',
    name: '建日程',
    description: '创建待办事项或日程安排，支持设置优先级、标签、截止日期等。',
    parameters: [
      { name: 'title', type: 'string', description: '待办事项标题', required: true },
      { name: 'description', type: 'string', description: '详细描述', required: false },
      { name: 'priority', type: 'string', description: '优先级：urgent/important/normal/low', required: false },
      { name: 'tags', type: 'array', description: '标签列表', required: false },
      { name: 'due_date', type: 'string', description: '截止日期（ISO格式或自然语言）', required: false }
    ],
    permission: ToolPermission.WRITE,
    requiresPermission: false,
    category: 'schedule' as any,
    execute: async (params, context) => {
      const title = params.title || '';
      if (!title.trim()) {
        return { success: false, output: '❌ 请输入待办事项标题' };
      }

      let dueDate: number | undefined;
      if (params.due_date) {
        dueDate = new Date(params.due_date).getTime();
        if (isNaN(dueDate)) dueDate = undefined;
      }

      const id = useScheduleStore.getState().addTodo({
        title,
        description: params.description,
        priority: (params.priority as any) || 'normal',
        status: 'pending',
        tags: (params.tags as string[]) || [],
        dueDate
      });

      return {
        success: true,
        output: `✅ 待办事项已创建：**${title}**\n📋 ID: ${id}\n🔴 优先级: ${params.priority || 'normal'}\n${dueDate ? `⏰ 截止: ${new Date(dueDate).toLocaleString()}` : ''}`
      };
    }
  },
  {
    id: 'draft_email',
    name: '写邮件',
    description: '根据模板起草邮件，支持10种邮件类型，可进行AI润色。',
    parameters: [
      { name: 'template_type', type: 'string', description: '邮件模板：application/report/invitation/apology/thanks/notice/follow-up/introduction/leave/custom', required: false },
      { name: 'subject', type: 'string', description: '邮件主题', required: false },
      { name: 'body_content', type: 'string', description: '邮件正文内容或关键信息', required: true },
      { name: 'variables', type: 'object', description: '模板变量映射', required: false },
      { name: 'polish', type: 'boolean', description: '是否AI润色', required: false }
    ],
    permission: ToolPermission.WRITE,
    requiresPermission: false,
    category: 'email' as any,
    execute: async (params, context) => {
      const bodyContent = params.body_content || '';

      if (!bodyContent.trim()) {
        return { success: false, output: '❌ 请提供邮件正文内容' };
      }

      if (params.polish && params.subject) {
        try {
          const polished = await polishEmail({ subject: params.subject, body: bodyContent });
          return {
            success: true,
            output: `📧 邮件已润色完成：\n\n**主题**: ${polished.subject}\n\n**正文**:\n${polished.body}\n\n💡 改进点:\n- ${polished.improvements.join('\n- ')}`,
            metadata: { improvements: polished.improvements }
          };
        } catch (error: any) {
          return { success: false, output: `❌ 邮件润色失败: ${error.message}` };
        }
      }

      return {
        success: true,
        output: `📧 邮件草稿：\n\n**主题**: ${params.subject || '(待填写)'}\n\n**正文**:\n${bodyContent}`
      };
    }
  },
  {
    id: 'analyze_data',
    name: '数据分析',
    description: '对用户提供的文本数据进行分析，提取趋势、统计信息并生成摘要。',
    parameters: [
      { name: 'data', type: 'string', description: '需要分析的数据文本', required: true },
      { name: 'analysis_type', type: 'string', description: '分析类型：trend/summary/statistics/comparison', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'analysis' as any,
    execute: async (params, context) => {
      const data = params.data || '';
      if (!data.trim()) {
        return { success: false, output: '❌ 请提供需要分析的数据' };
      }

      try {
        const analysisType = params.analysis_type || 'summary';
        const prompt = `请对以下数据进行${analysisType === 'trend' ? '趋势' : analysisType === 'statistics' ? '统计分析' : analysisType === 'comparison' ? '对比' : '综合'}分析：

${data}

请输出结构化的分析结果，包括：
1. 关键数据点
2. 主要发现
3. 结论和建议`;

        const result = await api.sendMessageEx(context?.sessionId || '', prompt, 'deepseek-v4-pro', false);

        return {
          success: true,
          output: `📊 数据分析结果：\n\n${typeof result === 'string' ? result : JSON.stringify(result)}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 数据分析失败: ${error.message}` };
      }
    }
  },
  {
    id: 'summarize_meeting',
    name: '会议纪要',
    description: '从会议记录中提炼要点，生成结构化的会议纪要和行动项。',
    parameters: [
      { name: 'meeting_notes', type: 'string', description: '原始会议记录或讨论要点', required: true },
      { name: 'format', type: 'string', description: '输出格式：structured/brief/detailed', required: false }
    ],
    permission: ToolPermission.WRITE,
    requiresPermission: false,
    category: 'meeting' as any,
    execute: async (params, context) => {
      const notes = params.meeting_notes || '';
      if (!notes.trim()) {
        return { success: false, output: '❌ 请提供会议记录内容' };
      }

      try {
        const format = params.format || 'structured';
        const prompt = format === 'brief'
          ? `请将以下会议记录精炼为简明纪要（不超过200字）：\n\n${notes}`
          : `请根据以下会议记录，生成结构化的会议纪要，包含：\n1. 会议基本信息（时间、参与人、主题）\n2. 讨论要点（按议题分类）\n3. 决议事项\n4. 行动项（负责人+截止日期）\n\n原始记录：\n${notes}`;

        const result = await api.sendMessageEx(context?.sessionId || '', prompt, 'deepseek-v4-pro', false);

        const actionItems = extractActionItems(notes);
        const actionText = actionItems.length > 0
          ? `\n\n📋 提取的行动项：\n${actionItems.map((a, i) => `${i + 1}. ${a.item}${a.assignee ? ` (@${a.assignee})` : ''}${a.deadline ? ` [截止:${a.deadline}]` : ''}`).join('\n')}`
          : '';

        return {
          success: true,
          output: `📝 会议纪要：\n\n${typeof result === 'string' ? result : ''}${actionText}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 会议纪要生成失败: ${error.message}` };
      }
    }
  },
  {
    id: 'create_todo',
    name: '建待办',
    description: '快速创建一个简单的待办事项。',
    parameters: [
      { name: 'task', type: 'string', description: '待办内容', required: true },
      { name: 'priority', type: 'string', description: '优先级：high/medium/low', required: false }
    ],
    permission: ToolPermission.WRITE,
    requiresPermission: false,
    category: 'schedule' as any,
    execute: async (params, context) => {
      const task = params.task || '';
      if (!task.trim()) {
        return { success: false, output: '❌ 请输入待办内容' };
      }

      const priMap: Record<string, any> = { high: 'urgent', medium: 'important', low: 'normal' };
      const id = useScheduleStore.getState().addTodo({
        title: task,
        priority: priMap[params.priority || ''] || 'normal',
        status: 'pending',
        tags: []
      });

      return { success: true, output: `✅ 待办已创建：**${task}**` };
    }
  },
  {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '围绕给定主题进行创意发散，生成多个创意方向。',
    parameters: [
      { name: 'topic', type: 'string', description: '头脑风暴的主题', required: true },
      { name: 'count', type: 'number', description: '期望生成的创意数量', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'creative' as any,
    execute: async (params, context) => {
      const topic = params.topic || '';
      if (!topic.trim()) {
        return { success: false, output: '❌ 请输入头脑风暴主题' };
      }

      const count = params.count || 8;

      try {
        const systemPrompt = '你是一位创意思维专家，擅长多角度思考和创新性想法的产生。请围绕用户给出的主题，生成有深度、有创意的想法。每个想法用序号标注，并简要说明其价值。';
        const userPrompt = `请围绕"${topic}"进行头脑风暴，给出${count}个不同的创意方向。每个方向包括：名称（2-4字）、核心思路（一句话）、潜在价值（一句话）。`;
        const result = await api.sendMessageEx(context?.sessionId || '', `[系统指令]\n${systemPrompt}\n\n${userPrompt}`, 'deepseek-v4-pro', false);

        return {
          success: true,
          output: `💡 关于"${topic}"的创意方向：\n\n${typeof result === 'string' ? result : ''}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 头脑风暴失败: ${error.message}` };
      }
    }
  },
  {
    id: 'extract_keywords',
    name: '提取关键词',
    description: '从文本中提取关键词和核心概念。',
    parameters: [
      { name: 'text', type: 'string', description: '需要分析的文本', required: true },
      { name: 'max_count', type: 'number', description: '最大关键词数量', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'analysis' as any,
    execute: async (params, context) => {
      const text = params.text || '';
      if (!text.trim()) {
        return { success: false, output: '❌ 请提供需要分析的文本' };
      }

      const maxCount = params.max_count || 10;

      try {
        const result = await api.sendMessageEx(context?.sessionId || '', `[系统指令]\n你是文本分析专家。请从给定文本中提取最重要的关键词和核心概念，按重要性排序输出。只输出关键词列表，每行一个，格式：权重(1-10) 关键词\n\n请从以下文本中提取前${maxCount}个关键词：\n\n${text.slice(0, 3000)}`, 'deepseek-v4-pro', false);

        return {
          success: true,
          output: `🔑 关键词提取结果：\n\n${typeof result === 'string' ? result : ''}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 关键词提取失败: ${error.message}` };
      }
    }
  },
  {
    id: 'compare_texts',
    name: '文本对比',
    description: '对比两段文本的差异，找出相同点和不同点。',
    parameters: [
      { name: 'text_a', type: 'string', description: '第一段文本', required: true },
      { name: 'text_b', type: 'string', description: '第二段文本', required: true },
      { name: 'aspect', type: 'string', description: '对比维度：content/style/tone/length/all', required: false }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'analysis' as any,
    execute: async (params, context) => {
      const textA = params.text_a || '';
      const textB = params.text_b || '';

      if (!textA.trim() || !textB.trim()) {
        return { success: false, output: '❌ 请提供两段需要对比的文本' };
      }

      const aspect = params.aspect || 'all';

      try {
        const aspectDesc = {
          content: '内容和观点',
          style: '表达方式和文风',
          tone: '语气和情感倾向',
          length: '篇幅和信息密度',
          all: '全面对比（内容、风格、语气、篇幅）'
        };

        const result = await api.sendMessageEx(context?.sessionId || '', `请从${aspectDesc[aspect as keyof typeof aspectDesc] || '多个'}维度对比以下两段文本：\n\n【文本A】\n${textA}\n\n【文本B】\n${textB}\n\n请以结构化的方式列出相同点和不同点。`, 'deepseek-v4-pro', false);

        return {
          success: true,
          output: `⚖️ 文本对比结果（维度：${aspect}）：\n\n${typeof result === 'string' ? result : ''}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 文本对比失败: ${error.message}` };
      }
    }
  },
  {
    id: 'format_convert',
    name: '格式转换',
    description: '将文本在不同格式之间转换，如 Markdown ↔ HTML ↔ 纯文本。',
    parameters: [
      { name: 'text', type: 'string', description: '源文本', required: true },
      { name: 'from_format', type: 'string', description: '源格式：markdown/html/plain', required: true },
      { name: 'to_format', type: 'string', description: '目标格式：markdown/html/plain', required: true }
    ],
    permission: ToolPermission.READ,
    requiresPermission: false,
    category: 'utility' as any,
    execute: async (params, context) => {
      const text = params.text || '';
      const fromFormat = params.from_format || 'plain';
      const toFormat = params.to_format || 'markdown';

      if (!text.trim()) {
        return { success: false, output: '❌ 请提供需要转换的文本' };
      }

      try {
        const result = await api.sendMessageEx(context?.sessionId || '', `[系统指令]\n你是格式转换专家。请严格按照用户指定的格式要求进行转换，不要添加任何额外解释。只输出转换后的结果。\n\n请将以下${fromFormat}格式文本转换为${toFormat}格式：\n\n${text}`, 'deepseek-v4-pro', false);

        return {
          success: true,
          output: `🔄 格式转换（${fromFormat} → ${toFormat}）：\n\n${typeof result === 'string' ? result : ''}`
        };
      } catch (error: any) {
        return { success: false, output: `❌ 格式转换失败: ${error.message}` };
      }
    }
  }
];

export async function registerCastTools(): Promise<void> {
  try {
    const { register } = await import('../ToolRegistry').then(m => m.default || m);

    if (typeof register === 'function') {
      castTools.forEach(tool => {
        try {
          register(tool);
        } catch (e) {
          console.warn(`[CastTools] Failed to register ${tool.id}:`, e);
        }
      });
      console.log(`[CastTools] Registered ${castTools.length} Cast tools`);
    }
  } catch (e) {
    console.warn('[CastTools] ToolRegistry not available:', e);
  }
}

export default castTools;
