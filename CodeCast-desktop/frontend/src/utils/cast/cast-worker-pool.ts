type WorkerTaskId = string;
type WorkerMessageType = 'compute' | 'cancel' | 'ping' | 'pong' | 'error' | 'result';

interface WorkerMessage {
  id: WorkerTaskId;
  type: WorkerMessageType;
  payload?: unknown;
  workerFn?: string;
  args?: unknown[];
}

interface WorkerResult<T = unknown> {
  id: WorkerTaskId;
  result?: T;
  error?: string;
  duration: number;
}

interface WorkerPoolOptions {
  maxWorkers?: number;
  taskTimeoutMs?: number;
  name?: string;
}

interface PendingTask {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  startTime: number;
}

class CastWorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Set<number> = new Set();
  private pendingTasks: Map<WorkerTaskId, PendingTask> = new Map();
  private taskQueue: Array<{ id: WorkerTaskId; fn: string; args: unknown[]; resolve: (v: any) => void; reject: (e: Error) => void }> = [];
  private currentTaskIndex = 0;
  private options: Required<WorkerPoolOptions>;
  private isDestroyed = false;

  constructor(options: WorkerPoolOptions = {}) {
    this.options = {
      maxWorkers: Math.min(navigator.hardwareConcurrency || 4, 4),
      taskTimeoutMs: 30000,
      name: 'cast-worker',
      ...options,
    };
  }

  get stats() {
    return {
      totalWorkers: this.workers.length,
      idleWorkers: this.idleWorkers.size,
      pendingTasks: this.pendingTasks.size,
      queuedTasks: this.taskQueue.length,
      isDestroyed: this.isDestroyed,
    };
  }

  async execute<T = unknown>(fn: (...args: any[]) => T, ...args: unknown[]): Promise<T> {
    if (this.isDestroyed) throw new Error('Worker pool destroyed');

    const fnStr = fn.toString();
    const canInline = this.isSimpleFunction(fnStr);

    if (!canInline || typeof Worker === 'undefined') {
      return fn(...args);
    }

    return new Promise<T>((resolve, reject) => {
      const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      this.taskQueue.push({ id, fn: fnStr, args, resolve, reject });
      this.processQueue();
    });
  }

  async executeBatch<T = unknown>(
    tasks: Array<{ fn: (...args: any[]) => T; args: unknown[] }>
  ): Promise<T[]> {
    if (this.isDestroyed) throw new Error('Worker pool destroyed');

    return Promise.all(tasks.map(t => this.execute(t.fn, ...t.args)));
  }

  cancelTask(id: WorkerTaskId): boolean {
    const task = this.pendingTasks.get(id);
    if (task) {
      clearTimeout(task.timer);
      this.pendingTasks.delete(id);
      for (const w of this.workers) {
        try { w.postMessage({ id, type: 'cancel' }); } catch {}
      }
      task.reject(new Error('Task cancelled'));
      return true;
    }
    const qi = this.taskQueue.findIndex(t => t.id === id);
    if (qi !== -1) {
      const qtask = this.taskQueue.splice(qi, 1)[0];
      qtask.reject(new Error('Task cancelled'));
      return true;
    }
    return false;
  }

  destroy(): void {
    this.isDestroyed = true;
    for (const [id, task] of this.pendingTasks) {
      clearTimeout(task.timer);
      task.reject(new Error('Worker pool destroyed'));
    }
    this.pendingTasks.clear();
    for (const w of this.workers) {
      try { w.terminate(); } catch {}
    }
    this.workers = [];
    this.idleWorkers.clear();
    this.taskQueue = [];
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.getIdleWorkerIndex() !== -1) {
      const task = this.taskQueue.shift()!;
      this.dispatchToWorker(task);
    }
  }

  private dispatchToWorker(task: {
    id: WorkerTaskId;
    fn: string;
    args: unknown[];
    resolve: (v: any) => void;
    reject: (e: Error) => void;
  }): void {
    const workerIdx = this.getIdleWorkerIndex();
    if (workerIdx === -1) {
      this.taskQueue.unshift(task);
      return;
    }

    this.idleWorkers.delete(workerIdx);
    const worker = this.workers[workerIdx];

    const timer = setTimeout(() => {
      this.pendingTasks.delete(task.id);
      this.idleWorkers.add(workerIdx);
      task.reject(new Error(`Task timeout after ${this.options.taskTimeoutMs}ms`));
      this.processQueue();
    }, this.options.taskTimeoutMs);

    this.pendingTasks.set(task.id, {
      resolve: task.resolve,
      reject: task.reject,
      timer,
      startTime: performance.now(),
    });

    try {
      worker.postMessage({
        id: task.id,
        type: 'compute',
        workerFn: task.fn,
        args: task.args,
      } as WorkerMessage);
    } catch (e) {
      clearTimeout(timer);
      this.pendingTasks.delete(task.id);
      this.idleWorkers.add(workerIdx);
      task.reject(e instanceof Error ? e : new Error(String(e)));
      this.processQueue();
    }
  }

  private getIdleWorkerIndex(): number {
    if (this.idleWorkers.size > 0) return this.idleWorkers.values().next().value ?? -1;
    if (this.workers.length < this.options.maxWorkers) {
      return this.createWorker();
    }
    return -1;
  }

  private createWorker(): number {
    const idx = this.workers.length;
    const blob = new Blob(
      [`self.onmessage=function(e){const d=e.data;if(d.type==='ping'){postMessage({id:d.id,type:'pong'});return}
if(d.type==='compute'){try{const fn=new Function('return '+d.workerFn)();const r=fn.apply(null,d.args||[]);postMessage({id:d.id,type:'result',result:r,duration:performance.now()})}catch(err){postMessage({id:d.id,type:'error',error:String(err.message||err),duration:performance.now()})}}}`],
      { type: 'application/javascript' }
    );
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<WorkerResult>) => this.handleWorkerMessage(idx, e.data);
    worker.onerror = (e) => console.error(`[CastWorker:${idx}] Error:`, e.message);
    this.workers.push(worker);
    this.idleWorkers.add(idx);
    return idx;
  }

  private handleWorkerMessage(workerIdx: number, data: WorkerResult): void {
    const task = this.pendingTasks.get(data.id);
    if (!task) return;

    clearTimeout(task.timer);
    this.pendingTasks.delete(data.id);
    this.idleWorkers.add(workerIdx);

    const duration = data.duration - task.startTime;

    if (data.error) {
      task.reject(new Error(data.error));
    } else {
      task.resolve(data.result);
    }

    this.processQueue();
  }

  private isSimpleFunction(fnStr: string): boolean {
    if (fnStr.includes('import') || fnStr.includes('require') || fnStr.includes('fetch')) return false;
    if (fnStr.includes('document.') || fnStr.includes('window.')) return false;
    if (fnStr.includes('localStorage') || fnStr.includes('sessionStorage')) return false;
    return true;
  }
}

export const castWorkerPool = new CastWorkerPool();

export function runInWorker<T>(fn: (...args: any[]) => T, ...args: unknown[]): Promise<T> {
  return castWorkerPool.execute(fn, ...args);
}

export function runInWorkerBatch<T>(
  tasks: Array<{ fn: (...args: any[]) => T; args: unknown[] }>
): Promise<T[]> {
  return castWorkerPool.executeBatch(tasks);
}
