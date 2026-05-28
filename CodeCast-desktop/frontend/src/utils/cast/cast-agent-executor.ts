import { CastToolRegistry } from '../../tools/CastToolRegistry';
import { sendMessageEx } from '../../api';
import type {
  CastAgentTask,
  CastAgentStep,
  CastAgentExecutionEvent,
  CastAgentStepStatus
} from '../../types/cast-agent';
import { TaskStatus } from '../../types/agent';

type StepApprovalResolver = (approved: boolean) => void;

export class CastAgentExecutor {
  private task: CastAgentTask;
  private abortController: AbortController | null = null;
  private eventHandlers: Set<(event: CastAgentExecutionEvent) => void> = new Set();
  private approvalResolvers: Map<string, StepApprovalResolver> = new Map();
  private isPaused: boolean = false;
  private pauseResolver: (() => void) | null = null;
  private cancelled: boolean = false;

  constructor(task: CastAgentTask) {
    this.task = JSON.parse(JSON.stringify(task));
  }

  async execute(onEvent?: (event: CastAgentExecutionEvent) => void): Promise<CastAgentTask> {
    if (onEvent) {
      this.onEvent(onEvent);
    }

    this.abortController = new AbortController();
    this.cancelled = false;
    this.isPaused = false;

    this.emit({ type: 'task_created', taskId: this.task.id, timestamp: Date.now() });

    this.task.status = TaskStatus.RUNNING;
    this.task.startedAt = Date.now();

    try {
      while (this.currentStepIndex < this.task.steps.length) {
        if (this.cancelled) {
          this.task.status = TaskStatus.FAILED;
          this.emit({ type: 'task_cancelled', taskId: this.task.id, timestamp: Date.now() });
          break;
        }

        if (this.isPaused) {
          await this.waitForResume();
          if (this.cancelled) break;
        }

        const step = this.task.steps[this.currentStepIndex];

        if (step.status === 'completed' || step.status === 'skipped') {
          this.currentStepIndex++;
          continue;
        }

        await this.executeStep(step);

        if (step.status === 'failed' && !this.cancelled) {
          this.task.failedSteps++;
        }

        this.currentStepIndex++;
        this.task.completedSteps = this.task.steps.filter(s => s.status === 'completed').length;
      }

      if (!this.cancelled && this.task.status !== 'failed') {
        this.task.status = TaskStatus.COMPLETED;
        this.task.completedAt = Date.now();
        this.task.duration = this.task.completedAt - (this.task.startedAt || this.task.createdAt);

        this.task.finalSummary = await this.generateFinalSummary();

        this.emit({
          type: 'task_complete',
          taskId: this.task.id,
          data: { summary: this.task.finalSummary },
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      console.error('[CastAgentExecutor] Execution error:', error);
      this.task.status = TaskStatus.FAILED;
      this.emit({
        type: 'task_fail',
        taskId: this.task.id,
        data: { error: error.message },
        timestamp: Date.now()
      });
    }

    return this.task;
  }

  async executeSingleStep(stepId: string): Promise<void> {
    const stepIndex = this.task.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`[CastAgentExecutor] Step not found: ${stepId}`);
    }

    const step = this.task.steps[stepIndex];
    step.status = 'pending';
    step.outputResult = undefined;
    step.error = undefined;
    step.duration = undefined;
    step.startTime = undefined;
    step.endTime = undefined;

    this.currentStepIndex = stepIndex;

    await this.executeStep(step);

    this.task.completedSteps = this.task.steps.filter(s => s.status === 'completed').length;
    this.task.failedSteps = this.task.steps.filter(s => s.status === 'failed').length;
  }

  private async executeStep(step: CastAgentStep): Promise<void> {
    step.status = 'running';
    step.startTime = Date.now();
    step.approvedByUser = false;

    this.emit({
      type: 'step_start',
      taskId: this.task.id,
      stepId: step.id,
      data: { order: step.order, title: step.title },
      timestamp: Date.now()
    });

    this.emitProgress();

    if (this.abortController?.signal.aborted) {
      step.status = 'failed';
      step.error = '执行被取消';
      step.endTime = Date.now();
      step.duration = step.endTime - (step.startTime || step.endTime);
      this.emitStepFail(step);
      return;
    }

    if (step.requiresApproval) {
      step.status = 'waiting_approval';
      this.emit({
        type: 'step_waiting_approval',
        taskId: this.task.id,
        stepId: step.id,
        data: { title: step.title, toolId: step.toolId },
        timestamp: Date.now()
      });

      const approved = await this.waitForApproval(step.id);

      if (!approved) {
        step.status = 'skipped';
        step.endTime = Date.now();
        step.duration = step.endTime - (step.startTime || step.endTime);
        return;
      }

      step.approvedByUser = true;
      step.status = 'running';

      this.emit({
        type: 'step_approved',
        taskId: this.task.id,
        stepId: step.id,
        timestamp: Date.now()
      });
    }

    try {
      const tool = CastToolRegistry.get(step.toolId);
      if (!tool) {
        throw new Error(`工具 "${step.toolId}" 未在注册中心找到`);
      }

      const context = {
        sessionId: this.task.metadata.sessionId,
        signal: this.abortController?.signal,
        tools: new Map(CastToolRegistry.getSnapshot()),
        sendMessage: (msg: string) => {
          console.log(`[CastAgentExecutor][${step.toolId}]`, msg);
        }
      };

      const result = await tool.execute(step.toolParams, context);

      step.outputResult = result.output || (result.data ? JSON.stringify(result.data, null, 2) : '');

      if (!result.success) {
        throw new Error(result.error || '工具执行返回失败');
      }

      step.status = 'completed';
      step.endTime = Date.now();
      step.duration = step.endTime - (step.startTime || step.endTime);

      this.emit({
        type: 'step_complete',
        taskId: this.task.id,
        stepId: step.id,
        data: {
          output: step.outputResult,
          duration: step.duration
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      step.status = 'failed';
      step.error = error.message || String(error);
      step.endTime = Date.now();
      step.duration = step.endTime - (step.startTime || step.endTime);
      this.emitStepFail(step);
    }

    this.emitProgress();
  }

  private emitStepFail(step: CastAgentStep): void {
    this.emit({
      type: 'step_fail',
      taskId: this.task.id,
      stepId: step.id,
      data: { error: step.error, title: step.title },
      timestamp: Date.now()
    });
  }

  private emitProgress(): void {
    this.emit({
      type: 'progress',
      taskId: this.task.id,
      data: this.getProgress(),
      timestamp: Date.now()
    });
  }

  private waitForApproval(stepId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.approvalResolvers.set(stepId, resolve);
    });
  }

  private waitForResume(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  approveStep(stepId: string): void {
    const resolver = this.approvalResolvers.get(stepId);
    if (resolver) {
      resolver(true);
      this.approvalResolvers.delete(stepId);
    }
  }

  rejectStep(stepId: string): void {
    const resolver = this.approvalResolvers.get(stepId);
    if (resolver) {
      resolver(false);
      this.approvalResolvers.delete(stepId);
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.isPaused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
    this.abortController?.abort();

    for (const [stepId, resolver] of this.approvalResolvers) {
      resolver(false);
      this.approvalResolvers.delete(stepId);
    }
  }

  getProgress(): { current: number; total: number; percent: number } {
    const total = this.task.steps.length;
    const completed = this.task.steps.filter(s => s.status === 'completed').length;
    return {
      current: completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  async generateFinalSummary(): Promise<string> {
    const completedSteps = this.task.steps.filter(s => s.status === 'completed');
    const failedSteps = this.task.steps.filter(s => s.status === 'failed');
    const skippedSteps = this.task.steps.filter(s => s.status === 'skipped');

    let summaryText = `# 任务执行报告\n\n`;
    summaryText += `**目标**: ${this.task.userGoal}\n\n`;
    summaryText += `**总步骤**: ${this.task.steps.length} | `;
    summaryText += `**完成**: ${completedSteps.length} | `;
    summaryText += `**失败**: ${failedSteps.length} | `;
    summaryText += `**跳过**: ${skippedSteps.length}\n\n`;

    summaryText += `## 执行详情\n\n`;

    for (const step of this.task.steps) {
      const statusIcon = this.getStatusIcon(step.status);
      summaryText += `${statusIcon} **${step.order}. ${step.title}** (${step.toolId})\n`;

      if (step.status === 'completed' && step.outputResult) {
        const preview = step.outputResult.slice(0, 200) + (step.outputResult.length > 200 ? '...' : '');
        summaryText += `   结果: ${preview}\n`;
      }

      if (step.status === 'failed' && step.error) {
        summaryText += `   错误: ${step.error}\n`;
      }

      if (step.duration) {
        summaryText += `   耗时: ${(step.duration / 1000).toFixed(1)}s\n`;
      }

      summaryText += '\n';
    }

    try {
      const model = 'gpt-4o-mini';
      const summarizePrompt = `请对以下Cast Agent任务执行结果进行简洁的中文总结（不超过300字），突出关键成果：

${summaryText}

请输出总结内容，不要包含markdown标题。`;

      const response = await sendMessageEx(
        this.task.metadata.sessionId || '',
        summarizePrompt,
        model,
        false
      );

      let responseText = '';
      const rawResponse = response;
      if (Array.isArray(rawResponse)) {
        responseText = rawResponse.map(msg => {
          if (typeof msg === 'string') return msg;
          return (msg as any)?.content || '';
        }).join('\n').trim();
      } else {
        responseText = String(rawResponse).trim();
      }

      if (responseText) {
        return responseText;
      }
    } catch (error: any) {
      console.warn('[CastAgentExecutor] Summary generation failed:', error.message);
    }

    return summaryText;
  }

  private getStatusIcon(status: CastAgentStepStatus): string {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'waiting_approval': return '⏸️';
      default: return '⬜';
    }
  }

  get currentStepIndex(): number {
    return this.task.currentStepIndex;
  }

  set currentStepIndex(value: number) {
    this.task.currentStepIndex = value;
  }

  getTask(): CastAgentTask {
    return this.task;
  }

  updateTask(updates: Partial<CastAgentTask>): void {
    this.task = { ...this.task, ...updates };
  }

  onEvent(handler: (event: CastAgentExecutionEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private emit(event: CastAgentExecutionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[CastAgentExecutor] Event handler error:', error);
      }
    }
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  isExecutionPaused(): boolean {
    return this.isPaused;
  }

  destroy(): void {
    this.cancel();
    this.eventHandlers.clear();
    this.approvalResolvers.clear();
    this.abortController = null;
  }
}
