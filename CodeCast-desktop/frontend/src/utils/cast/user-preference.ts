export interface UserPreference {
  favoriteWritingStyle?: string;
  favoriteTranslationPair?: { from: string; to: string };
  preferredEmailTone?: string;
  typicalWorkHours?: { start: number; end: number };
  quickActions?: string[];
  panelUsageOrder?: string[];
  contentLengthPreference?: 'short' | 'medium' | 'long';
  lastUsedTemplates?: Record<string, string>;
}

const PREFERENCE_STORAGE_KEY = 'codecast_cast_preferences';

const DEFAULT_PREFERENCE: UserPreference = {
  favoriteWritingStyle: 'formal',
  favoriteTranslationPair: { from: 'zh', to: 'en' },
  preferredEmailTone: 'formal',
  typicalWorkHours: { start: 9, end: 18 },
  quickActions: [],
  panelUsageOrder: ['writing', 'translate', 'schedule', 'knowledge', 'email', 'tools'],
  contentLengthPreference: 'medium',
  lastUsedTemplates: {}
};

function readStorage(): UserPreference {
  try {
    const raw = localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserPreference;
    }
  } catch (error) {
    console.error('[UserPreference] Read failed:', error);
  }
  return { ...DEFAULT_PREFERENCE };
}

function writeStorage(pref: UserPreference): void {
  try {
    localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(pref));
  } catch (error) {
    console.error('[UserPreference] Write failed:', error);
  }
}

export function getUserPreference(): UserPreference {
  return readStorage();
}

export function updateUserPreference(updates: Partial<UserPreference>): void {
  const current = readStorage();
  const updated = { ...current, ...updates };
  writeStorage(updated);
}

export function recordPanelUsage(panelId: string): void {
  const pref = readStorage();
  const order = pref.panelUsageOrder ? [...pref.panelUsageOrder] : [];

  const existingIndex = order.indexOf(panelId);
  if (existingIndex > -1) {
    order.splice(existingIndex, 1);
  }

  order.unshift(panelId);

  updateUserPreference({ panelUsageOrder: order });
}

export function recordTemplateUsage(templateType: string, templateId: string): void {
  const pref = readStorage();
  const templates = pref.lastUsedTemplates ? { ...pref.lastUsedTemplates } : {};
  templates[templateType] = templateId;

  updateUserPreference({ lastUsedTemplates: templates });
}

export function getPreferredLanguagePair(): { from: string; to: string } {
  const pref = readStorage();
  return pref.favoriteTranslationPair || DEFAULT_PREFERENCE.favoriteTranslationPair!;
}

export function getSuggestedActions(): string[] {
  const pref = readStorage();

  if (pref.quickActions && pref.quickActions.length >= 3) {
    return pref.quickActions.slice(0, 5);
  }

  const suggestions: string[] = [];

  if (pref.favoriteWritingStyle) {
    suggestions.push(`用${pref.favoriteWritingStyle}风格写作`);
  }

  const langPair = getPreferredLanguagePair();
  if (langPair.from && langPair.to) {
    suggestions.push(`${langPair.from}→${langPair.to}翻译`);
  }

  if (pref.contentLengthPreference) {
    const lengthLabel: Record<string, string> = {
      short: '生成简短内容',
      medium: '生成中等长度内容',
      long: '生成详细内容'
    };
    suggestions.push(lengthLabel[pref.contentLengthPreference]);
  }

  suggestions.push('整理今日待办');
  suggestions.push('写一封邮件');

  return suggestions.slice(0, 6);
}
