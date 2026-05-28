import type { WritingDocType, WritingMode, WritingStyle } from '../../types/cast-types';
import { WRITING_DOC_TYPES, WRITING_STYLES } from '../../types/cast-types';
import * as api from '../../api';

const ROLE_PROMPTS: Record<WritingDocType, string> = {
  'weekly-report': '你是一位专业的项目经理，擅长撰写清晰、结构化的工作周报。',
  'proposal': '你是一位资深方案策划师，具有丰富的商业计划书撰写经验。',
  'copywriting': '你是一位创意文案撰稿人，擅长撰写有感染力的营销文案。',
  'summary': '你是一位信息整理专家，能够从大量内容中提炼核心要点。',
  'email-body': '你是一位商务沟通专家，擅长撰写得体、专业的邮件正文。',
  'ppt-outline': '你是一位演示文稿设计师，擅长设计逻辑清晰、视觉美观的PPT大纲。',
  'resume': '你是一位职业规划师，简历撰写专家，了解各行业招聘偏好。',
  'blog': '你是一位资深博主/技术作家，擅长撰写引人入胜的文章。',
  'custom': '你是一位专业写作者，根据用户需求提供高质量的文本创作服务。'
};

const STYLE_GUIDES: Record<WritingStyle, string> = {
  formal: '使用正式、专业的书面语体，避免口语化表达，用词精准、句式严谨。',
  casual: '使用轻松自然的语气，像朋友间交流一样亲切，可以适当使用口语表达。',
  academic: '使用学术规范的表达方式，客观中立，有据可查，引用需标注来源。',
  marketing: '使用有感染力、吸引人的语言，突出卖点，激发读者兴趣和行动欲望。',
  technical: '使用精确简洁的技术语言，术语准确，逻辑清晰，避免冗余表述。',
  creative: '使用生动有趣的语言，富有想象力和表现力，适当运用修辞手法。'
};

export interface WritingRequest {
  mode: WritingMode;
  docType: WritingDocType;
  style: WritingStyle;
  context?: string;
  userInstruction?: string;
  existingContent?: string;
}

export interface WritingResult {
  content: string;
  outline?: Array<{ level: number; title: string; content?: string }>;
  wordCount: number;
  suggestions?: string[];
}

function buildSystemPrompt(req: WritingRequest): string {
  const rolePrompt = ROLE_PROMPTS[req.docType] || ROLE_PROMPTS.custom;
  const styleGuide = STYLE_GUIDES[req.style] || STYLE_GUIDES.formal;

  return `${rolePrompt}

写作风格要求：${styleGuide}

文档类型：${WRITING_DOC_TYPES.find(t => t.key === req.docType)?.label || req.docType}
输出格式：Markdown

重要规则：
1. 保持内容结构清晰，合理使用标题层级
2. 段落之间逻辑连贯，过渡自然
3. 避免空洞套话，提供具体有价值的内容
4. 字数控制在合理范围内（通常 500-3000 字）
5. 只输出正文内容，不要添加任何解释性文字`;
}

function buildUserPrompt(req: WritingRequest): string {
  switch (req.mode) {
    case 'generate':
      return req.userInstruction || `请写一篇${WRITING_DOC_TYPES.find(t => t.key === req.docType)?.label || ''}。${req.context ? `\n\n背景信息：\n${req.context}` : ''}`;

    case 'continue':
      return `请根据以下已有内容继续写作，保持风格和语境一致：\n\n${req.existingContent || ''}\n\n${req.userInstruction || '请自然地续写下文...'}`;

    case 'polish':
      return `请对以下文本进行润色改写，提升表达的流畅度和专业性：\n\n${req.existingContent || ''}\n\n${req.userInstruction || '润色要求：修正语法错误、优化表达、提升可读性'}`;

    case 'rewrite-expand':
      return `请对以下内容进行扩写，增加细节、案例或论证，使内容更加丰富充实：\n\n${req.existingContent || ''}\n\n${req.userInstruction || '扩写要求：在保持原意的基础上增加约50%-100%的内容'}`;

    case 'rewrite-shrink':
      return `请对以下内容进行精简压缩，去除冗余表达，保留核心信息：\n\n${req.existingContent || ''}\n\n${req.userInstruction || '精简要求：压缩至原文的30%-50%，保留关键信息'}`;

    case 'tone-adjust':
      return `请将以下文本的语气调整为"${WRITING_STYLES.find(s => s.key === req.style)?.label || req.style}"风格：\n\n${req.existingContent || ''}\n\n${req.userInstruction || ''}`;

    default:
      return req.userInstruction || '请开始写作';
  }
}

export async function generateWriting(req: WritingRequest, onChunk?: (text: string) => void): Promise<WritingResult> {
  const systemPrompt = buildSystemPrompt(req);
  const userPrompt = buildUserPrompt(req);

  try {
    let fullContent = '';
    
    const response = await api.sendMessageEx('', `${systemPrompt}\n\n${userPrompt}`, 'deepseek-v4-pro', false);
    fullContent = typeof response === 'string' ? response : '';
    if (onChunk && fullContent) {
      onChunk(fullContent);
    }

    const wordCount = fullContent.replace(/\s/g, '').length;

    return {
      content: fullContent,
      wordCount,
      suggestions: generateSuggestions(req.mode)
    };
  } catch (error) {
    console.error('[WritingEngine] Generate failed:', error);
    throw error;
  }
}

export async function polishText(text: string, style?: WritingStyle): Promise<string> {
  const targetStyle = style || 'formal';
  const styleGuide = STYLE_GUIDES[targetStyle];

  try {
    const result = await api.sendMessageEx('', `你是一位专业的文本润色专家。${styleGuide}\n\n请润色以下文本：\n\n${text}`, 'deepseek-v4-pro', false);

    return typeof result === 'string' ? result : text;
  } catch (error) {
    console.error('[WritingEngine] Polish failed:', error);
    return text;
  }
}

export function extractOutline(content: string): Array<{ level: number; title: string }> {
  const lines = content.split('\n');
  const outline: Array<{ level: number; title: string }> = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      outline.push({
        level: headingMatch[1].length,
        title: headingMatch[2].trim()
      });
    }
  }

  return outline;
}

export function countWords(content: string): { chars: number; words: number; paragraphs: number; readTime: number } {
  const chars = content.length;
  const words = content.replace(/\s/g, '').length;
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim()).length;
  const readTime = Math.max(1, Math.ceil(words / 400));

  return { chars, words, paragraphs, readTime };
}

export function generateSuggestions(mode: WritingMode): string[] {
  const suggestionsMap: Record<WritingMode, string[]> = {
    'generate': ['尝试添加具体数据支撑观点', '考虑加入案例分析', '可以增加引用增强说服力'],
    'continue': ['注意与前文的衔接过渡', '保持一致的写作风格', '检查是否有重复内容'],
    'polish': ['检查语法和拼写', '优化句子长度变化', '统一术语使用'],
    'rewrite-expand': ['添加更多细节描述', '补充相关案例', '增加数据或引用'],
    'rewrite-shrink': ['提炼核心观点', '删除重复表述', '合并相似段落'],
    'tone-adjust': ['检查是否符合目标场景', '调整敬语程度', '优化开头和结尾']
  };

  return suggestionsMap[mode] || [];
}
