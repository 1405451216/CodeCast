// AP-compatible agent types for CodeCast
// These align with AP framework status constants and event types

export enum TaskStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  WAITING_FOR_INPUT = 'waiting_for_input',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PLANNING = 'planning',
  SKIPPED = 'skipped',
  RETRYING = 'retrying'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SubTask {
  id: string;
  taskId: string;
  order: number;
  title: string;
  description: string;
  status: TaskStatus;
  riskLevel: RiskLevel;
  estimatedTurns: number;
  actualTurns: number;
  dependencies: string[];
  toolCalls: ToolCallPlan[];
  inputContext?: string;
  outputResult?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  logs: SubTaskLog[];
}

export interface SubTaskLog {
  timestamp: number;
  type: 'info' | 'input' | 'output' | 'error' | 'warning' | 'success';
  content: string;
}

export interface ToolCallPlan {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  expectedOutput?: string;
  riskLevel: RiskLevel;
}

export interface AgentTask {
  id: string;
  sessionId: string;
  description: string;
  originalInput: string;
  status: TaskStatus;
  subTasks: SubTask[];
  currentSubTaskId?: string;
  totalEstimatedTurns: number;
  completedTurns: number;
  overallRiskLevel: RiskLevel;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  planVersion: number;
  metadata: TaskMetadata;
}

export interface TaskMetadata {
  modelUsed: string;
  planningDuration: number;
  tokensUsed?: number;
  contextFiles: string[];
  tags: string[];
}

export interface TaskPlan {
  version: '2.0';
  taskId: string;
  taskDescription: string;
  analysis: TaskAnalysis;
  subTasks: Omit<SubTask, 'id' | 'taskId' | 'status' | 'actualTurns' | 'logs' | 'startTime' | 'endTime' | 'duration'>[];
  executionStrategy: ExecutionStrategy;
  rollbackPlan: RollbackStep[];
  estimatedTotalTurns: number;
  confidence: number;
}

export interface TaskAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  requiresFileSystem: boolean;
  requiresTerminal: boolean;
  requiresCodeGeneration: boolean;
  requiresTesting: boolean;
  potentialRisks: RiskAssessment[];
  suggestedTools: string[];
  dependencies: string[];
}

export interface RiskAssessment {
  area: string;
  level: RiskLevel;
  reason: string;
  mitigation: string;
}

export interface ExecutionStrategy {
  mode: 'sequential' | 'parallel' | 'dependency_graph';
  maxConcurrentTasks: number;
  failFast: boolean;
  autoRetry: boolean;
  maxRetriesPerTask: number;
  verificationPoints: VerificationPoint[];
}

export interface VerificationPoint {
  afterStep: number;
  checks: ('syntax_check' | 'type_check' | 'lint' | 'test' | 'build' | 'manual')[];
  required: boolean;
}

export interface RollbackStep {
  step: number;
  action: string;
  command?: string;
  reversible: boolean;
}

export interface ToolContext {
  sessionId: string;
  task: AgentTask;
  currentSubTask: SubTask;
  abortSignal: AbortSignal;
  terminalRef?: React.RefObject<TerminalHandle>;
  onLog: (message: string, type: SubTaskLog['type']) => void;
  onProgress: (progress: number) => void;
}

export interface TerminalHandle {
  executeCommand: (command: string) => void;
  getSessionInfo: () => { running: boolean; history: Array<{ type: string; content: string }> } | null;
}

export interface PlanningProgress {
  phase: 'analyzing' | 'decomposing' | 'assessing_risks' | 'building_plan' | 'optimizing' | 'complete';
  progress: number;
  message: string;
  partialPlan?: Partial<TaskPlan>;
}

// AP EventBus event types (from event_bridge.go)
export interface TaskExecutionEvent {
  type: 'subtask_start' | 'subtask_complete' | 'subtask_fail' | 'subtask_retry' | 'progress' | 'log' | 'pause' | 'resume' | 'complete' | 'fail' | 'cancel';
  taskId: string;
  subTaskId?: string;
  data?: unknown;
  timestamp: number;
}

// AP-compatible checkpoint event payload (from checkpoint_hook.go)
export interface CheckpointEvent {
  checkpoint_id: string;
  tool_name: string;
  tool_args: string;
  risk_level: 'low' | 'medium' | 'high';
  agent_id: string;
  session_id: string;
}

export interface AgentLoopConfigV2 {
  maxTurns: number;
  maxRetries: number;
  autoFixErrors: boolean;
  runTests: boolean;
  runLint: boolean;
  runBuild: boolean;
  stopOnFirstError: boolean;
  enablePlanning: boolean;
  streamPlanningProgress: boolean;
  pauseOnError: boolean;
  verificationSteps: ('run_tests' | 'check_lint' | 'build' | 'syntax_check' | 'type_check')[];
}

export const DEFAULT_AGENT_CONFIG_V2: AgentLoopConfigV2 = {
  maxTurns: 20,
  maxRetries: 3,
  autoFixErrors: true,
  runTests: true,
  runLint: true,
  runBuild: false,
  stopOnFirstError: false,
  enablePlanning: true,
  streamPlanningProgress: true,
  pauseOnError: false,
  verificationSteps: ['check_lint', 'run_tests']
};
