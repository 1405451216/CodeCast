import { castLearning, suggestActionsBasedOnHistory } from './cast-learning-loop';
import type { OperationLogEntry } from '../../types/cast-learning';

interface ToolExecutionParams {
  toolId: string;
  toolName: string;
  category: string;
  inputParams: Record<string, unknown>;
  outputPreview: string;
  outputLength?: number;
  executionTime: number;
  success: boolean;
  error?: string;
  sourcePanel: string;
  sessionId?: string;
}

export function useOperationLogger() {
  return {
    logToolExecution: (params: ToolExecutionParams): string => {
      return castLearning.logOperation({
        ...params,
        outputLength: params.outputLength ?? params.outputPreview.length
      });
    },

    recordUserFeedback: (logId: string, feedback: 'positive' | 'negative'): void => {
      castLearning.recordFeedback(logId, feedback);
    },

    startSession: (): void => {
      castLearning.startSession();
    },

    endSession: (): OperationLogEntry[] => {
      return castLearning.endSession();
    },

    getCurrentSessionOps: (): OperationLogEntry[] => {
      return castLearning.getCurrentSessionOps();
    }
  };
}

export function useLearningSuggestions() {
  return {
    getSuggestions: () => {
      return suggestActionsBasedOnHistory();
    }
  };
}
