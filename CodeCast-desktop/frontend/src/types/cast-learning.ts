export interface OperationLogEntry {
  id: string;
  timestamp: number;
  toolId: string;
  toolName: string;
  category: string;
  inputParams: Record<string, unknown>;
  outputPreview: string;
  outputLength: number;
  executionTime: number;
  success: boolean;
  error?: string;
  sessionId?: string;
  sourcePanel: string;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  contextTags?: string[];
}

export interface PatternMatch {
  id: string;
  pattern: OperationPattern;
  frequency: number;
  lastSeen: number;
  confidence: number;
  avgExecutionTime: number;
  successRate: number;
  suggestedName: string;
  suggestedDescription: string;
}

export interface OperationPattern {
  steps: Array<{
    toolId: string;
    order: number;
    typicalParams: Record<string, unknown>;
    paramVariability: number;
  }>;
  context: {
    sourcePanels: string[];
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: number;
    sessionType?: 'single_task' | 'batch_process' | 'exploration';
  };
}

export interface CompositeSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  sourcePattern: OperationPattern;
  generatedFrom: 'auto_learned' | 'user_created' | 'template';
  triggerConditions: {
    keywordPatterns: string[];
    toolSequence: string[];
    minFrequency: number;
  };
  executionSteps: Array<{
    toolId: string;
    paramsMapping: Record<string, string>;
    condition?: string;
  }>;
  stats: {
    timesUsed: number;
    avgTimeSaved: number;
    successRate: number;
    lastUsedAt: number;
    createdAt: number;
  };
  enabled: boolean;
  userApproved: boolean;
}

export interface LearningStats {
  totalOperationsLogged: number;
  totalPatternsDetected: number;
  totalSkillsGenerated: number;
  activeSkillsCount: number;
  topPatterns: Array<{ name: string; freq: number }>;
  learningRate: number;
  efficiencyGain: number;
  dataCoverageDays: number;
}
