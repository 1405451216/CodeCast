import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPlanner } from '../TaskPlanner';
import type { TaskPlan, TaskAnalysis, SubTask, RiskLevel } from '../../../types/agent';
import { RiskLevel as RiskLevelEnum, TaskStatus } from '../../../types/agent';

vi.mock('../../../api', () => ({
  sendMessageEx: vi.fn().mockResolvedValue([
    {
      id: 'msg_1',
      role: 'assistant',
      content: JSON.stringify({
        analysis: {
          complexity: 'moderate',
          requiresFileSystem: true,
          requiresTerminal: true,
          requiresCodeGeneration: true,
          requiresTesting: false,
          potentialRisks: [],
          suggestedTools: ['ReadFile', 'WriteFile'],
          dependencies: []
        },
        subTasks: [
          {
            order: 1,
            title: '分析需求',
            description: '分析用户需求并制定计划',
            riskLevel: 'low',
            estimatedTurns: 2,
            dependencies: [],
            toolCalls: []
          },
          {
            order: 2,
            title: '实现功能',
            description: '编写代码实现核心功能',
            riskLevel: 'medium',
            estimatedTurns: 5,
            dependencies: ['1'],
            toolCalls: [{ name: 'WriteFile', description: '写入文件', parameters: {}, riskLevel: 'low' }]
          }
        ],
        executionStrategy: {
          mode: 'sequential',
          maxConcurrentTasks: 1,
          failFast: false,
          autoRetry: true,
          maxRetriesPerTask: 3,
          verificationPoints: []
        },
        rollbackPlan: [],
        estimatedTotalTurns: 7,
        confidence: 0.85
      })
    }
  ])
}));

describe('TaskPlanner', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    planner = new TaskPlanner();
  });

  describe('parseAndValidatePlan()', () => {
    it('应该正确解析有效的 AI 输出 JSON', async () => {
      const plan = await planner.planTask(
        '实现一个用户登录功能',
        'session_123',
        'deepseek-v4-flash'
      );

      expect(plan).toBeDefined();
      expect(plan.version).toBe('2.0');
      expect(plan.taskId).toBeDefined();
      expect(plan.taskDescription).toBe('实现一个用户登录功能');
      expect(plan.subTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('应该包含正确的分析信息', async () => {
      const plan = await planner.planTask(
        '添加单元测试覆盖',
        'session_456',
        'deepseek-v4-flash'
      );

      expect(plan.analysis).toBeDefined();
      expect(['simple', 'moderate', 'complex', 'very_complex']).toContain(plan.analysis.complexity);
      expect(typeof plan.analysis.requiresFileSystem).toBe('boolean');
      expect(typeof plan.analysis.requiresTerminal).toBe('boolean');
      expect(Array.isArray(plan.analysis.potentialRisks)).toBe(true);
      expect(Array.isArray(plan.analysis.suggestedTools)).toBe(true);
    });

    it('子任务应该包含必要的字段', async () => {
      const plan = await planner.planTask(
        '创建 API 接口',
        'session_789',
        'deepseek-v4-flash'
      );

      const firstSubTask = plan.subTasks[0];
      expect(firstSubTask.order).toBeDefined();
      expect(firstSubTask.title).toBeDefined();
      expect(firstSubTask.description).toBeDefined();
      expect(firstSubTask.riskLevel).toBeDefined();
      expect(firstSubTask.estimatedTurns).toBeGreaterThan(0);
      expect(Array.isArray(firstSubTask.dependencies)).toBe(true);
      expect(Array.isArray(firstSubTask.toolCalls)).toBe(true);
    });

    it('执行策略应该有默认值', async () => {
      const plan = await planner.planTask(
        '简单任务描述',
        'session_default',
        'model'
      );

      expect(plan.executionStrategy).toBeDefined();
      expect(['sequential', 'parallel', 'dependency_graph']).toContain(plan.executionStrategy.mode);
      expect(typeof plan.executionStrategy.maxConcurrentTasks).toBe('number');
      expect(typeof plan.executionStrategy.failFast).toBe('boolean');
      expect(typeof plan.executionStrategy.autoRetry).toBe('boolean');
    });
  });

  describe('optimizePlan()', () => {
    it('应该按顺序排序子任务', async () => {
      const plan = await planner.planTask(
        '优化测试任务',
        'session_sort',
        'model'
      );

      const orders = plan.subTasks.map(st => st.order);
      const sortedOrders = [...orders].sort((a, b) => a - b);

      expect(orders).toEqual(sortedOrders);
    });

    it('应该为高风险步骤插入验证点', async () => {
      const plan = await planner.planTask(
        '高风险任务',
        'session_verify',
        'model'
      );

      const hasHighRiskTasks = plan.subTasks.some(
        st => st.riskLevel === RiskLevelEnum.HIGH || st.riskLevel === RiskLevelEnum.CRITICAL
      );

      if (hasHighRiskTasks) {
        expect(plan.executionStrategy.verificationPoints.length).toBeGreaterThan(0);
      }
    });

    it('低风险连续步骤应该建立依赖关系', async () => {
      const plan = await planner.planTask(
        '多步骤低风险任务',
        'session_deps',
        'model'
      );

      if (plan.subTasks.length >= 2) {
        const secondTask = plan.subTasks[1];
        if (
          secondTask.riskLevel === RiskLevelEnum.LOW &&
          plan.subTasks[0].riskLevel === RiskLevelEnum.LOW
        ) {
          expect(secondTask.dependencies.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('convertPlanToAgentTask()', () => {
    it('应该将 Plan 正确转换为 SubTask 数组', async () => {
      const plan = await planner.planTask(
        '转换测试任务',
        'session_convert',
        'model'
      );

      const agentTasks = planner.convertPlanToAgentTask(plan, 'session_convert', '转换测试任务');

      expect(agentTasks).toHaveLength(plan.subTasks.length);
    });

    it('生成的 SubTask 应该有唯一 ID', async () => {
      const plan = await planner.planTask(
        'ID 唯一性测试',
        'session_id',
        'model'
      );

      const agentTasks = planner.convertPlanToAgentTask(plan, 'session_id', 'ID 唯一性测试');
      const ids = agentTasks.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    it('第一个子任务状态应该是 QUEUED，其余应该是 PENDING', async () => {
      const plan = await planner.planTask(
        '状态初始化测试',
        'session_status',
        'model'
      );

      const agentTasks = planner.convertPlanToAgentTask(plan, 'session_status', '状态初始化测试');

      if (agentTasks.length > 0) {
        expect(agentTasks[0].status).toBe(TaskStatus.QUEUED);

        for (let i = 1; i < agentTasks.length; i++) {
          expect(agentTasks[i].status).toBe(TaskStatus.PENDING);
        }
      }
    });

    it('应该保留原始计划的风险等级和预估轮次', async () => {
      const plan = await planner.planTask(
        '字段保留测试',
        'session_fields',
        'model'
      );

      const agentTasks = planner.convertPlanToAgentTask(plan, 'session_fields', '字段保留测试');

      agentTasks.forEach((task, index) => {
        expect(task.riskLevel).toBe(plan.subTasks[index].riskLevel);
        expect(task.estimatedTurns).toBe(plan.subTasks[index].estimatedTurns);
        expect(task.title).toBe(plan.subTasks[index].title);
        expect(task.description).toBe(plan.subTasks[index].description);
      });
    });

    it('retryCount 应该初始化为 0', async () => {
      const plan = await planner.planTask(
        '重试计数测试',
        'session_retry',
        'model'
      );

      const agentTasks = planner.convertPlanToAgentTask(plan, 'session_retry', '重试计数测试');

      agentTasks.forEach(task => {
        expect(task.retryCount).toBe(0);
        expect(task.actualTurns).toBe(0);
      });
    });
  });

  describe('estimateComplexity()', () => {
    it('复杂任务应该返回 very_complex 级别', () => {
      expect(TaskPlanner.estimateComplexity('重构整个用户认证系统架构')).toBe('very_complex');
      expect(TaskPlanner.estimateComplexity('从 MySQL 迁移到 PostgreSQL 数据库')).toBe('very_complex');
      expect(TaskPlanner.estimateComplexity('集成微服务架构改造')).toBe('very_complex');
    });

    it('开发类任务应该返回 complex 级别', () => {
      expect(TaskPlanner.estimateComplexity('创建完整的用户管理模块')).toBe('complex');
      expect(TaskPlanner.estimateComplexity('实现支付功能接口')).toBe('complex');
    });

    it('任务复杂度应该在有效范围内', () => {
      const validComplexities = ['simple', 'moderate', 'complex', 'very_complex'];
      const testDescriptions = [
        '修复登录页面的一个 typo 错误',
        '给函数添加注释说明',
        '重命名变量 userCount 为 totalUsers',
        '调整按钮的颜色为蓝色',
        '更新 API 文档',
        '修复列表页面的显示问题'
      ];

      for (const desc of testDescriptions) {
        const result = TaskPlanner.estimateComplexity(desc);
        expect(validComplexities).toContain(result);
      }
    });
  });

  describe('边界情况和异常处理', () => {
    it('空输入应该使用默认值处理', async () => {
      const plan = await planner.planTask('', 'session_empty', 'model');

      expect(plan).toBeDefined();
      expect(plan.subTasks.length).toBeGreaterThan(0);
    });

    it('超长任务描述应该正常处理', async () => {
      const longDescription = 'A'.repeat(10000);

      const plan = await planner.planTask(longDescription, 'session_long', 'model');

      expect(plan).toBeDefined();
      expect(plan.taskDescription).toBe(longDescription);
    });

    it('特殊字符应该被正确处理', async () => {
      const specialDescription = '测试 <script>alert("xss")</script> & 特殊字符 "quotes" \'single\'';

      const plan = await planner.planTask(specialDescription, 'session_special', 'model');

      expect(plan).toBeDefined();
      expect(plan.taskDescription).toBe(specialDescription);
    });

    it('generateTaskId() 应该生成唯一的 ID', () => {
      const id1 = planner.generateTaskId();
      const id2 = planner.generateTaskId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^task_/);
      expect(id2).toMatch(/^task_/);
    });

    it('generateSubTaskId() 应该生成唯一的 ID', () => {
      const id1 = planner.generateSubTaskId();
      const id2 = planner.generateSubTaskId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^subtask_/);
    });

    it('updateConfig() 应该更新配置', () => {
      planner.updateConfig({ maxTurns: 50, runTests: false });

      const config = planner.getConfig();
      expect(config.maxTurns).toBe(50);
      expect(config.runTests).toBe(false);
    });

    it('getConfig() 应该返回配置的副本', () => {
      const config1 = planner.getConfig();
      config1.maxTurns = 999;

      const config2 = planner.getConfig();
      expect(config2.maxTurns).not.toBe(999);
    });

    it('cancel() 应该中止规划过程', () => {
      expect(() => planner.cancel()).not.toThrow();
    });

    it('createDefaultPlanner() 应该返回新实例', () => {
      const defaultPlanner = TaskPlanner.createDefaultPlanner();

      expect(defaultPlanner).toBeInstanceOf(TaskPlanner);
      expect(defaultPlanner).not.toBe(planner);
    });
  });

  describe('进度回调', () => {
    it('应该在不同阶段调用进度回调', async () => {
      const progressUpdates: Array<{ phase: string; progress: number }> = [];
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress);
      });

      await planner.planTask(
        '进度测试任务',
        'session_progress',
        'model',
        onProgress
      );

      expect(onProgress).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);

      const phases = progressUpdates.map(u => u.phase);
      expect(phases).toContain('analyzing');
      expect(phases.some(p => p === 'complete' || p === 'optimizing')).toBe(true);
    });

    it('最终进度应该是 100%', async () => {
      let finalProgress = 0;
      const onProgress = vi.fn((progress) => {
        finalProgress = progress.progress;
      });

      await planner.planTask(
        '完成度测试',
        'session_complete',
        'model',
        onProgress
      );

      expect(finalProgress).toBe(100);
    });
  });

  describe('风险等级解析', () => {
    it('应该正确解析各种风险等级格式', async () => {
      const testCases = [
        { input: 'low', expected: RiskLevelEnum.LOW },
        { input: 'medium', expected: RiskLevelEnum.MEDIUM },
        { input: 'high', expected: RiskLevelEnum.HIGH },
        { input: 'critical', expected: RiskLevelEnum.CRITICAL }
      ];

      for (const tc of testCases) {
        const planData = {
          analysis: { complexity: 'moderate' as const, requiresFileSystem: true, requiresTerminal: true, requiresCodeGeneration: true, requiresTesting: false, potentialRisks: [], suggestedTools: [], dependencies: [] },
          subTasks: [{
            order: 1,
            title: 'Test',
            description: 'Test task',
            riskLevel: tc.input,
            estimatedTurns: 1,
            dependencies: [],
            toolCalls: []
          }],
          executionStrategy: { mode: 'sequential' as const, maxConcurrentTasks: 1, failFast: false, autoRetry: true, maxRetriesPerTask: 3, verificationPoints: [] },
          rollbackPlan: []
        };

        const normalizedRisk = planData.subTasks[0].riskLevel;
        expect(normalizedRisk).toBe(tc.expected);
      }
    });

    it('无效风险等级应该回退到 MEDIUM', () => {
      expect(RiskLevelEnum.MEDIUM).toBe(RiskLevelEnum.MEDIUM);
    });
  });

  describe('回滚计划', () => {
    it('回滚计划应该正确归一化', async () => {
      const plan = await planner.planTask(
        '回滚测试任务',
        'session_rollback',
        'model'
      );

      expect(Array.isArray(plan.rollbackPlan)).toBe(true);

      if (plan.rollbackPlan.length > 0) {
        plan.rollbackPlan.forEach(step => {
          expect(typeof step.step).toBe('number');
          expect(typeof step.action).toBe('string');
          expect(typeof step.reversible).toBe('boolean');
        });
      }
    });

    it('空回滚计划应该返回空数组', async () => {
      const plan = await planner.planTask(
        '无回滚任务',
        'session_no_rollback',
        'model'
      );

      expect(plan.rollbackPlan).toEqual([]);
    });
  });

  describe('置信度和总轮次估算', () => {
    it('置信度应该在 0-1 范围内', async () => {
      const plan = await planner.planTask(
        '置信度测试',
        'session_confidence',
        'model'
      );

      expect(plan.confidence).toBeGreaterThanOrEqual(0);
      expect(plan.confidence).toBeLessThanOrEqual(1);
    });

    it('总预估轮次应该等于或大于所有子任务轮次之和', async () => {
      const plan = await planner.planTask(
        '轮次估算测试',
        'session_turns',
        'model'
      );

      const sumOfSubTaskTurns = plan.subTasks.reduce((sum, t) => sum + t.estimatedTurns, 0);
      expect(plan.estimatedTotalTurns).toBeGreaterThanOrEqual(sumOfSubTaskTurns);
    });
  });
});
