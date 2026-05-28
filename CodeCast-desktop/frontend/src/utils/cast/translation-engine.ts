import type { LanguageCode, TranslationStyle, TranslationHistoryItem } from '../../types/cast-types';
import { LANGUAGES } from '../../types/cast-types';
import * as api from '../../api';

const LANGUAGE_NAMES: Record<LanguageCode, string> = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.nativeName])
) as Record<LanguageCode, string>;

const STYLE_INSTRUCTIONS: Record<TranslationStyle, string> = {
  literal: '采用直译方式，尽量逐字对应翻译，保留原文的句式结构和词语顺序。',
  free: '采用意译方式，传达原文的意思和情感，使译文符合目标语言的自然表达习惯。',
  colloquial: '采用口语化的翻译风格，使译文读起来像母语者的日常对话。',
  formal: '采用正式书面语的翻译风格，适合商务、学术等正式场合。',
  academic: '采用学术专业风格的翻译，准确使用领域术语和专业表达。'
};

export interface TranslationRequest {
  sourceText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  style: TranslationStyle;
  customTerms?: Array<{ source: string; target: string }>;
  context?: string;
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  alternatives?: string[];
  detectedLanguage?: LanguageCode;
}

export async function translate(req: TranslationRequest, onChunk?: (text: string) => void): Promise<TranslationResult> {
  const sourceName = LANGUAGE_NAMES[req.sourceLang] || req.sourceLang;
  const targetName = LANGUAGE_NAMES[req.targetLang] || req.targetLang;
  const styleInstr = STYLE_INSTRUCTIONS[req.style] || '';

  let termInstruction = '';
  if (req.customTerms && req.customTerms.length > 0) {
    termInstruction = '\n\n术语表（必须严格按以下映射翻译）：\n' +
      req.customTerms.map(t => `- "${t.source}" → "${t.target}"`).join('\n');
  }

  const systemPrompt = `你是一位专业的多语言翻译专家，精通${sourceName}和${targetName}。

翻译规则：
1. ${styleInstr}
2. 保持原文的语义完整性，不遗漏关键信息
3. 译文要符合目标语言的语法和表达习惯
4. 专业术语翻译要准确一致
5. 只输出翻译结果，不要添加任何解释或备注`;

  const userPrompt = `请将以下${sourceName}文本翻译为${targetName}：\n\n${req.sourceText}${termInstruction}${req.context ? `\n\n上下文参考：${req.context}` : ''}`;

  try {
    let translatedText = '';

    const result = await api.sendMessageEx('', `${systemPrompt}\n\n${userPrompt}`, 'deepseek-v4-pro', false);
    translatedText = typeof result === 'string' ? result : '';
    if (onChunk && translatedText) {
      onChunk(translatedText);
    }

    return {
      translatedText: translatedText.trim(),
      confidence: calculateConfidence(req.sourceText, translatedText)
    };
  } catch (error) {
    console.error('[TranslationEngine] Translate failed:', error);
    throw error;
  }
}

export async function batchTranslate(
  texts: string[],
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  style: TranslationStyle = 'free',
  onProgress?: (index: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const result = await translate({
      sourceText: texts[i],
      sourceLang,
      targetLang,
      style
    });
    results.push(result.translatedText);
    onProgress?.(i + 1, texts.length);
  }

  return results;
}

export function detectLanguage(text: string): LanguageCode {
  const chinesePattern = /[\u4e00-\u9fff]/;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;
  const cyrillicPattern = /[\u0400-\u04ff]/;
  const arabicPattern = /[\u0600-\u06ff]/;

  if (chinesePattern.test(text)) return 'zh';
  if (japanesePattern.test(text)) return 'ja';
  if (koreanPattern.test(text)) return 'ko';
  if (cyrillicPattern.test(text)) return 'ru';
  if (arabicPattern.test(text)) return 'ar';

  const latinChars = text.replace(/[^a-zA-Z]/g, '').length;
  const totalChars = text.replace(/\s/g, '').length;

  if (latinChars > totalChars * 0.3) return 'en';

  return 'zh';
}

export function saveToHistory(item: Omit<TranslationHistoryItem, 'id' | 'timestamp'>): TranslationHistoryItem {
  const historyKey = 'codecast_translation_history';
  
  try {
    const raw = localStorage.getItem(historyKey);
    const history: TranslationHistoryItem[] = raw ? JSON.parse(raw) : [];

    const newItem: TranslationHistoryItem = {
      ...item,
      id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now()
    };

    history.unshift(newItem);
    if (history.length > 200) history.length = 200;

    localStorage.setItem(historyKey, JSON.stringify(history));
    return newItem;
  } catch (error) {
    console.error('[TranslationEngine] Save history failed:', error);
    return { ...item, id: '', timestamp: Date.now() };
  }
}

export function getTranslationHistory(limit = 50): TranslationHistoryItem[] {
  try {
    const raw = localStorage.getItem('codecast_translation_history');
    if (!raw) return [];
    const history: TranslationHistoryItem[] = JSON.parse(raw);
    return history.slice(0, limit);
  } catch {
    return [];
  }
}

function calculateConfidence(source: string, translation: string): number {
  if (!source || !translation) return 0;
  const ratio = Math.min(translation.length / source.length, source.length / translation.length);
  const lengthScore = Math.min(ratio * 1.5, 1);
  return Math.round((0.6 + lengthScore * 0.4) * 100);
}
