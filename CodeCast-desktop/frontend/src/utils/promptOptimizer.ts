import { useAppStore } from '../store';
import { getProviderById } from '../types/builtin-providers';
import { logger } from './logger';

/**
 * 调用当前已配置的模型，把用户输入的原始指令改写成更清晰、结构化、
 * 便于 AI 准确理解和执行的高质量 Prompt，并返回改写后的纯文本。
 *
 * 行为：
 * - 读取当前默认 provider 的 baseUrl / apiKey / 选中模型；
 * - 通过 OpenAI 兼容的 /chat/completions 接口发起一次性请求；
 * - 仅返回优化后的指令文本，调用方负责回填输入框。
 *
 * 失败时抛出带可读信息的 Error，由调用方提示用户。
 */
export async function optimizePrompt(rawInput: string): Promise<string> {
  const text = (rawInput || '').trim();
  if (!text) {
    throw new Error('请先输入要优化的内容');
  }

  const state = useAppStore.getState();
  const providerId: string = state.selectedProviderId;
  const provider = getProviderById(providerId);
  const cfg = state.providerConfigs?.[providerId];

  if (!provider) {
    throw new Error('未找到可用的模型服务商，请前往 设置 → 模型管理 配置');
  }

  const apiKey: string = cfg?.apiKey || '';
  const baseUrl: string = (cfg?.baseUrl || provider.baseUrl || '').replace(/\/$/, '');

  if (provider.authType === 'api_key' && !apiKey) {
    throw new Error(`请先在 设置 → 模型管理 中为 ${provider.name} 配置 API Key`);
  }
  if (!baseUrl) {
    throw new Error('当前模型服务商缺少 Base URL 配置');
  }

  // 选用当前选中的模型；若 selectedModel 不属于该 provider，则退回 provider 的首个模型。
  const selected = state.selectedModel;
  const modelExists = provider.models.some((m) => m.id === selected || m.name === selected);
  const model = modelExists ? selected : (provider.models[0]?.id || selected);

  const endpoint = `${baseUrl.replace(/\/v1$/, '')}/v1/chat/completions`;

  const systemPrompt =
    '你是一个 Prompt 优化助手。请把用户给出的原始指令改写成更清晰、具体、结构化、' +
    '便于 AI 准确理解和执行的高质量指令。要求：\n' +
    '1. 保留用户的原始意图和关键信息，不要臆造用户没有提到的需求；\n' +
    '2. 补全模糊表述，让目标、约束、期望输出更明确；\n' +
    '3. 使用与用户输入相同的语言（中文输入则用中文输出）；\n' +
    '4. 直接输出优化后的指令正文本身，不要添加任何解释、前后缀、引号或 Markdown 代码块。';

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e: any) {
    logger.error('PromptOptimizer', '优化请求发送失败', { error: e?.message });
    throw new Error('优化请求失败，请检查网络或模型配置');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('PromptOptimizer', '优化请求返回错误', { status: response.status, detail });
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key 无效或已过期，请在 设置 → 模型管理 中检查');
    }
    throw new Error(`优化失败（HTTP ${response.status}）`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('优化失败：无法解析模型返回内容');
  }

  const optimized: string = data?.choices?.[0]?.message?.content?.trim?.() || '';
  if (!optimized) {
    throw new Error('优化失败：模型未返回有效内容');
  }

  // 去掉模型可能误加的首尾引号 / 代码块包裹
  return stripWrapping(optimized);
}

function stripWrapping(s: string): string {
  let out = s.trim();
  // 去掉 ```lang ... ``` 包裹
  const fenceMatch = out.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) out = fenceMatch[1].trim();
  // 去掉成对的首尾引号
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith('“') && out.endsWith('”')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}
