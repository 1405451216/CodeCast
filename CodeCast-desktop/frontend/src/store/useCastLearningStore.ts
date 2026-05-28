import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  OperationLogEntry,
  PatternMatch,
  CompositeSkill,
  LearningStats
} from '../types/cast-learning';
import {
  castLearning,
  extractKeywords,
  suggestActionsBasedOnHistory
} from '../utils/cast/cast-learning-loop';

interface CastLearningState {
  isLearningEnabled: boolean;
  operationLogs: OperationLogEntry[];
  patterns: PatternMatch[];
  compositeSkills: CompositeSkill[];
  stats: LearningStats;
  selectedSkillId: string | null;
  insights: string[];

  logOperation: (entry: Omit<OperationLogEntry, 'id' | 'timestamp'>) => string;
  recordFeedback: (logId: string, feedback: 'positive' | 'negative') => void;

  runPatternDetection: () => PatternMatch[];
  getPatterns: (limit?: number) => PatternMatch[];

  autoGenerateSkills: () => CompositeSkill[];
  getSkills: () => CompositeSkill[];
  enableSkill: (id: string) => void;
  disableSkill: (id: string) => void;
  approveSkill: (id: string) => void;
  rejectSkill: (id: string) => void;
  deleteSkill: (id: string) => void;
  executeSkill: (id: string, userInput: string) => Promise<unknown>;

  getStats: () => LearningStats;
  getInsights: () => string[];
  refreshStats: () => void;

  selectSkill: (id: string | null) => void;
  toggleLearning: () => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;
  exportData: () => string;
  importData: (json: string) => { logsImported: number; skillsImported: number };
  clearAll: () => void;

  getSuggestions: () => Array<{ action: string; confidence: number; reason: string }>;
}

export const useCastLearningStore = create<CastLearningState>()(
  devtools(
    (set, get) => ({
      isLearningEnabled: true,
      operationLogs: [],
      patterns: [],
      compositeSkills: [],
      stats: {
        totalOperationsLogged: 0,
        totalPatternsDetected: 0,
        totalSkillsGenerated: 0,
        activeSkillsCount: 0,
        topPatterns: [],
        learningRate: 0,
        efficiencyGain: 0,
        dataCoverageDays: 0
      },
      selectedSkillId: null,
      insights: [],

      logOperation: (entry) => {
        const state = get();
        if (!state.isLearningEnabled) return '';

        const logId = castLearning.logOperation(entry);
        get().refreshStats();

        return logId;
      },

      recordFeedback: (logId, feedback) => {
        castLearning.recordFeedback(logId, feedback);
        set((state) => ({
          operationLogs: state.operationLogs.map(log =>
            log.id === logId ? { ...log, userFeedback: feedback } : log
          )
        }));
      },

      runPatternDetection: () => {
        const newPatterns = castLearning.detectPatterns();
        const allPatterns = castLearning.getRecentPatterns(50);

        set({
          patterns: allPatterns
        });

        get().refreshStats();

        return newPatterns;
      },

      getPatterns: (limit = 20) => {
        return castLearning.getRecentPatterns(limit);
      },

      autoGenerateSkills: () => {
        const newSkills = castLearning.autoGenerateSkills();
        const allSkills = castLearning.getAllSkills();

        set({
          compositeSkills: allSkills
        });

        get().refreshStats();

        return newSkills;
      },

      getSkills: () => {
        return castLearning.getAllSkills();
      },

      enableSkill: (id) => {
        castLearning.enableSkill(id);
        set((state) => ({
          compositeSkills: state.compositeSkills.map(skill =>
            skill.id === id ? { ...skill, enabled: true } : skill
          )
        }));
        get().refreshStats();
      },

      disableSkill: (id) => {
        castLearning.disableSkill(id);
        set((state) => ({
          compositeSkills: state.compositeSkills.map(skill =>
            skill.id === id ? { ...skill, enabled: false } : skill
          )
        }));
        get().refreshStats();
      },

      approveSkill: (id) => {
        castLearning.approveSkill(id);
        set((state) => ({
          compositeSkills: state.compositeSkills.map(skill =>
            skill.id === id ? { ...skill, enabled: true, userApproved: true } : skill
          )
        }));
        get().refreshStats();
      },

      rejectSkill: (id) => {
        castLearning.rejectSkill(id);
        set((state) => ({
          compositeSkills: state.compositeSkills.map(skill =>
            skill.id === id ? { ...skill, enabled: false, userApproved: false } : skill
          )
        }));
        get().refreshStats();
      },

      deleteSkill: (id) => {
        castLearning.deleteSkill(id);
        set((state) => ({
          compositeSkills: state.compositeSkills.filter(skill => skill.id !== id),
          selectedSkillId: state.selectedSkillId === id ? null : state.selectedSkillId
        }));
        get().refreshStats();
      },

      executeSkill: async (id, userInput) => {
        try {
          const result = await castLearning.executeSkill(id, userInput);

          const updatedSkill = castLearning.getSkill(id);
          if (updatedSkill) {
            set((state) => ({
              compositeSkills: state.compositeSkills.map(skill =>
                skill.id === id ? updatedSkill : skill
              )
            }));
          }

          get().refreshStats();

          return result;
        } catch (error: any) {
          console.error('[CastLearningStore] Skill execution failed:', error.message);
          throw error;
        }
      },

      getStats: () => {
        return castLearning.getStats();
      },

      getInsights: () => {
        const insights = castLearning.getLearningInsights();
        set({ insights });
        return insights;
      },

      refreshStats: () => {
        const stats = castLearning.getStats();
        const insights = castLearning.getLearningInsights();
        set({ stats, insights });
      },

      selectSkill: (id) => {
        set({ selectedSkillId: id });
      },

      toggleLearning: () => {
        set((state) => ({
          isLearningEnabled: !state.isLearningEnabled
        }));
      },

      loadFromStorage: () => {
        castLearning.loadFromStorage();
        const stats = castLearning.getStats();
        const patterns = castLearning.getRecentPatterns(50);
        const skills = castLearning.getAllSkills();
        const insights = castLearning.getLearningInsights();

        set({
          patterns,
          compositeSkills: skills,
          stats,
          insights
        });
      },

      saveToStorage: () => {
        castLearning.saveToStorage();
      },

      exportData: () => {
        return castLearning.exportData();
      },

      importData: (json) => {
        const result = castLearning.importData(json);
        get().loadFromStorage();
        return result;
      },

      clearAll: () => {
        castLearning.clearAll();
        set({
          operationLogs: [],
          patterns: [],
          compositeSkills: [],
          stats: {
            totalOperationsLogged: 0,
            totalPatternsDetected: 0,
            totalSkillsGenerated: 0,
            activeSkillsCount: 0,
            topPatterns: [],
            learningRate: 0,
            efficiencyGain: 0,
            dataCoverageDays: 0
          },
          selectedSkillId: null,
          insights: []
        });
      },

      getSuggestions: () => {
        return suggestActionsBasedOnHistory();
      }
    }),
    { name: 'cast-learning-store' }
  )
);

export { extractKeywords, suggestActionsBasedOnHistory };
