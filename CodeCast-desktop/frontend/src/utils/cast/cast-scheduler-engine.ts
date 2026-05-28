export type ScheduledTaskType = 'ai_generate' | 'notification' | 'data_sync' | 'memory_cleanup' | 'reminder' | 'custom';
export type TaskStatus = 'idle' | 'running' | 'success' | 'failed' | 'disabled' | 'paused';
export type ScheduleFrequency = 'once' | 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  type: ScheduledTaskType;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  intervalMs?: number;
  enabled: boolean;
  status: TaskStatus;
  config: Record<string, unknown>;
  lastRunAt?: number;
  nextRunAt?: number;
  runCount: number;
  failCount: number;
  lastResult?: string;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SchedulerStats {
  totalTasks: number;
  activeTasks: number;
  todayRuns: number;
  successRate: number;
  nextRunTime: number | null;
  uptimeSeconds: number;
}

export interface SchedulerCallbacks {
  onTaskStart?: (task: ScheduledTask) => void;
  onTaskComplete?: (task: ScheduledTask, result: string) => void;
  onTaskError?: (task: ScheduledTask, error: string) => void;
  onTick?: (activeTasks: ScheduledTask[]) => void;
}

const TASK_TYPE_LABELS: Record<ScheduledTaskType, string> = {
  ai_generate: 'AI生成',
  notification: '通知',
  data_sync: '数据同步',
  memory_cleanup: '记忆清理',
  reminder: '提醒',
  custom: '自定义'
};

const TASK_TYPE_ICONS: Record<ScheduledTaskType, string> = {
  ai_generate: '🤖',
  notification: '🔔',
  data_sync: '🔄',
  memory_cleanup: '🧹',
  reminder: '⏰',
  custom: '⚙️'
};

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  once: '一次',
  minute: '每分钟',
  hourly: '每小时',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  cron: 'Cron'
};

function generateTaskId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function parseCronExpression(expr: string, baseDate: Date): Date | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteStr, hourStr, dayStr, monthStr, dowStr] = parts;

  const parseField = (field: string, min: number, max: number): number[] => {
    const values: Set<number> = new Set();
    const segments = field.split(',');

    for (const seg of segments) {
      if (seg === '*') {
        for (let i = min; i <= max; i++) values.add(i);
        continue;
      }

      const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        for (let i = Math.max(start, min); i <= Math.min(end, max); i++) values.add(i);
        continue;
      }

      const stepMatch = seg.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
      if (stepMatch) {
        let stepMin = min;
        let stepMax = max;
        if (stepMatch[2] && stepMatch[3]) {
          stepMin = parseInt(stepMatch[2], 10);
          stepMax = parseInt(stepMatch[3], 10);
        }
        const step = parseInt(stepMatch[4], 10);
        for (let i = stepMin; i <= stepMax; i += step) values.add(i);
        continue;
      }

      const num = parseInt(seg, 10);
      if (!isNaN(num) && num >= min && num <= max) values.add(num);
    }

    return Array.from(values).sort((a, b) => a - b);
  };

  const minutes = parseField(minuteStr, 0, 59);
  const hours = parseField(hourStr, 0, 23);
  const days = parseField(dayStr, 1, 31);
  const months = parseField(monthStr, 1, 12);
  const dows = parseField(dowStr, 0, 6);

  if (minutes.length === 0 || hours.length === 0 || days.length === 0 || months.length === 0 || dows.length === 0) {
    return null;
  }

  const candidate = new Date(baseDate);
  candidate.setSeconds(0, 0);

  const maxIterations = 366 * 24 * 60;

  for (let i = 0; i < maxIterations; i++) {
    candidate.setTime(candidate.getTime() + 60000);

    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const d = candidate.getDate();
    const mo = candidate.getMonth() + 1;
    const dw = candidate.getDay();

    if (minutes.includes(m) && hours.includes(h) && days.includes(d) && months.includes(mo) && dows.includes(dw)) {
      return new Date(candidate);
    }
  }

  return null;
}

export function formatNextRunTime(timestamp: number): string {
  if (!timestamp) return '未计划';

  const now = Date.now();
  const diff = timestamp - now;

  if (diff <= 0) return '即将执行';

  const date = new Date(timestamp);

  if (diff < 60000) return `${Math.ceil(diff / 1000)}秒后`;
  if (diff < 3600000) return `${Math.ceil(diff / 60000)}分钟后`;
  if (diff < 86400000) return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (timestamp < tomorrow.getTime() + 86400000) {
    return `明天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export const BUILTIN_TASK_TEMPLATES: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'failCount' | 'status'>[] = [
  {
    name: '每日摘要',
    description: '生成当日活动摘要，汇总待办完成情况、日程安排等',
    type: 'ai_generate',
    frequency: 'daily',
    cronExpression: '0 21 * * *',
    enabled: true,
    config: { promptTemplate: '请根据以下信息生成今日活动摘要：{today_todos}, {today_events}', outputFormat: 'markdown' }
  },
  {
    name: '待办提醒',
    description: '提醒今日待办事项，帮助规划一天的工作',
    type: 'reminder',
    frequency: 'daily',
    cronExpression: '0 9 * * *',
    enabled: true,
    config: { remindTime: '09:00', includeOverdue: true, soundEnabled: false }
  },
  {
    name: '每周回顾',
    description: '生成本周工作总结和下周计划建议',
    type: 'ai_generate',
    frequency: 'weekly',
    cronExpression: '0 20 * * 0',
    enabled: false,
    config: { promptTemplate: '请生成本周回顾：总结本周完成的任务、遇到的问题、下周计划建议', outputFormat: 'markdown' }
  },
  {
    name: '记忆清理',
    description: '清理30天前的低重要性记忆数据，释放存储空间',
    type: 'memory_cleanup',
    frequency: 'weekly',
    cronExpression: '0 0 * * 1',
    enabled: true,
    config: { retentionDays: 30, importanceThreshold: 'low', dryRun: false }
  },
  {
    name: '知识库备份',
    description: '定期导出知识库数据，防止数据丢失',
    type: 'data_sync',
    frequency: 'monthly',
    cronExpression: '0 10 1 * *',
    enabled: false,
    config: { exportFormat: 'json', includeAttachments: true, compression: true }
  }
];

class CastSchedulerEngineClass {
  private tasks: Map<string, ScheduledTask> = new Map();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;
  private callbacks: SchedulerCallbacks = {};
  private isRunningState: boolean = false;
  private isPausedState: boolean = false;
  private tickMs: number = 30000;
  private visibilityHandler: (() => void) | null = null;
  private todayRunCount: number = 0;
  private lastResetDay: number = 0;

  start(): void {
    if (this.isRunningState) return;

    this.isRunningState = true;
    this.isPausedState = false;
    this.startTime = Date.now();

    this.resetTodayCountIfNeeded();

    this.tickInterval = setInterval(() => this.tick(), this.tickMs);

    this.visibilityHandler = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.visibilityHandler);

    console.log('[CastScheduler] Engine started, tick interval:', this.tickMs, 'ms');
  }

  stop(): void {
    if (!this.isRunningState) return;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.isRunningState = false;
    this.isPausedState = false;

    console.log('[CastScheduler] Engine stopped');
  }

  pause(): void {
    if (!this.isRunningState || this.isPausedState) return;
    this.isPausedState = true;
    console.log('[CastScheduler] Engine paused');
  }

  resume(): void {
    if (!this.isRunningState || !this.isPausedState) return;
    this.isPausedState = false;
    console.log('[CastScheduler] Engine resumed');
  }

  addTask(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'failCount' | 'status'>): string {
    const id = generateTaskId();
    const now = Date.now();

    const task: ScheduledTask = {
      ...taskData,
      id,
      status: taskData.enabled ? 'idle' : 'disabled',
      runCount: 0,
      failCount: 0,
      createdAt: now,
      updatedAt: now
    };

    task.nextRunAt = this.getNextRunTime(task) ?? undefined;

    this.tasks.set(id, task);
    console.log(`[CastScheduler] Task added: ${task.name} (${id})`);

    return id;
  }

  removeTask(id: string): void {
    this.tasks.delete(id);
    console.log(`[CastScheduler] Task removed: ${id}`);
  }

  toggleTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;

    task.enabled = !task.enabled;
    task.status = task.enabled ? 'idle' : 'disabled';
    task.updatedAt = Date.now();
    task.nextRunAt = task.enabled ? this.getNextRunTime(task) ?? undefined : undefined;

    console.log(`[CastScheduler] Task toggled: ${id} -> enabled=${task.enabled}`);
  }

  async runTaskNow(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;

    await this.executeTask(task);
  }

  updateTask(id: string, updates: Partial<ScheduledTask>): void {
    const task = this.tasks.get(id);
    if (!task) return;

    Object.assign(task, updates, { updatedAt: Date.now() });

    if (updates.frequency || updates.cronExpression || updates.intervalMs || updates.enabled !== undefined) {
      task.nextRunAt = task.enabled ? this.getNextRunTime(task) ?? undefined : undefined;
    }

    if (updates.enabled !== undefined) {
      task.status = updates.enabled ? 'idle' : 'disabled';
    }
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getNextRunTime(task: ScheduledTask): number | null {
    const now = Date.now();

    switch (task.frequency) {
      case 'once':
        if (task.nextRunAt && task.nextRunAt > now) return task.nextRunAt;
        if (task.runCount > 0) return null;
        if (task.intervalMs) return now + task.intervalMs;
        return now + 60000;

      case 'minute': {
        const interval = task.intervalMs || 60000;
        const base = task.lastRunAt || now;
        return base + interval;
      }

      case 'hourly': {
        const interval = task.intervalMs || 3600000;
        const base = task.lastRunAt || now;
        return base + interval;
      }

      case 'daily': {
        if (task.cronExpression) {
          const parsed = parseCronExpression(task.cronExpression, new Date(now));
          return parsed ? parsed.getTime() : null;
        }
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow.getTime();
      }

      case 'weekly': {
        if (task.cronExpression) {
          const parsed = parseCronExpression(task.cronExpression, new Date(now));
          return parsed ? parsed.getTime() : null;
        }
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(9, 0, 0, 0);
        return nextWeek.getTime();
      }

      case 'monthly': {
        if (task.cronExpression) {
          const parsed = parseCronExpression(task.cronExpression, new Date(now));
          return parsed ? parsed.getTime() : null;
        }
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        nextMonth.setHours(10, 0, 0, 0);
        return nextMonth.getTime();
      }

      case 'cron': {
        if (!task.cronExpression) return null;
        const parsed = parseCronExpression(task.cronExpression, new Date(now));
        return parsed ? parsed.getTime() : null;
      }

      default:
        return null;
    }
  }

  getDueTasks(): ScheduledTask[] {
    const now = Date.now();
    const dueTasks: ScheduledTask[] = [];

    for (const task of this.tasks.values()) {
      if (!task.enabled || task.status === 'running' || task.status === 'disabled' || task.status === 'paused') continue;
      if (task.nextRunAt && task.nextRunAt <= now) {
        dueTasks.push(task);
      }
    }

    return dueTasks.sort((a, b) => (a.nextRunAt || 0) - (b.nextRunAt || 0));
  }

  getActiveTasks(): ScheduledTask[] {
    return this.getAllTasks().filter(t => t.enabled && t.status !== 'disabled');
  }

  getStats(): SchedulerStats {
    const allTasks = this.getAllTasks();
    const activeTasks = allTasks.filter(t => t.enabled && t.status !== 'disabled');
    const totalRuns = allTasks.reduce((sum, t) => sum + t.runCount, 0);
    const totalFails = allTasks.reduce((sum, t) => sum + t.failCount, 0);

    let nextRunTime: number | null = null;
    for (const task of activeTasks) {
      if (task.nextRunAt && (!nextRunTime || task.nextRunAt < nextRunTime)) {
        nextRunTime = task.nextRunAt;
      }
    }

    this.resetTodayCountIfNeeded();

    return {
      totalTasks: allTasks.length,
      activeTasks: activeTasks.length,
      todayRuns: this.todayRunCount,
      successRate: totalRuns > 0 ? ((totalRuns - totalFails) / totalRuns) * 100 : 100,
      nextRunTime,
      uptimeSeconds: this.isRunningState ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  }

  isRunning(): boolean {
    return this.isRunningState;
  }

  isPaused(): boolean {
    return this.isPausedState;
  }

  setCallbacks(callbacks: SchedulerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  setTickInterval(ms: number): void {
    this.tickMs = ms;
    if (this.isRunningState && this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => this.tick(), this.tickMs);
    }
  }

  importTasks(tasks: ScheduledTask[]): void {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  private resetTodayCountIfNeeded(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNum = today.getTime();

    if (this.lastResetDay !== todayNum) {
      this.todayRunCount = 0;
      this.lastResetDay = todayNum;
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => this.tick(), Math.max(this.tickMs, 120000));
      }
    } else {
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => this.tick(), this.tickMs);
      }
    }
  }

  private tick(): void {
    if (this.isPausedState) return;

    const dueTasks = this.getDueTasks();

    if (dueTasks.length > 0) {
      console.log(`[CastScheduler] Tick: ${dueTasks.length} due task(s)`);

      for (const task of dueTasks) {
        this.executeTask(task).catch(err => {
          console.error(`[CastScheduler] Unhandled error in task ${task.id}:`, err);
        });
      }
    }

    if (this.callbacks.onTick) {
      this.callbacks.onTick(this.getActiveTasks());
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    if (task.status === 'running') return;

    task.status = 'running';
    task.updatedAt = Date.now();

    this.callbacks.onTaskStart?.(task);

    try {
      const result = await this.executeByType(task);

      task.status = 'success';
      task.lastResult = result;
      task.lastError = undefined;
      task.lastRunAt = Date.now();
      task.runCount += 1;
      this.todayRunCount += 1;
      task.updatedAt = Date.now();
      task.nextRunAt = this.getNextRunTime(task) ?? undefined;

      if (task.frequency === 'once') {
        task.enabled = false;
        task.status = 'disabled';
      } else {
        task.status = 'idle';
      }

      this.callbacks.onTaskComplete?.(task, result);
      console.log(`[CastScheduler] Task completed: ${task.name} (${result.substring(0, 80)})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      task.status = 'failed';
      task.lastError = errorMessage;
      task.lastRunAt = Date.now();
      task.failCount += 1;
      this.todayRunCount += 1;
      task.updatedAt = Date.now();
      task.nextRunAt = this.getNextRunTime(task) ?? undefined;
      task.status = 'idle';

      this.callbacks.onTaskError?.(task, errorMessage);
      console.error(`[CastScheduler] Task failed: ${task.name} - ${errorMessage}`);
    }
  }

  private async executeByType(task: ScheduledTask): Promise<string> {
    switch (task.type) {
      case 'notification':
        return this.executeNotification(task);

      case 'memory_cleanup':
        return this.executeMemoryCleanup(task);

      case 'reminder':
        return this.executeReminder(task);

      case 'ai_generate':
        return this.executeAiGenerate(task);

      case 'data_sync':
        return this.executeDataSync(task);

      case 'custom':
        return this.executeCustom(task);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeNotification(task: ScheduledTask): Promise<string> {
    const title = task.config.title as string || task.name;
    const body = task.config.body as string || task.description;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '🔔' });
      } catch {
        console.log('[CastScheduler] Notification created (in-app fallback)');
      }
    }

    const event = new CustomEvent('cast-scheduler-notification', {
      detail: { taskId: task.id, title, body, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    return `通知已发送: "${title}" - ${body}`;
  }

  private async executeMemoryCleanup(_task: ScheduledTask): Promise<string> {
    const event = new CustomEvent('cast-scheduler-memory-cleanup', {
      detail: { timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    return '记忆清理任务已触发，等待系统处理';
  }

  private async executeReminder(task: ScheduledTask): Promise<string> {
    const message = task.config.message as string || task.description;

    const event = new CustomEvent('cast-scheduler-reminder', {
      detail: { taskId: task.id, message, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ 提醒: ${task.name}`, { body: message });
      } catch {
        // silent
      }
    }

    return `提醒已触发: "${task.name}" - ${message}`;
  }

  private async executeAiGenerate(task: ScheduledTask): Promise<string> {
    const promptTemplate = task.config.promptTemplate as string || '';

    if (!promptTemplate) {
      return `[AI生成] 任务 "${task.name}" 已就绪（无提示词模板，等待配置）`;
    }

    const event = new CustomEvent('cast-scheduler-ai-generate', {
      detail: { taskId: task.id, promptTemplate, config: task.config, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    return `[AI生成] 任务 "${task.name}" 已触发，模板: "${promptTemplate.substring(0, 50)}..."`;
  }

  private async executeDataSync(task: ScheduledTask): Promise<string> {
    const syncType = task.config.syncType as string || 'full';

    const event = new CustomEvent('cast-scheduler-data-sync', {
      detail: { taskId: task.id, syncType, config: task.config, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    return `[数据同步] 任务 "${task.name}" 已触发，类型: ${syncType}`;
  }

  private async executeCustom(task: ScheduledTask): Promise<string> {
    const handler = task.config.handler as string || '';
    const params = task.config.params as Record<string, unknown> || {};

    const event = new CustomEvent('cast-scheduler-custom', {
      detail: { taskId: task.id, handler, params, timestamp: Date.now() }
    });
    window.dispatchEvent(event);

    return `[自定义] 任务 "${task.name}" 已触发${handler ? `, 处理器: ${handler}` : ''}`;
  }
}

export const CastSchedulerEngine = new CastSchedulerEngineClass();

export { TASK_TYPE_LABELS, TASK_TYPE_ICONS, FREQUENCY_LABELS };
