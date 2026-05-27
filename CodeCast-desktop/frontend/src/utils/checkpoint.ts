export enum CheckpointStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  TIMEOUT = 'timeout',
  SKIPPED = 'skipped'
}

export enum CheckpointRiskLevel {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum CheckpointOperationType {
  FILE_WRITE = 'file_write',
  FILE_DELETE = 'file_delete',
  FILE_MODIFY = 'file_modify',
  COMMAND_EXECUTE = 'command_execute',
  GIT_OPERATION = 'git_operation',
  NETWORK_REQUEST = 'network_request',
  ENVIRONMENT_CHANGE = 'environment_change',
  CUSTOM = 'custom'
}

export interface CheckpointDiff {
  filePath: string;
  oldContent?: string;
  newContent?: string;
  unifiedDiff?: string;
  changeType: 'create' | 'modify' | 'delete' | 'move';
  addedLines?: number;
  removedLines?: number;
}

export interface Checkpoint {
  id: string;
  operationType: CheckpointOperationType;
  toolName: string;
  targetPath: string;
  description: string;
  riskLevel: CheckpointRiskLevel;
  status: CheckpointStatus;
  diff?: CheckpointDiff;
  params: Record<string, unknown>;
  createdAt: number;
  resolvedAt?: number;
  timeoutMs: number;
  requiresApproval: boolean;
  metadata?: Record<string, unknown>;
}

export interface CheckpointStatistics {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  timedOut: number;
}

export interface CheckpointManagerConfig {
  defaultTimeoutMs: number;
  maxPendingCheckpoints: number;
  autoApproveLowRisk: boolean;
  autoRejectOnTimeout: boolean;
  enableBatchMode: boolean;
  highRiskTools: Set<string>;
}

export type CheckpointEventListener = (checkpoint: Checkpoint) => void;

const DEFAULT_CONFIG: CheckpointManagerConfig = {
  defaultTimeoutMs: 5 * 60 * 1000,
  maxPendingCheckpoints: 50,
  autoApproveLowRisk: false,
  autoRejectOnTimeout: true,
  enableBatchMode: true,
  highRiskTools: new Set([
    'write_file',
    'delete_file',
    'execute_command',
    'git_push',
    'git_reset',
    'git_clean',
    'env_set',
    'npm_install',
    'pip_install'
  ])
};

class CheckPointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private pendingResolvers: Map<string, (approved: boolean) => void> = new Map();
  private config: CheckpointManagerConfig;
  private listeners: Set<CheckpointEventListener> = new Set();
  private timeoutTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _isPaused: boolean = false;
  private _batchMode: boolean = false;
  private batchQueue: Checkpoint[] = [];

  constructor(config?: Partial<CheckpointManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get batchMode(): boolean {
    return this._batchMode;
  }

  set batchMode(value: boolean) {
    this._batchMode = value;
  }

  createCheckpoint(
    toolName: string,
    params: Record<string, unknown>,
    options?: Partial<Omit<Checkpoint, 'id' | 'status' | 'createdAt' | 'params' | 'toolName' | 'timeoutMs'>>
  ): Checkpoint {
    const id = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const targetPath = String(params.path || params.filepath || params.filePath || params.directory || '');
    const operationType = this.inferOperationType(toolName, params);
    const riskLevel = options?.riskLevel ?? this.assessRiskLevel(toolName, params);
    const requiresApproval = options?.requiresApproval ?? this.shouldRequireApproval(toolName, riskLevel);

    const checkpoint: Checkpoint = {
      id,
      operationType,
      toolName,
      targetPath,
      description: options?.description || this.generateDescription(toolName, params),
      riskLevel,
      status: CheckpointStatus.PENDING,
      diff: options?.diff,
      params,
      createdAt: Date.now(),
      timeoutMs: this.config.defaultTimeoutMs,
      requiresApproval,
      metadata: options?.metadata
    };

    if (this.checkpoints.size >= this.config.maxPendingCheckpoints) {
      const oldestPending = Array.from(this.checkpoints.values())
        .filter(c => c.status === CheckpointStatus.PENDING)
        .sort((a, b) => a.createdAt - b.createdAt)[0];

      if (oldestPending) {
        this.reject(oldestPending.id);
      }
    }

    this.checkpoints.set(id, checkpoint);

    if (this.config.autoApproveLowRisk && riskLevel === CheckpointRiskLevel.LOW) {
      this.approve(id);
    } else if (this._batchMode && this.config.enableBatchMode) {
      this.batchQueue.push(checkpoint);
    } else {
      this.setupTimeout(checkpoint);
    }

    this.notifyListeners(checkpoint);

    return checkpoint;
  }

  waitForApproval(checkpointId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const checkpoint = this.checkpoints.get(checkpointId);

      if (!checkpoint) {
        resolve(false);
        return;
      }

      if (checkpoint.status === CheckpointStatus.APPROVED) {
        resolve(true);
        return;
      }

      if (checkpoint.status === CheckpointStatus.REJECTED || checkpoint.status === CheckpointStatus.TIMEOUT) {
        resolve(false);
        return;
      }

      if (!checkpoint.requiresApproval) {
        this.approve(checkpointId);
        resolve(true);
        return;
      }

      this.pendingResolvers.set(checkpointId, resolve);
    });
  }

  approve(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint || checkpoint.status !== CheckpointStatus.PENDING) {
      return false;
    }

    checkpoint.status = CheckpointStatus.APPROVED;
    checkpoint.resolvedAt = Date.now();

    this.clearTimeout(checkpointId);

    const resolver = this.pendingResolvers.get(checkpointId);
    if (resolver) {
      this.pendingResolvers.delete(checkpointId);
      resolver(true);
    }

    this.notifyListeners(checkpoint);

    return true;
  }

  reject(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint || checkpoint.status !== CheckpointStatus.PENDING) {
      return false;
    }

    checkpoint.status = CheckpointStatus.REJECTED;
    checkpoint.resolvedAt = Date.now();

    this.clearTimeout(checkpointId);

    const resolver = this.pendingResolvers.get(checkpointId);
    if (resolver) {
      this.pendingResolvers.delete(checkpointId);
      resolver(false);
    }

    this.notifyListeners(checkpoint);

    return true;
  }

  batchApprove(): number {
    let approvedCount = 0;

    for (const checkpoint of this.batchQueue) {
      if (checkpoint.status === CheckpointStatus.PENDING) {
        if (this.approve(checkpoint.id)) {
          approvedCount++;
        }
      }
    }

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.status === CheckpointStatus.PENDING && !this.batchQueue.find(c => c.id === id)) {
        if (this.approve(id)) {
          approvedCount++;
        }
      }
    }

    this.batchQueue = [];
    return approvedCount;
  }

  skipRemaining(): number {
    let skippedCount = 0;

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.status === CheckpointStatus.PENDING) {
        checkpoint.status = CheckpointStatus.SKIPPED;
        checkpoint.resolvedAt = Date.now();

        this.clearTimeout(id);

        const resolver = this.pendingResolvers.get(id);
        if (resolver) {
          this.pendingResolvers.delete(id);
          resolver(false);
        }

        skippedCount++;
        this.notifyListeners(checkpoint);
      }
    }

    this.batchQueue = [];
    return skippedCount;
  }

  pause(): void {
    this._isPaused = true;

    for (const [id] of this.timeoutTimers) {
      this.clearTimeout(id);
    }
  }

  resume(): void {
    this._isPaused = false;

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.status === CheckpointStatus.PENDING && !this.timeoutTimers.has(id)) {
        this.setupTimeout(checkpoint);
      }
    }
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  getPendingCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(c => c.status === CheckpointStatus.PENDING)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getStatistics(): CheckpointStatistics {
    const all = Array.from(this.checkpoints.values());

    return {
      total: all.length,
      approved: all.filter(c => c.status === CheckpointStatus.APPROVED).length,
      rejected: all.filter(c => c.status === CheckpointStatus.REJECTED).length,
      pending: all.filter(c => c.status === CheckpointStatus.PENDING).length,
      skipped: all.filter(c => c.status === CheckpointStatus.SKIPPED).length,
      timedOut: all.filter(c => c.status === CheckpointStatus.TIMEOUT).length
    };
  }

  clearCompleted(): void {
    for (const [id, checkpoint] of this.checkpoints) {
      if (
        checkpoint.status === CheckpointStatus.APPROVED ||
        checkpoint.status === CheckpointStatus.REJECTED ||
        checkpoint.status === CheckpointStatus.TIMEOUT ||
        checkpoint.status === CheckpointStatus.SKIPPED
      ) {
        this.checkpoints.delete(id);
        this.clearTimeout(id);
      }
    }
  }

  clearAll(): void {
    for (const [id] of this.checkpoints) {
      this.clearTimeout(id);
    }

    for (const [, resolver] of this.pendingResolvers) {
      resolver(false);
    }

    this.checkpoints.clear();
    this.pendingResolvers.clear();
    this.batchQueue = [];
  }

  addListener(listener: CheckpointEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  updateConfig(partial: Partial<CheckpointManagerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  shouldRequireApproval(toolName: string, riskLevel: CheckpointRiskLevel): boolean {
    if (this.config.highRiskTools.has(toolName)) {
      return true;
    }

    return riskLevel === CheckpointRiskLevel.HIGH || riskLevel === CheckpointRiskLevel.CRITICAL;
  }

  private inferOperationType(
    toolName: string,
    params: Record<string, unknown>
  ): CheckpointOperationType {
    const nameLower = toolName.toLowerCase();

    if (nameLower.includes('write') || nameLower.includes('create')) {
      return CheckpointOperationType.FILE_WRITE;
    }

    if (nameLower.includes('delete') || nameLower.includes('remove')) {
      return CheckpointOperationType.FILE_DELETE;
    }

    if (nameLower.includes('read') || nameLower.includes('list') || nameLower.includes('get')) {
      return CheckpointOperationType.FILE_MODIFY;
    }

    if (nameLower.includes('exec') || nameLower.includes('command') || nameLower.includes('terminal') || nameLower.includes('shell')) {
      return CheckpointOperationType.COMMAND_EXECUTE;
    }

    if (nameLower.includes('git')) {
      return CheckpointOperationType.GIT_OPERATION;
    }

    if (nameLower.includes('fetch') || nameLower.includes('http') || nameLower.includes('request') || nameLower.includes('api')) {
      return CheckpointOperationType.NETWORK_REQUEST;
    }

    if (nameLower.includes('env')) {
      return CheckpointOperationType.ENVIRONMENT_CHANGE;
    }

    return CheckpointOperationType.CUSTOM;
  }

  private assessRiskLevel(
    toolName: string,
    params: Record<string, unknown>
  ): CheckpointRiskLevel {
    const nameLower = toolName.toLowerCase();

    if (this.config.highRiskTools.has(nameLower)) {
      const dangerousPatterns = [
        'rm -rf',
        'git reset --hard',
        'git clean',
        'DROP ',
        'DELETE FROM',
        'format',
        'mkfs',
        'dd if=',
        '> /dev/',
        'chmod 777',
        'curl | sh',
        'wget | bash'
      ];

      const paramStr = JSON.stringify(params).toLowerCase();

      for (const pattern of dangerousPatterns) {
        if (paramStr.includes(pattern.toLowerCase())) {
          return CheckpointRiskLevel.CRITICAL;
        }
      }

      if (nameLower.includes('delete') || nameLower.includes('remove')) {
        return CheckpointRiskLevel.HIGH;
      }

      return CheckpointRiskLevel.MEDIUM;
    }

    if (nameLower.includes('write') || nameLower.includes('modify')) {
      return CheckpointRiskLevel.MEDIUM;
    }

    if (nameLower.includes('exec') || nameLower.includes('command')) {
      const cmd = String(params.command || '');

      if (cmd.includes('rm ') || cmd.includes('del ') || cmd.includes('sudo')) {
        return CheckpointRiskLevel.HIGH;
      }

      return CheckpointRiskLevel.MEDIUM;
    }

    return CheckpointRiskLevel.LOW;
  }

  private generateDescription(toolName: string, params: Record<string, unknown>): string {
    const path = params.path || params.filepath || params.filePath || '';

    switch (toolName.toLowerCase()) {
      case 'writefile':
      case 'write_file':
        return `写入文件: ${path}`;
      case 'readfile':
      case 'read_file':
        return `读取文件: ${path}`;
      case 'deletefile':
      case 'delete_file':
        return `删除文件: ${path}`;
      case 'executecommand':
      case 'execute_command':
        return `执行命令: ${(params.command as string || '').substring(0, 80)}`;
      case 'listfiles':
      case 'list_files':
        return `列出目录: ${path || '.'}`;
      default:
        return `${toolName}: ${JSON.stringify(params).substring(0, 60)}`;
    }
  }

  private setupTimeout(checkpoint: Checkpoint): void {
    if (this._isPaused) return;

    const timer = setTimeout(() => {
      if (checkpoint.status === CheckpointStatus.PENDING) {
        checkpoint.status = this.config.autoRejectOnTimeout
          ? CheckpointStatus.TIMEOUT
          : CheckpointStatus.TIMEOUT;
        checkpoint.resolvedAt = Date.now();

        const resolver = this.pendingResolvers.get(checkpoint.id);
        if (resolver) {
          this.pendingResolvers.delete(checkpoint.id);
          resolver(false);
        }

        this.timeoutTimers.delete(checkpoint.id);
        this.notifyListeners(checkpoint);
      }
    }, checkpoint.timeoutMs);

    this.timeoutTimers.set(checkpoint.id, timer);
  }

  private clearTimeout(checkpointId: string): void {
    const timer = this.timeoutTimers.get(checkpointId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(checkpointId);
    }
  }

  private notifyListeners(checkpoint: Checkpoint): void {
    for (const listener of this.listeners) {
      try {
        listener(checkpoint);
      } catch (e) {
        console.error('[CheckpointManager] Listener error:', e);
      }
    }
  }
}

let globalInstance: CheckPointManager | null = null;

export function getCheckpointManager(config?: Partial<CheckpointManagerConfig>): CheckPointManager {
  if (!globalInstance) {
    globalInstance = new CheckPointManager(config);
  } else if (config) {
    globalInstance.updateConfig(config);
  }

  return globalInstance;
}

export function resetCheckpointManager(): void {
  if (globalInstance) {
    globalInstance.clearAll();
  }
  globalInstance = null;
}

export { CheckPointManager };
export default getCheckpointManager;
