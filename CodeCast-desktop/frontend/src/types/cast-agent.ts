import type { TaskStatus } from './agent';

export { TaskStatus };

export type CastAgentStepStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped';

export interface CastAgentStep {
  id: string;
  order: number;
  title: string;
  description: string;
  status: CastAgentStepStatus;
  toolId: string;
  toolParams: Record<string, unknown>;
  inputPreview: string;
  outputResult?: string;
  error?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  requiresApproval: boolean;
  approvedByUser?: boolean;
}

export interface CastAgentTask {
  id: string;
  userGoal: string;
  parsedGoal: {
    intent: string;
    entities: Record<string, string>;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  steps: CastAgentStep[];
  status: TaskStatus;
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;

  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;

  finalSummary?: string;

  metadata: {
    sessionId?: string;
    modelUsed?: string;
    planningTime?: number;
    tokensEstimated?: number;
  };
}

export type CastAgentTemplateKey =
  | 'write_and_translate'
  | 'meeting_to_knowledge'
  | 'analyze_and_report'
  | 'schedule_and_remind'
  | 'email_polish_send'
  | 'research_summarize'
  | 'translate_polish_email'
  | 'custom';

export interface CastAgentTemplate {
  key: CastAgentTemplateKey;
  name: string;
  description: string;
  icon: string;
  exampleInput: string;
  expectedSteps: Array<{ toolId: string; description: string }>;
}

export interface CastAgentExecutionEvent {
  type: 'task_created' | 'planning_start' | 'planning_complete' | 'step_start' | 'step_complete' | 'step_fail' | 'step_waiting_approval' | 'step_approved' | 'task_complete' | 'task_fail' | 'task_cancelled' | 'progress';
  taskId: string;
  stepId?: string;
  data?: unknown;
  timestamp: number;
}

export interface CastAgentState {
  currentTask: CastAgentTask | null;
  taskHistory: CastAgentTask[];
  isPlanning: boolean;
  isExecuting: boolean;
  isPaused: boolean;
  events: CastAgentExecutionEvent[];

  submitGoal: (goal: string, templateKey?: CastAgentTemplateKey) => Promise<string>;
  approveStep: (stepId: string) => Promise<void>;
  rejectStep: (stepId: string, reason?: string) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelTask: () => void;
  retryStep: (stepId: string) => Promise<void>;

  getTaskHistory: (limit?: number) => CastAgentTask[];
  getEvents: (taskId?: string) => CastAgentExecutionEvent[];

  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearHistory: () => void;
}
