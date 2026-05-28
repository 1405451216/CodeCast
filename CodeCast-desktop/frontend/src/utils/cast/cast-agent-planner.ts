import { CastToolRegistry } from '../../tools/CastToolRegistry';
import { sendMessageEx } from '../../api';
import type {
  CastAgentStep,
  CastAgentTask,
  CastAgentTemplate,
  CastAgentTemplateKey
} from '../../types/cast-agent';

function getToolListString(): string {
  const tools = CastToolRegistry.getAll();
  if (tools.length === 0) return '(无可用工具)';

  return tools.map(t => `- ${t.id}: ${t.name} — ${t.description}`).join('\n');
}

const CAST_PLANNING_SYSTEM_PROMPT = `你是Cast工作台的智能任务规划器。你的职责是将用户的自然语言目标分解为一系列可执行的步骤。

## 可用工具列表
${getToolListString()}

## 输出格式要求
严格返回JSON（不要包含markdown代码块标记）:
{
  "intent": "意图分类（如：写作翻译、数据分析、会议处理、邮件处理、日程管理、调研总结等）",
  "entities": { "实体名": "提取的值" },
  "complexity": "simple|moderate|complex",
  "steps": [
    {
      "order": 1,
      "title": "步骤标题",
      "description": "详细描述该步骤要做什么",
      "toolId": "工具ID（必须从上面的可用工具列表中选择一个）",
      "toolParams": { "参数名": "参数值" },
      "requiresApproval": false,
      "inputPreview": "输入摘要"
    }
  ]
}

## 规划规则
1. 每个步骤必须使用上面列表中存在的 toolId
2. 步骤按顺序执行，order 从 1 开始递增
3. simple 任务 1-3 步，moderate 任务 3-5 步，complex 任务 5-8 步
4. 涉及发送邮件、删除数据等不可逆操作时 requiresApproval 设为 true
5. toolParams 必须包含该工具执行所需的关键参数`;

export const CAST_AGENT_TEMPLATES: Record<CastAgentTemplateKey, CastAgentTemplate> = {
  write_and_translate: {
    key: 'write_and_translate',
    name: '写作+翻译',
    description: '先撰写内容再翻译成目标语言',
    icon: '✍️',
    exampleInput: '帮我写一份项目周报并翻译成英文',
    expectedSteps: [
      { toolId: 'write_document', description: '生成原始内容' },
      { toolId: 'translate_text', description: '翻译成目标语言' }
    ]
  },
  meeting_to_knowledge: {
    key: 'meeting_to_knowledge',
    name: '会议→知识库',
    description: '将会议纪要整理后存入知识库',
    icon: '📋',
    exampleInput: '把今天的会议记录整理好存到知识库里',
    expectedSteps: [
      { toolId: 'summarize_meeting', description: '提炼会议要点' },
      { toolId: 'extract_keywords', description: '提取关键标签' },
      { toolId: 'search_knowledge', description: '关联已有知识' }
    ]
  },
  analyze_and_report: {
    key: 'analyze_and_report',
    name: '数据分析+报告',
    description: '对数据进行深度分析并生成可视化报告',
    icon: '📊',
    exampleInput: '分析这组销售数据并生成月度报告',
    expectedSteps: [
      { toolId: 'analyze_data', description: '数据分析与洞察' },
      { toolId: 'write_document', description: '撰写分析报告' },
      { toolId: 'format_convert', description: '格式转换输出' }
    ]
  },
  schedule_and_remind: {
    key: 'schedule_and_remind',
    name: '日程安排+提醒',
    description: '创建日程事项并设置待办提醒',
    icon: '⏰',
    exampleInput: '帮我安排下周的项目计划并设置提醒',
    expectedSteps: [
      { toolId: 'create_schedule', description: '创建日程安排' },
      { toolId: 'create_todo', description: '生成待办清单' }
    ]
  },
  email_polish_send: {
    key: 'email_polish_send',
    name: '邮件润色',
    description: '起草并润色专业邮件内容',
    icon: '📧',
    exampleInput: '帮我写一封给客户的合作邀请邮件',
    expectedSteps: [
      { toolId: 'draft_email', description: '起草邮件内容' }
    ]
  },
  research_summarize: {
    key: 'research_summarize',
    name: '调研总结',
    description: '进行头脑风暴并输出结构化总结',
    icon: '🔍',
    exampleInput: '帮我调研一下AI Agent的发展趋势并总结',
    expectedSteps: [
      { toolId: 'brainstorm', description: '发散思考收集观点' },
      { toolId: 'extract_keywords', description: '提取核心关键词' },
      { toolId: 'summarize_meeting', description: '归纳总结输出' }
    ]
  },
  translate_polish_email: {
    key: 'translate_polish_email',
    name: '翻译+润色+发邮件',
    description: '经典组合：翻译内容后润色并生成正式邮件',
    icon: '🌐',
    exampleInput: '把这份中文方案翻译成英文再润色成一封正式商务邮件',
    expectedSteps: [
      { toolId: 'translate_text', description: '翻译为目标语言' },
      { toolId: 'draft_email', description: '润色为正式邮件' }
    ]
  },
  custom: {
    key: 'custom',
    name: '自定义任务',
    description: '根据你的描述自动规划和执行',
    icon: '🎯',
    exampleInput: '告诉我你想做什么，我来帮你规划和执行',
    expectedSteps: []
  }
};

const TEMPLATE_KEYWORD_MAP: Record<string, CastAgentTemplateKey> = {
  '写': 'write_and_translate',
  '翻译': 'translate_polish_email',
  '英文': 'translate_polish_email',
  'meeting': 'meeting_to_knowledge',
  '会议': 'meeting_to_knowledge',
  '纪要': 'meeting_to_knowledge',
  '知识': 'meeting_to_knowledge',
  '数据': 'analyze_and_report',
  '分析': 'analyze_and_report',
  '报告': 'analyze_and_report',
  '日程': 'schedule_and_remind',
  ' schedule': 'schedule_and_remind',
  '提醒': 'schedule_and_remind',
  'todo': 'schedule_and_remind',
  '待办': 'schedule_and_remind',
  '邮件': 'email_polish_send',
  'email': 'email_polish_send',
  '调研': 'research_summarize',
  '总结': 'research_summarize',
  '头脑风暴': 'research_summarize',
  'brainstorm': 'research_summarize'
};

export function matchTemplateByKeyword(goal: string): CastAgentTemplateKey | null {
  const lowerGoal = goal.toLowerCase();

  for (const [keyword, templateKey] of Object.entries(TEMPLATE_KEYWORD_MAP)) {
    if (lowerGoal.includes(keyword.toLowerCase())) {
      return templateKey;
    }
  }

  return null;
}

export function applyTemplate(
  goal: string,
  templateKey: CastAgentTemplateKey
): Omit<CastAgentStep, 'id' | 'status' | 'startTime' | 'endTime' | 'duration'>[] {
  const template = CAST_AGENT_TEMPLATES[templateKey];
  if (!template || templateKey === 'custom') {
    return [];
  }

  return template.expectedSteps.map((expectedStep, index) => ({
    order: index + 1,
    title: expectedStep.description,
    description: `基于"${goal}"，${expectedStep.description}`,
    toolId: expectedStep.toolId,
    toolParams: extractToolParamsFromGoal(goal, expectedStep.toolId),
    inputPreview: goal.slice(0, 100) + (goal.length > 100 ? '...' : ''),
    requiresApproval: expectedStep.toolId === 'draft_email'
  }));
}

function extractToolParamsFromGoal(goal: string, toolId: string): Record<string, unknown> {
  const baseParams: Record<string, unknown> = { content: goal };

  switch (toolId) {
    case 'translate_text':
      return { ...baseParams, sourceLanguage: 'auto', targetLanguage: 'english' };
    case 'write_document':
      return { ...baseParams, format: 'markdown' };
    case 'draft_email':
      return { ...baseParams, tone: 'professional' };
    case 'create_schedule':
      return { ...baseParams, title: goal.slice(0, 50) };
    case 'create_todo':
      return { items: [{ text: goal.slice(0, 80), priority: 'medium' }] };
    case 'analyze_data':
      return { ...baseParams, analysisType: 'comprehensive' };
    case 'summarize_meeting':
      return { ...baseParams, outputFormat: 'structured' };
    case 'search_knowledge':
      return { query: goal, maxResults: 5 };
    case 'brainstorm':
      return { topic: goal, count: 8 };
    case 'extract_keywords':
      return { text: goal, topN: 10 };
    case 'compare_texts':
      return { textA: goal, textB: '' };
    case 'format_convert':
      return { content: goal, targetFormat: 'pdf' };
    default:
      return baseParams;
  }
}

export async function planCastTask(
  goal: string,
  sessionId?: string,
  templateKey?: CastAgentTemplateKey
): Promise<{
  parsedGoal: CastAgentTask['parsedGoal'];
  steps: Omit<CastAgentStep, 'id' | 'status' | 'startTime' | 'endTime' | 'duration'>[];
}> {
  const resolvedTemplateKey = templateKey || matchTemplateByKeyword(goal) || 'custom';

  if (resolvedTemplateKey !== 'custom') {
    const templateSteps = applyTemplate(goal, resolvedTemplateKey);
    if (templateSteps.length > 0) {
      return {
        parsedGoal: {
          intent: CAST_AGENT_TEMPLATES[resolvedTemplateKey].name,
          entities: extractEntities(goal),
          complexity: inferComplexity(templateSteps.length)
        },
        steps: templateSteps
      };
    }
  }

  return await llmPlanTask(goal, sessionId);
}

async function llmPlanTask(
  goal: string,
  sessionId?: string
): Promise<{
  parsedGoal: CastAgentTask['parsedGoal'];
  steps: Omit<CastAgentStep, 'id' | 'status' | 'startTime' | 'endTime' | 'duration'>[];
}> {
  const userPrompt = `请将以下用户目标分解为可执行的步骤：

用户目标：${goal}

请严格按照上述格式返回JSON。`;

  try {
    const model = 'gpt-4o-mini';
    const response = await sendMessageEx(sessionId || '', userPrompt, model, false);

    let responseText = '';
    if (Array.isArray(response)) {
      responseText = response.map(msg => {
        if (typeof msg === 'string') return msg;
        return (msg as any)?.content || JSON.stringify(msg);
      }).join('\n');
    } else if (typeof response === 'string') {
      responseText = response;
    } else {
      responseText = JSON.stringify(response);
    }

    const cleanedResponse = cleanJsonResponse(responseText);
    const planData = parsePlanJson(cleanedResponse);

    if (planData && planData.steps && Array.isArray(planData.steps)) {
      return {
        parsedGoal: {
          intent: planData.intent || 'general',
          entities: planData.entities || {},
          complexity: planData.complexity || inferComplexity(planData.steps.length)
        },
        steps: planData.steps.map((step: any, index: number) => ({
          order: step.order ?? index + 1,
          title: step.title || `步骤 ${index + 1}`,
          description: step.description || '',
          toolId: step.toolId || '',
          toolParams: step.toolParams || {},
          inputPreview: step.inputPreview || goal.slice(0, 100),
          requiresApproval: !!step.requiresApproval
        }))
      };
    }

    console.warn('[CastAgentPlanner] LLM returned invalid structure, falling back to template');
    return fallbackPlan(goal);
  } catch (error: any) {
    console.error('[CastAgentPlanner] LLM planning failed:', error.message);
    return fallbackPlan(goal);
  }
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();

  const jsonCodeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonCodeBlockMatch) {
    cleaned = jsonCodeBlockMatch[1].trim();
  }

  cleaned = cleaned.replace(/^\s*[\[\{]/m, (match) => {
    const startIndex = cleaned.indexOf(match);
    return cleaned.slice(startIndex);
  });

  return cleaned;
}

function parsePlanJson(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch {
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch {
        return null;
      }
    }

    const looseJsonMatch = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (looseJsonMatch) {
      try {
        return JSON.parse(looseJsonMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function fallbackPlan(goal: string): {
  parsedGoal: CastAgentTask['parsedGoal'];
  steps: Omit<CastAgentStep, 'id' | 'status' | 'startTime' | 'endTime' | 'duration'>[];
} {
  const matchedTemplate = matchTemplateByKeyword(goal);

  if (matchedTemplate && matchedTemplate !== 'custom') {
    const steps = applyTemplate(goal, matchedTemplate);
    if (steps.length > 0) {
      return {
        parsedGoal: {
          intent: CAST_AGENT_TEMPLATES[matchedTemplate].name,
          entities: extractEntities(goal),
          complexity: inferComplexity(steps.length)
        },
        steps
      };
    }
  }

  return {
    parsedGoal: {
      intent: 'general',
      entities: extractEntities(goal),
      complexity: 'moderate'
    },
    steps: [
      {
        order: 1,
        title: '处理用户请求',
        description: `根据用户目标 "${goal}" 进行智能处理`,
        toolId: 'write_document',
        toolParams: { content: goal, format: 'markdown' },
        inputPreview: goal.slice(0, 100) + (goal.length > 100 ? '...' : ''),
        requiresApproval: false
      }
    ]
  };
}

function extractEntities(goal: string): Record<string, string> {
  const entities: Record<string, string> = {};

  const languagePatterns = [
    { pattern: /(?:翻译|translate|译成?|译为)\s*(?:成|为)?\s*(英文|英语|english|中文|日语|japanese|韩文|korean|法文|french|德文|german)/gi, entity: 'targetLanguage' },
    { pattern: /(?:写成?|draft|写一封?)\s*(?:邮件|mail|email|信)/gi, entity: 'outputType', value: 'email' },
    { pattern: /(?:报告|report)/gi, entity: 'outputType', value: 'report' },
    { pattern: /(?:周报|日报|月报)/gi, entity: 'documentType' },
    { pattern: /(?:会议|meeting|纪要)/gi, entity: 'contextType', value: 'meeting' },
    { pattern: /(?:日程|schedule|计划|plan)/gi, entity: 'contextType', value: 'schedule' },
    { pattern: /(?:数据|data|分析|analysis)/gi, entity: 'contextType', value: 'data_analysis' }
  ];

  for (const { pattern, entity, value } of languagePatterns) {
    const match = goal.match(pattern);
    if (match) {
      entities[entity] = value || match[1] || match[0];
    }
  }

  return entities;
}

function inferComplexity(stepCount: number): 'simple' | 'moderate' | 'complex' {
  if (stepCount <= 2) return 'simple';
  if (stepCount <= 4) return 'moderate';
  return 'complex';
}

export function validatePlan(steps: CastAgentStep[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!steps || steps.length === 0) {
    errors.push('步骤列表不能为空');
    return { valid: false, errors };
  }

  const registeredToolIds = new Set(CastToolRegistry.getAll().map(t => t.id));
  const stepOrders = new Set<number>();
  const stepIds = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (!step.id || stepIds.has(step.id)) {
      errors.push(`步骤 ${i + 1}: ID 无效或重复`);
    } else {
      stepIds.add(step.id);
    }

    if (stepOrders.has(step.order)) {
      errors.push(`步骤 ${i + 1}: order 值 ${step.order} 重复`);
    } else {
      stepOrders.add(step.order);
    }

    if (!step.title?.trim()) {
      errors.push(`步骤 ${i + 1}: 标题不能为空`);
    }

    if (!step.toolId?.trim()) {
      errors.push(`步骤 ${i + 1}: toolId 不能为空`);
    } else if (!registeredToolIds.has(step.toolId)) {
      errors.push(`步骤 ${i + 1}: 工具 "${step.toolId}" 未在注册中心找到`);
    }

    if (typeof step.requiresApproval !== 'boolean') {
      errors.push(`步骤 ${i + 1}: requiresApproval 必须是布尔值`);
    }
  }

  const sortedOrders = Array.from(stepOrders).sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i++) {
    if (sortedOrders[i] !== i + 1) {
      errors.push(`步骤 order 不连续，期望从 1 开始连续递增`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
