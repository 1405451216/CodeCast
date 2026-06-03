import * as api from '../../api';
import type {
  TaskPlan,
  TaskAnalysis,
  RiskLevel,
  SubTask,
  PlanningProgress,
  AgentLoopConfigV2,
  DEFAULT_AGENT_CONFIG_V2
} from '../../types/agent';
import { TaskStatus, RiskLevel as RiskLevelEnum } from '../../types/agent';

const PLANNING_PROMPT = `你是一个专业的软件开发任务规划器。你的职责是将用户的自然语言任务描述分解为可执行的子任务步骤。

## 输出格式要求
你必须严格返回一个 JSON 对象，包含以下结构：

{
  "analysis": {
    "complexity": "simple|moderate|complex|very_complex",
    "requiresFileSystem": boolean,
    "requiresTerminal": boolean,
    "requiresCodeGeneration": boolean,
    "requiresTesting": boolean,
    "potentialRisks": [
      {
        "area": "风险领域",
        "level": "low|medium|high|critical",
        "reason": "原因说明",
        "mitigation": "缓解措施"
      }
    ],
    "suggestedTools": ["工具名称列表"],
    "dependencies": ["依赖项列表"]
  },
  "subTasks": [
    {
      "order": 1,
      "title": "步骤标题",
      "description": "详细描述",
      "riskLevel": "low|medium|high|critical",
      "estimatedTurns": 预估轮次数字,
      "dependencies": ["依赖的步骤order数组"],
      "toolCalls": [
        {
          "name": "工具名",
          "description": "工具用途",
          "parameters": {},
          "riskLevel": "low|medium|high|critical"
        }
      ]
    }
  ],
  "executionStrategy": {
    "mode": "sequential|parallel|dependency_graph",
    "maxConcurrentTasks": 数字,
    "failFast": boolean,
    "autoRetry": boolean,
    "maxRetriesPerTask": 数字,
    "verificationPoints": [
      {
        "afterStep": 步骤号,
        "checks": ["检查类型"],
        "required": boolean
      }
    ]
  },
  "rollbackPlan": [
    {
      "step": 步骤号,
      "action": "回滚操作描述",
      "command": "可选的回滚命令",
      "reversible": boolean
    }
  ],
  "estimatedTotalTurns": 总预估轮次,
  "confidence": 0.0-1.0 的置信度
}

## 规划原则

1. **粒度控制**: 每个子任务应该是原子性的、可独立验证的单元
2. **风险评估**:
   - low: 只读操作、信息收集
   - medium: 创建新文件、非破坏性修改
   - high: 删除文件、修改核心配置、数据库迁移
   - critical: 不可逆操作、生产环境变更

3. **依赖关系**: 明确标记步骤间的依赖，支持并行执行优化
4. **工具选择**: 根据任务性质推荐合适的工具组合
5. **验证点**: 在关键步骤后设置验证点确保质量
6. **回滚计划**: 为高风险操作提供回滚方案

## 常用工具参考
- ReadFile: 读取文件内容
- WriteFile: 写入文件
- ExecuteCommand: 执行终端命令
- SendMessageEx: 调用AI助手分析代码
- ListFiles: 列出目录结构
- GetGitStatus: 检查git状态

## 任务描述
{{TASK_DESCRIPTION}}

请根据以上要求生成详细的执行计划。`;

export class TaskPlanner {
  private abortController: AbortController | null = null;
  private config: AgentLoopConfigV2;

  constructor(config?: Partial<AgentLoopConfigV2>) {
    this.config = {
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
      verificationSteps: ['check_lint', 'run_tests'],
      ...config
    };
  }

  async planTask(
    taskDescription: string,
    sessionId: string,
    model: string,
    onProgress?: (progress: PlanningProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<TaskPlan> {
    this.abortController = new AbortController();

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => this.abortController?.abort(), { once: true });
    }

    const taskId = this.generateTaskId();

    try {
      onProgress?.({
        phase: 'analyzing',
        progress: 5,
        message: '正在分析任务需求...'
      });

      const prompt = PLANNING_PROMPT.replace('{{TASK_DESCRIPTION}}', taskDescription);

      onProgress?.({
        phase: 'decomposing',
        progress: 20,
        message: '正在调用AI进行任务分解...'
      });

      const messages = await api.sendMessageEx(
        sessionId,
        prompt,
        model,
        false
      );

      if (abortSignal?.aborted || this.abortController.signal.aborted) {
        throw new Error('规划过程被用户取消');
      }

      onProgress?.({
        phase: 'assessing_risks',
        progress: 60,
        message: '正在评估风险和依赖关系...'
      });

      const assistantMessage = messages.find(m => m.role === 'assistant');
      if (!assistantMessage?.content) {
        throw new Error('AI 未返回有效的规划结果');
      }

      onProgress?.({
        phase: 'building_plan',
        progress: 75,
        message: '正在构建执行计划...'
      });

      const plan = this.parseAndValidatePlan(assistantMessage.content, taskId, taskDescription);

      onProgress?.({
        phase: 'optimizing',
        progress: 90,
        message: '正在优化执行顺序...'
      });

      const optimizedPlan = this.optimizePlan(plan);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: `规划完成！共 ${optimizedPlan.subTasks.length} 个子任务`,
        partialPlan: optimizedPlan
      });

      return optimizedPlan;

    } catch (error: any) {
      if (error.message === '规划过程被用户取消') {
        throw error;
      }
      console.error('[TaskPlanner] 规划失败:', error);
      throw new Error(`任务规划失败: ${error.message}`);
    } finally {
      this.abortController = null;
    }
  }

  private parseAndValidatePlan(rawContent: string, taskId: string, taskDescription: string): TaskPlan {
    let jsonStr = rawContent.trim();

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从AI响应中提取JSON格式的计划');
    }

    jsonStr = jsonMatch[0];

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[TaskPlanner] JSON解析错误:', parseError);
      console.error('[TaskPlanner] 原始内容:', jsonStr);
      throw new Error('AI返回的计划格式无效，无法解析JSON');
    }

    return this.validateAndNormalizePlan(parsed as Record<string, unknown>, taskId, taskDescription);
  }

  private validateAndNormalizePlan(
    raw: Record<string, unknown>,
    taskId: string,
    taskDescription: string
  ): TaskPlan {
    if (!raw.subTasks || !Array.isArray(raw.subTasks) || raw.subTasks.length === 0) {
      throw new Error('计划必须包含至少一个子任务');
    }

    const analysis = this.normalizeAnalysis(raw.analysis as Record<string, unknown>);
    const subTasks = this.normalizeSubTasks(raw.subTasks as Array<Record<string, unknown>>);
    const strategy = this.normalizeExecutionStrategy(raw.executionStrategy as Record<string, unknown>);
    const rollbackPlan = this.normalizeRollbackPlan(raw.rollbackPlan as Array<Record<string, unknown>>);

    return {
      version: '2.0',
      taskId,
      taskDescription,
      analysis,
      subTasks,
      executionStrategy: strategy,
      rollbackPlan,
      estimatedTotalTurns: (raw.estimatedTotalTurns as number) || subTasks.reduce((sum, t) => sum + t.estimatedTurns, 0),
      confidence: (raw.confidence as number) || 0.8
    };
  }

  private normalizeAnalysis(raw?: Record<string, unknown>): TaskAnalysis {
    if (!raw) {
      return {
        complexity: 'moderate',
        requiresFileSystem: true,
        requiresTerminal: true,
        requiresCodeGeneration: true,
        requiresTesting: false,
        potentialRisks: [],
        suggestedTools: [],
        dependencies: []
      };
    }

    return {
      complexity: (['simple', 'moderate', 'complex', 'very_complex'].includes(raw.complexity as string)
        ? raw.complexity : 'moderate') as TaskAnalysis['complexity'],
      requiresFileSystem: Boolean(raw.requiresFileSystem),
      requiresTerminal: Boolean(raw.requiresTerminal),
      requiresCodeGeneration: Boolean(raw.requiresCodeGeneration),
      requiresTesting: Boolean(raw.requiresTesting),
      potentialRisks: Array.isArray(raw.potentialRisks) ? (raw.potentialRisks as Array<Record<string, unknown>>).map(r => ({
        area: String(r.area || '未知'),
        level: this.parseRiskLevel(r.level),
        reason: String(r.reason || ''),
        mitigation: String(r.mitigation || '')
      })) : [],
      suggestedTools: Array.isArray(raw.suggestedTools) ? raw.suggestedTools.map(String) : [],
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : []
    };
  }

  private normalizeSubTasks(raw: Array<Record<string, unknown>>): TaskPlan['subTasks'] {
    return raw.map((task, index) => ({
      order: typeof task.order === 'number' ? task.order : index + 1,
      title: String(task.title || `步骤 ${index + 1}`),
      description: String(task.description || ''),
      riskLevel: this.parseRiskLevel(task.riskLevel),
      estimatedTurns: typeof task.estimatedTurns === 'number' && task.estimatedTurns > 0
        ? task.estimatedTurns : 1,
      dependencies: Array.isArray(task.dependencies)
        ? task.dependencies.map(d => String(typeof d === 'number' ? d : parseInt(String(d), 10) || 0))
        : [],
      toolCalls: Array.isArray(task.toolCalls)
        ? (task.toolCalls as Array<Record<string, unknown>>).map(tc => ({
            name: String(tc.name || 'unknown'),
            description: String(tc.description || ''),
            parameters: (tc.parameters && typeof tc.parameters === 'object') ? tc.parameters as Record<string, unknown> : {},
            riskLevel: this.parseRiskLevel(tc.riskLevel)
          }))
        : [],
      maxRetries: typeof task.maxRetries === 'number' ? task.maxRetries : this.config.maxRetries,
      retryCount: 0
    }));
  }

  private normalizeExecutionStrategy(raw?: Record<string, unknown>): TaskPlan['executionStrategy'] {
    if (!raw) {
      return {
        mode: 'sequential',
        maxConcurrentTasks: 1,
        failFast: false,
        autoRetry: true,
        maxRetriesPerTask: this.config.maxRetries,
        verificationPoints: []
      };
    }

    return {
      mode: (['sequential', 'parallel', 'dependency_graph'].includes(raw.mode as string)
        ? raw.mode : 'sequential') as TaskPlan['executionStrategy']['mode'],
      maxConcurrentTasks: typeof raw.maxConcurrentTasks === 'number' ? raw.maxConcurrentTasks : 1,
      failFast: Boolean(raw.failFast),
      autoRetry: raw.autoRetry !== false,
      maxRetriesPerTask: typeof raw.maxRetriesPerTask === 'number'
        ? raw.maxRetriesPerTask : this.config.maxRetries,
      verificationPoints: Array.isArray(raw.verificationPoints)
        ? (raw.verificationPoints as Array<Record<string, unknown>>).map(vp => ({
            afterStep: typeof vp.afterStep === 'number' ? vp.afterStep : 0,
            checks: Array.isArray(vp.checks) ? vp.checks as TaskPlan['executionStrategy']['verificationPoints'][0]['checks'] : [],
            required: Boolean(vp.required)
          }))
        : []
    };
  }

  private normalizeRollbackPlan(raw?: Array<Record<string, unknown>>): TaskPlan['rollbackPlan'] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map(step => ({
      step: typeof step.step === 'number' ? step.step : 0,
      action: String(step.action || ''),
      command: step.command ? String(step.command) : undefined,
      reversible: step.reversible !== false
    }));
  }

  private parseRiskLevel(level?: unknown): RiskLevel {
    if (typeof level !== 'string') return RiskLevelEnum.MEDIUM;
    const normalized = level.toLowerCase();
    if (normalized in RiskLevelEnum) {
      return normalized as RiskLevel;
    }
    return RiskLevelEnum.MEDIUM;
  }

  private optimizePlan(plan: TaskPlan): TaskPlan {
    const optimizedSubTasks = [...plan.subTasks];

    optimizedSubTasks.sort((a, b) => a.order - b.order);

    for (let i = 0; i < optimizedSubTasks.length; i++) {
      const task = optimizedSubTasks[i];
      if (task.dependencies.length === 0 && i > 0) {
        const prevTask = optimizedSubTasks[i - 1];
        if (prevTask.riskLevel === RiskLevelEnum.LOW && task.riskLevel === RiskLevelEnum.LOW) {
          task.dependencies = [String(prevTask.order)];
        }
      }
    }

    if (plan.executionStrategy.verificationPoints.length === 0) {
      const highRiskSteps = optimizedSubTasks
        .filter(t => t.riskLevel === RiskLevelEnum.HIGH || t.riskLevel === RiskLevelEnum.CRITICAL)
        .map(t => t.order);

      highRiskSteps.forEach(step => {
        plan.executionStrategy.verificationPoints.push({
          afterStep: step,
          checks: ['syntax_check'],
          required: true
        });
      });
    }

    return {
      ...plan,
      subTasks: optimizedSubTasks
    };
  }

  generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  generateSubTaskId(): string {
    return `subtask_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  convertPlanToAgentTask(plan: TaskPlan, sessionId: string, originalInput: string): SubTask[] {
    return plan.subTasks.map(subTaskDef => ({
      id: this.generateSubTaskId(),
      taskId: plan.taskId,
      order: subTaskDef.order,
      title: subTaskDef.title,
      description: subTaskDef.description,
      status: subTaskDef.order === 1 ? TaskStatus.RUNNING : TaskStatus.IDLE,
      riskLevel: subTaskDef.riskLevel,
      estimatedTurns: subTaskDef.estimatedTurns,
      actualTurns: 0,
      dependencies: subTaskDef.dependencies,
      toolCalls: subTaskDef.toolCalls,
      retryCount: 0,
      maxRetries: subTaskDef.maxRetries,
      logs: []
    }));
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  updateConfig(updates: Partial<AgentLoopConfigV2>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): AgentLoopConfigV2 {
    return { ...this.config };
  }

  static createDefaultPlanner(): TaskPlanner {
    return new TaskPlanner();
  }

  static estimateComplexity(description: string): TaskAnalysis['complexity'] {
    const lowerDesc = description.toLowerCase();

    const complexPatterns = [
      /重构|refactor.*系统|架构/,
      /迁移|migrate.*数据库|升级.*框架/,
      /实现.*完整.*功能|从零.*构建/,
      /集成.*多个.*服务|微服务/
    ];

    const simplePatterns = [
      /修复.*bug|fix.*typo|改.*错别字/,
      /添加.*注释|更新.*文档/,
      /调整.*样式|修改.*颜色|改变.*字体/,
      /重命名.*变量|rename/
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(lowerDesc)) return 'very_complex';
    }

    for (const pattern of simplePatterns) {
      if (pattern.test(lowerDesc)) return 'simple';
    }

    if (lowerDesc.includes('创建') || lowerDesc.includes('实现') || lowerDesc.includes('开发')) {
      return 'complex';
    }

    return 'moderate';
  }
}

export default TaskPlanner;
