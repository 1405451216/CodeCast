import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { zhCN, TranslationKeys } from './locales/zh-CN';
import { enUS } from './locales/en-US';

type Locale = 'zh-CN' | 'en-US';

const translations: Record<Locale, TranslationKeys> = {
  'zh-CN': zhCN,
  'en-US': enUS
};

interface I18nContextType {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
  availableLocales: { code: Locale; name: string; nativeName: string }[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'codecast-locale';

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved && saved in translations) {
        return saved as Locale;
      }
    } catch {}

    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) return 'zh-CN';
    return 'en-US';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    } catch {}
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
  }, [locale]);

  const availableLocales = [
    { code: 'zh-CN' as Locale, name: 'Chinese', nativeName: '简体中文' },
    { code: 'en-US' as Locale, name: 'English', nativeName: 'English' }
  ];

  return (
    <I18nContext.Provider value={{ locale, t, setLocale, availableLocales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

  return context;
}

export function useT() {
  const { t } = useTranslation();
  return t;
}

export type { Locale };
export { I18nContext };