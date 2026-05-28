import type { EmailTemplateType } from '../../types/cast-types';
import { EMAIL_TEMPLATES } from '../../types/cast-types';
import * as api from '../../api';

export interface EmailDraftRequest {
  templateType: EmailTemplateType;
  variables: Record<string, string>;
  customSubject?: string;
  customBody?: string;
  tone?: 'formal' | 'friendly' | 'urgent' | 'apologetic';
  language?: 'zh' | 'en';
}

export interface PolishedEmail {
  subject: string;
  body: string;
  improvements: string[];
}

export function renderTemplate(templateType: EmailTemplateType, variables: Record<string, string>): { subject: string; body: string } {
  const tmpl = EMAIL_TEMPLATES.find((t: { key: string }) => t.key === templateType);
  if (!tmpl) return { subject: '', body: '' };

  let subject = tmpl.subject;
  let body = tmpl.body;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    subject = subject.split(placeholder).join(value);
    body = body.split(placeholder).join(value);
  });

  return { subject, body };
}

export function getTemplateVariables(templateType: EmailTemplateType): string[] {
  const tmpl = EMAIL_TEMPLATES.find((t: { key: string }) => t.key === templateType);
  if (!tmpl) return [];

  const subjectMatches = tmpl.subject.match(/\{\{(\w+)\}\}/g) || [];
  const bodyMatches = tmpl.body.match(/\{\{(\w+)\}\}/g) || [];
  const allMatches = [...subjectMatches, ...bodyMatches];
  const uniqueVars = [...new Set(allMatches.map(m => m.slice(2, -2)))];

  return uniqueVars;
}

export async function polishEmail(draft: { subject: string; body: string }, tone?: string): Promise<PolishedEmail> {
  const toneInstructions: Record<string, string> = {
    formal: '正式商务语气，专业且礼貌',
    friendly: '友好亲切语气，温暖且有活力',
    urgent: '紧急强调语气，突出事情的重要性和时效性',
    apologetic: '诚恳道歉语气，表达歉意并提出补救措施'
  };

  const toneDesc = tone ? toneInstructions[tone] || tone : '自然得体的商务语气';

  const systemPrompt = `你是一位专业的邮件润色专家。
你的任务是优化邮件的表达，使其更加得体、专业。

当前语气要求：${toneDesc}

优化方向：
1. 检查并修正语法和拼写错误
2. 优化句子结构，使其更流畅
3. 确保礼貌用语恰当
4. 检查邮件格式是否规范
5. 突出重点信息

输出格式（严格 JSON）：
{
  "subject": "优化后的主题",
  "body": "优化后的正文",
  "improvements": ["改进点1", "改进点2"]
}`;

  const userPrompt = `请润色以下邮件：

主题：${draft.subject}

正文：
${draft.body}`;

  try {
    const result = await api.sendMessageEx('', `${systemPrompt}\n\n${userPrompt}`, 'deepseek-v4-pro', false);

    if (typeof result === 'string') {
      const jsonMatch = (result as string).match(/\{[\s\S]*"improvements"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return {
      subject: draft.subject,
      body: draft.body,
      improvements: []
    };
  } catch (error) {
    console.error('[EmailEngine] Polish failed:', error);
    return {
      subject: draft.subject,
      body: draft.body,
      improvements: []
    };
  }
}

export function validateEmail(toAddresses: string[]): { valid: string[]; invalid: string[] } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  toAddresses.forEach(addr => {
    const trimmed = addr.trim();
    if (emailRegex.test(trimmed)) valid.push(trimmed);
    else invalid.push(trimmed);
  });

  return { valid, invalid };
}

export function estimateReadTime(body: string): number {
  const chineseChars = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = body.replace(/[\u4e00-\u9fff\s]/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
  const totalTime = chineseChars / 300 + englishWords / 200;
  return Math.max(0.5, Math.ceil(totalTime));
}

export function extractActionItems(body: string): Array<{ item: string; assignee?: string; deadline?: string }> {
  const actionPatterns = [
    /(?:需要|请|麻烦|希望|要求)[^\n，。！？]*?([^\n，。！？]{2,40}?)(?:[，。！?\n]|$)/g,
    /\[ \]\s*(.+?)(?:\n|$)/g,
    /- \[ \]\s*(.+?)(?:\n|$)/g
  ];

  const items: Array<{ item: string; assignee?: string; deadline?: string }> = [];

  actionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const text = match[1]?.trim();
      if (text && text.length > 1 && !items.some(i => i.item === text)) {
        items.push({ item: text });
      }
    }
  });

  return items;
}

export const SIGNATURE_PLACEHOLDERS = [
  { name: '简洁签名', content: '\n--\n{name}\n{title}' },
  { name: '完整签名', content: '\n--\n{name}\n{title} | {company}\n📧 {email}\n📱 {phone}' },
  { name: '英文签名', content: '\nBest regards,\n{name}\n{title}' },
  { name: '中文正式签名', content: '\n此致\n敬礼！\n\n{name}\n{title}\n{company}\n{date}' }
];
