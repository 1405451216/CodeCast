import { create } from 'zustand';
import type {
  OutboundAuditLog,
  OutboundCategory,
  OutboundDecision,
  PrivacyPolicyConfig,
  PrivacyPolicyMode,
  PrivacyReport,
  PrivacyRule
} from '../types/cast-privacy';
import { DEFAULT_PRIVACY_CONFIG, PRIVACY_LEVEL_LABELS, OUTBOUND_CATEGORY_LABELS } from '../types/cast-privacy';
import { castPrivacyManager } from '../utils/cast/cast-privacy-manager';

interface CastPrivacyState {
  logs: OutboundAuditLog[];
  config: PrivacyPolicyConfig;
  report: PrivacyReport | null;
  isInitialized: boolean;

  init: () => void;
  refreshLogs: () => void;
  refreshReport: () => void;

  addLog: (log: OutboundAuditLog) => void;
  clearLogs: () => void;
  deleteLog: (id: string) => void;
  getFilteredLogs: (filter?: {
    category?: OutboundCategory;
    decision?: OutboundDecision;
    search?: string;
    limit?: number
  }) => OutboundAuditLog[];

  updateMode: (mode: PrivacyPolicyMode) => void;
  toggleAutoMask: () => void;
  toggleLlmMinimization: () => void;
  toggleShowConfirmation: () => void;
  setRetentionDays: (days: number) => void;

  addRule: (rule: Omit<PrivacyRule, 'id' | 'createdAt'>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  addExemptDomain: (domain: string) => void;
  removeExemptDomain: (domain: string) => void;

  forgetDomainMemory: () => void;
  exportData: () => string;
  importData: (json: string) => { success: boolean; errors: string[] };
  resetAll: () => void;
  persistLogs: () => void;
}

const STORAGE_KEY_CONFIG = 'codecast_cast_privacy_store_config';
const STORAGE_KEY_LOGS = 'codecast_cast_privacy_store_logs';

export const useCastPrivacyStore = create<CastPrivacyState>((set, get) => ({
  logs: [],
  config: { ...DEFAULT_PRIVACY_CONFIG },
  report: null,
  isInitialized: false,

  init: () => {
    if (get().isInitialized) return;

    castPrivacyManager.loadLogs();

    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ config: { ...DEFAULT_PRIVACY_CONFIG, ...parsed } });
        castPrivacyManager.updateConfig(parsed);
      }
    } catch {}

    try {
      const rawLogs = localStorage.getItem(STORAGE_KEY_LOGS);
      if (rawLogs) {
        const parsed = JSON.parse(rawLogs);
        if (Array.isArray(parsed)) set({ logs: parsed });
      }
    } catch {}

    castPrivacyManager.onAuditLog((log: OutboundAuditLog) => {
      set(state => ({
        logs: [log, ...state.logs].slice(0, state.config.maxAuditLogs)
      }));
      get().persistLogs();
    });

    set({ isInitialized: true });
    get().refreshReport();
  },

  refreshLogs: () => {
    const logs = castPrivacyManager.getAuditLogs({ limit: get().config.maxAuditLogs });
    set({ logs });
  },

  refreshReport: () => {
    const report = castPrivacyManager.getPrivacyReport();
    set({ report });
  },

  addLog: (log) => {
    set(state => ({ logs: [log, ...state.logs].slice(0, state.config.maxAuditLogs) }));
    get().persistLogs();
    get().refreshReport();
  },

  clearLogs: () => {
    castPrivacyManager.clearAuditLogs();
    set({ logs: [] });
    get().persistLogs();
    get().refreshReport();
  },

  deleteLog: (id) => {
    set(state => ({ logs: state.logs.filter(l => l.id !== id) }));
    get().persistLogs();
  },

  getFilteredLogs: (filter) => {
    let result = [...get().logs].sort((a, b) => b.timestamp - a.timestamp);

    if (filter?.category) result = result.filter(l => l.category === filter.category);
    if (filter?.decision) result = result.filter(l => l.decision === filter.decision);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(l =>
        l.url.toLowerCase().includes(q) ||
        l.domain.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
      );
    }
    if (filter?.limit) result = result.slice(0, filter.limit);

    return result;
  },

  updateMode: (mode) => {
    set(state => {
      const config = { ...state.config, mode };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
    get().refreshReport();
  },

  toggleAutoMask: () => {
    set(state => {
      const config = { ...state.config, autoMaskSensitiveData: !state.config.autoMaskSensitiveData };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  toggleLlmMinimization: () => {
    set(state => {
      const config = { ...state.config, llmDataMinimization: !state.config.llmDataMinimization };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  toggleShowConfirmation: () => {
    set(state => {
      const config = { ...state.config, showOutboundConfirmation: !state.config.showOutboundConfirmation };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  setRetentionDays: (days) => {
    set(state => {
      const config = { ...state.config, auditLogRetentionDays: days };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  addRule: (ruleInput) => {
    const rule: PrivacyRule = {
      ...ruleInput,
      id: `rule-${Date.now()}`,
      createdAt: Date.now()
    };
    set(state => {
      const config = { ...state.config, rules: [...state.config.rules, rule] };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
    get().refreshReport();
  },

  removeRule: (id) => {
    set(state => {
      const config = { ...state.config, rules: state.config.rules.filter((r: PrivacyRule) => r.id !== id) };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  toggleRule: (id) => {
    set(state => {
      const config = {
        ...state.config,
        rules: state.config.rules.map((r: PrivacyRule) => r.id === id ? { ...r, enabled: !r.enabled } : r)
      };
      castPrivacyManager.updateConfig(config);
      persistConfig(config);
      return { config };
    });
  },

  addExemptDomain: (domain) => {
    castPrivacyManager.addExemptDomain(domain);
    set(state => {
      const config = { ...state.config, exemptDomains: [...state.config.exemptDomains, domain] };
      persistConfig(config);
      return { config };
    });
  },

  removeExemptDomain: (domain) => {
    castPrivacyManager.removeExemptDomain(domain);
    set(state => {
      const config = { ...state.config, exemptDomains: state.config.exemptDomains.filter((d: string) => d !== domain) };
      persistConfig(config);
      return { config };
    });
  },

  forgetDomainMemory: () => {
    castPrivacyManager.forgetDomainMemory();
  },

  exportData: () => {
    return castPrivacyManager.exportAuditLogs();
  },

  importData: (json) => {
    const errors: string[] = [];
    try {
      const data = JSON.parse(json);
      if (data.logs && Array.isArray(data.logs)) {
        set({ logs: data.logs });
        get().persistLogs();
      }
      if (data.config && typeof data.config === 'object') {
        set(state => {
          const config = { ...DEFAULT_PRIVACY_CONFIG, ...data.config };
          castPrivacyManager.updateConfig(config);
          persistConfig(config);
          return { config };
        });
      }
    } catch (e: any) {
      errors.push(e.message);
    }
    get().refreshReport();
    return { success: errors.length === 0, errors };
  },

  resetAll: () => {
    castPrivacyManager.resetConfig();
    castPrivacyManager.clearAuditLogs();
    castPrivacyManager.forgetDomainMemory();
    set({
      config: { ...DEFAULT_PRIVACY_CONFIG },
      logs: [],
      report: null
    });
    try {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch {}
    get().refreshReport();
  },

  persistLogs: () => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(get().logs));
    } catch {}
  }
}));

function persistConfig(config: PrivacyPolicyConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {}
}
