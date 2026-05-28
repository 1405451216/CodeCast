import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CastWorkspaceTab } from '../types/cast-types';

export interface CastGeneralSettings {
  defaultLLMModel: string;
  autoSaveMemory: boolean;
  memoryAutoSaveThreshold: number;
  showMemoryIndicator: boolean;
  startupTab: CastWorkspaceTab;
  workspaceDefaultHeight: number;
  enableAnimations: boolean;
  compactMode: boolean;
  language: 'zh-CN' | 'en-US';
}

export interface CastWriterSettings {
  defaultDocType: string;
  defaultWritingStyle: string;
  defaultWritingMode: string;
  autoSaveDraft: boolean;
  draftSaveInterval: number;
  wordCountDisplay: boolean;
  outlineAutoExtract: boolean;
  markdownPreview: boolean;
}

export interface CastTranslatorSettings {
  defaultSourceLang: string;
  defaultTargetLang: string;
  defaultTranslationStyle: string;
  autoDetectLanguage: boolean;
  maxHistoryItems: number;
  showConfidenceScore: boolean;
  termTableEnabled: boolean;
}

export interface CastScheduleSettings {
  defaultReminderAdvance: number;
  enableSoundNotification: boolean;
  enableDesktopNotification: boolean;
  autoArchiveCompleted: boolean;
  archiveAfterDays: number;
  workingHoursStart: number;
  workingHoursEnd: number;
}

export interface CastKnowledgeSettings {
  defaultCategory: string;
  autoGenerateSummary: boolean;
  enableTagCloud: boolean;
  maxNotesPerCategory: number;
  exportFormat: 'json' | 'markdown' | 'both';
}

export interface CastEmailSettings {
  defaultTemplate: string;
  signature: string;
  autoPolish: boolean;
  defaultTone: string;
  readingTimeEstimate: boolean;
}

export interface CastSchedulerSettings {
  enableOnStartup: boolean;
  defaultLogLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentTasks: number;
  taskTimeout: number;
  retainLogDays: number;
}

export interface CastAdvancedSettings {
  developerMode: boolean;
  telemetryEnabled: boolean;
  cacheSizeMB: number;
  experimentalFeatures: boolean;
  customApiEndpoint: string;
  requestTimeout: number;
  maxRetries: number;
}

export interface CastPrivacySettings {
  outboundMode: 'allow_all' | 'prompt_all' | 'deny_all';
  auditLogRetentionDays: number;
  autoMaskSensitiveData: boolean;
  llmDataMinimization: boolean;
  showOutboundConfirmation: boolean;
}

export const DEFAULT_CAST_SETTINGS = {
  general: {
    defaultLLMModel: 'deepseek-v4-flash',
    autoSaveMemory: true,
    memoryAutoSaveThreshold: 50,
    showMemoryIndicator: true,
    startupTab: 'writing' as CastWorkspaceTab,
    workspaceDefaultHeight: 420,
    enableAnimations: true,
    compactMode: false,
    language: 'zh-CN' as const,
  },
  writer: {
    defaultDocType: 'weekly-report',
    defaultWritingStyle: 'formal',
    defaultWritingMode: 'generate',
    autoSaveDraft: true,
    draftSaveInterval: 30,
    wordCountDisplay: true,
    outlineAutoExtract: true,
    markdownPreview: true,
  },
  translator: {
    defaultSourceLang: 'zh',
    defaultTargetLang: 'en',
    defaultTranslationStyle: 'literal',
    autoDetectLanguage: true,
    maxHistoryItems: 100,
    showConfidenceScore: false,
    termTableEnabled: true,
  },
  schedule: {
    defaultReminderAdvance: 15,
    enableSoundNotification: true,
    enableDesktopNotification: true,
    autoArchiveCompleted: false,
    archiveAfterDays: 30,
    workingHoursStart: 9,
    workingHoursEnd: 18,
  },
  knowledge: {
    defaultCategory: 'work',
    autoGenerateSummary: true,
    enableTagCloud: true,
    maxNotesPerCategory: 200,
    exportFormat: 'json' as const,
  },
  email: {
    defaultTemplate: 'application',
    signature: '',
    autoPolish: false,
    defaultTone: 'formal',
    readingTimeEstimate: true,
  },
  scheduler: {
    enableOnStartup: false,
    defaultLogLevel: 'info' as const,
    maxConcurrentTasks: 3,
    taskTimeout: 120,
    retainLogDays: 7,
  },
  advanced: {
    developerMode: false,
    telemetryEnabled: false,
    cacheSizeMB: 100,
    experimentalFeatures: false,
    customApiEndpoint: '',
    requestTimeout: 60,
    maxRetries: 3,
  },
  privacy: {
    outboundMode: 'prompt_all' as const,
    auditLogRetentionDays: 30,
    autoMaskSensitiveData: true,
    llmDataMinimization: false,
    showOutboundConfirmation: true,
  },
} as const;

type CastSettingsSection = 'general' | 'writer' | 'translator' | 'schedule' | 'knowledge' | 'email' | 'scheduler' | 'advanced' | 'privacy';

interface CastSettingsState {
  general: CastGeneralSettings;
  writer: CastWriterSettings;
  translator: CastTranslatorSettings;
  schedule: CastScheduleSettings;
  knowledge: CastKnowledgeSettings;
  email: CastEmailSettings;
  scheduler: CastSchedulerSettings;
  advanced: CastAdvancedSettings;
  privacy: CastPrivacySettings;

  isInitialized: boolean;

  updateGeneral: (updates: Partial<CastGeneralSettings>) => void;
  updateWriter: (updates: Partial<CastWriterSettings>) => void;
  updateTranslator: (updates: Partial<CastTranslatorSettings>) => void;
  updateSchedule: (updates: Partial<CastScheduleSettings>) => void;
  updateKnowledge: (updates: Partial<CastKnowledgeSettings>) => void;
  updateEmail: (updates: Partial<CastEmailSettings>) => void;
  updateScheduler: (updates: Partial<CastSchedulerSettings>) => void;
  updateAdvanced: (updates: Partial<CastAdvancedSettings>) => void;
  updatePrivacy: (updates: Partial<CastPrivacySettings>) => void;

  resetToDefaults: (section?: CastSettingsSection) => void;
  exportSettings: () => string;
  importSettings: (json: string) => { success: boolean; errors: string[] };

  loadFromStorage: () => void;
  saveToStorage: () => void;

  getDefaultModel: () => string;
  isAutoSaveEnabled: () => boolean;
  getStartupTab: () => CastWorkspaceTab;
}

const STORAGE_KEY = 'codecast_cast_settings';

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceVal = (source as any)[key];
      if (sourceVal !== undefined && sourceVal !== null) {
        (result as any)[key] = sourceVal;
      }
    }
  }
  return result;
}

export const useCastSettingsStore = create<CastSettingsState>()(
  devtools(
    (set, get) => ({
      general: { ...DEFAULT_CAST_SETTINGS.general },
      writer: { ...DEFAULT_CAST_SETTINGS.writer },
      translator: { ...DEFAULT_CAST_SETTINGS.translator },
      schedule: { ...DEFAULT_CAST_SETTINGS.schedule },
      knowledge: { ...DEFAULT_CAST_SETTINGS.knowledge },
      email: { ...DEFAULT_CAST_SETTINGS.email },
      scheduler: { ...DEFAULT_CAST_SETTINGS.scheduler },
      advanced: { ...DEFAULT_CAST_SETTINGS.advanced },
      privacy: { ...DEFAULT_CAST_SETTINGS.privacy },

      isInitialized: false,

      updateGeneral: (updates) => {
        set((state) => ({
          general: deepMerge(state.general, updates),
        }));
        get().saveToStorage();
      },

      updateWriter: (updates) => {
        set((state) => ({
          writer: deepMerge(state.writer, updates),
        }));
        get().saveToStorage();
      },

      updateTranslator: (updates) => {
        set((state) => ({
          translator: deepMerge(state.translator, updates),
        }));
        get().saveToStorage();
      },

      updateSchedule: (updates) => {
        set((state) => ({
          schedule: deepMerge(state.schedule, updates),
        }));
        get().saveToStorage();
      },

      updateKnowledge: (updates) => {
        set((state) => ({
          knowledge: deepMerge(state.knowledge, updates),
        }));
        get().saveToStorage();
      },

      updateEmail: (updates) => {
        set((state) => ({
          email: deepMerge(state.email, updates),
        }));
        get().saveToStorage();
      },

      updateScheduler: (updates) => {
        set((state) => ({
          scheduler: deepMerge(state.scheduler, updates),
        }));
        get().saveToStorage();
      },

      updateAdvanced: (updates) => {
        set((state) => ({
          advanced: deepMerge(state.advanced, updates),
        }));
        get().saveToStorage();
      },

      updatePrivacy: (updates) => {
        set((state) => ({
          privacy: deepMerge(state.privacy, updates),
        }));
        get().saveToStorage();
      },

      resetToDefaults: (section) => {
        if (!section) {
          set({
            general: { ...DEFAULT_CAST_SETTINGS.general },
            writer: { ...DEFAULT_CAST_SETTINGS.writer },
            translator: { ...DEFAULT_CAST_SETTINGS.translator },
            schedule: { ...DEFAULT_CAST_SETTINGS.schedule },
            knowledge: { ...DEFAULT_CAST_SETTINGS.knowledge },
            email: { ...DEFAULT_CAST_SETTINGS.email },
            scheduler: { ...DEFAULT_CAST_SETTINGS.scheduler },
            advanced: { ...DEFAULT_CAST_SETTINGS.advanced },
            privacy: { ...DEFAULT_CAST_SETTINGS.privacy },
          });
        } else {
          const defaultsMap: Record<string, any> = {
            general: { ...DEFAULT_CAST_SETTINGS.general },
            writer: { ...DEFAULT_CAST_SETTINGS.writer },
            translator: { ...DEFAULT_CAST_SETTINGS.translator },
            schedule: { ...DEFAULT_CAST_SETTINGS.schedule },
            knowledge: { ...DEFAULT_CAST_SETTINGS.knowledge },
            email: { ...DEFAULT_CAST_SETTINGS.email },
            scheduler: { ...DEFAULT_CAST_SETTINGS.scheduler },
            advanced: { ...DEFAULT_CAST_SETTINGS.advanced },
            privacy: { ...DEFAULT_CAST_SETTINGS.privacy },
          };
          set({ [section]: defaultsMap[section] } as any);
        }
        get().saveToStorage();
      },

      exportSettings: () => {
        const state = get();
        const data = {
          general: state.general,
          writer: state.writer,
          translator: state.translator,
          schedule: state.schedule,
          knowledge: state.knowledge,
          email: state.email,
          scheduler: state.scheduler,
          advanced: state.advanced,
          privacy: state.privacy,
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
        };
        return JSON.stringify(data, null, 2);
      },

      importSettings: (json) => {
        const errors: string[] = [];
        try {
          const data = JSON.parse(json);
          if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return { success: false, errors: ['无效的JSON格式：根元素必须为对象'] };
          }

          const sections: CastSettingsSection[] = [
            'general', 'writer', 'translator', 'schedule',
            'knowledge', 'email', 'scheduler', 'advanced', 'privacy',
          ];

          const defaultsMap: Record<string, any> = {
            general: DEFAULT_CAST_SETTINGS.general,
            writer: DEFAULT_CAST_SETTINGS.writer,
            translator: DEFAULT_CAST_SETTINGS.translator,
            schedule: DEFAULT_CAST_SETTINGS.schedule,
            knowledge: DEFAULT_CAST_SETTINGS.knowledge,
            email: DEFAULT_CAST_SETTINGS.email,
            scheduler: DEFAULT_CAST_SETTINGS.scheduler,
            advanced: DEFAULT_CAST_SETTINGS.advanced,
            privacy: DEFAULT_CAST_SETTINGS.privacy,
          };

          const partialUpdate: Record<string, any> = {};
          for (const sec of sections) {
            if (data[sec] && typeof data[sec] === 'object') {
              partialUpdate[sec] = deepMerge(defaultsMap[sec], data[sec]);
            }
          }

          if (Object.keys(partialUpdate).length === 0) {
            return { success: false, errors: ['未找到任何有效的设置数据'] };
          }

          set(partialUpdate as any);
          get().saveToStorage();
          return { success: true, errors };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { success: false, errors: [`JSON解析失败: ${msg}`] };
        }
      },

      loadFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            const sections: CastSettingsSection[] = [
              'general', 'writer', 'translator', 'schedule',
              'knowledge', 'email', 'scheduler', 'advanced', 'privacy',
            ];

            const defaultsMap: Record<string, any> = {
              general: DEFAULT_CAST_SETTINGS.general,
              writer: DEFAULT_CAST_SETTINGS.writer,
              translator: DEFAULT_CAST_SETTINGS.translator,
              schedule: DEFAULT_CAST_SETTINGS.schedule,
              knowledge: DEFAULT_CAST_SETTINGS.knowledge,
              email: DEFAULT_CAST_SETTINGS.email,
              scheduler: DEFAULT_CAST_SETTINGS.scheduler,
              advanced: DEFAULT_CAST_SETTINGS.advanced,
              privacy: DEFAULT_CAST_SETTINGS.privacy,
            };

            const partialUpdate: Record<string, any> = { isInitialized: true };
            for (const sec of sections) {
              if (data[sec] && typeof data[sec] === 'object') {
                partialUpdate[sec] = deepMerge(defaultsMap[sec], data[sec]);
              }
            }
            set(partialUpdate as any);
          } else {
            set({ isInitialized: true });
          }
        } catch (error) {
          console.error('[CastSettingsStore] Load failed:', error);
          set({ isInitialized: true });
        }
      },

      saveToStorage: () => {
        try {
          const state = get();
          const data = {
            general: state.general,
            writer: state.writer,
            translator: state.translator,
            schedule: state.schedule,
            knowledge: state.knowledge,
            email: state.email,
            scheduler: state.scheduler,
            advanced: state.advanced,
            privacy: state.privacy,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
          console.error('[CastSettingsStore] Save failed:', error);
        }
      },

      getDefaultModel: () => get().general.defaultLLMModel,

      isAutoSaveEnabled: () => get().general.autoSaveMemory,

      getStartupTab: () => get().general.startupTab,
    }),
    { name: 'cast-settings-store' }
  )
);
