import { useMemo } from 'react';
import { v2zh } from '../i18n-keys/zh';
import { v2en } from '../i18n-keys/en';
import { useAppStore } from '../store';

// 所有支持的语言
export const LANGUAGES = {
  'zh-CN': { label: '简体中文', data: v2zh },
  'en-US': { label: 'English', data: v2en },
} as const;

export type LangCode = keyof typeof LANGUAGES;
export type I18nData = typeof v2zh;

/**
 * useI18n — 根据当前语言设置返回对应的翻译对象
 *
 * 用法：
 *   const t = useI18n();
 *   <span>{t.composer.send}</span>
 */
export function useI18n(): I18nData {
  const settings = useAppStore((s) => s.settings);
  const lang = ((settings as Record<string, unknown> | null)?.language as string) || 'zh-CN';

  return useMemo(() => {
    const entry = LANGUAGES[lang as LangCode];
    return entry?.data ?? v2zh;
  }, [lang]);
}

/**
 * 获取当前语言的标签名（如 "简体中文" / "English"）
 */
export function useLangLabel(): string {
  const settings = useAppStore((s) => s.settings);
  const lang = ((settings as Record<string, unknown> | null)?.language as string) || 'zh-CN';
  return LANGUAGES[lang as LangCode]?.label ?? '简体中文';
}
