import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ToolRegistryInstance from '../ToolRegistry';
import { ToolRegistry } from '../ToolRegistry';
import {
  ToolCategory,
  ToolPermission,
  type AgentTool,
  type ToolContext,
  type ToolResult
} from '../types';

const createMockTool = (overrides: Partial<AgentTool> = {}): AgentTool => ({
  id: 'test_tool',
  name: 'Test Tool',
  description: 'A test tool for unit testing',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'File path to operate on',
      required: true
    }
  ],
  permission: ToolPermission.READ,
  requiresPermission: false,
  execute: vi.fn().mockResolvedValue({ success: true, data: 'test result' }),
  ...overrides
});

const createMockContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  ui: {
    showMessage: vi.fn(),
    showConfirmation: vi.fn().mockResolvedValue(true),
    askUser: vi.fn().mockResolvedValue('')
  },
  ...overrides
});

describe('ToolRegistry', () => {
  const registeredToolIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const id of registeredToolIds) {
      try { ToolRegistryInstance.unregister(id); } catch {}
    }
    registeredToolIds.length = 0;
    ToolRegistryInstance.clearExecutionLogs();
  });

  const registerAndTrack = (tool: AgentTool) => {
    ToolRegistryInstance.register(tool);
    registeredToolIds.push(tool.id);
  };

  describe('register()', () => {
    it('应该成功注册一个有效工具', () => {
      const tool = createMockTool({ id: 'read_file' });
      registerAndTrack(tool);

      expect(ToolRegistryInstance.hasTool('read_file')).toBe(true);
      expect(ToolRegistryInstance.getToolCount()).toBeGreaterThanOrEqual(1);
    });

    it('应该允许覆盖已存在的工具（带警告）', () => {
      const tool1 = createMockTool({ id: 'duplicate_tool' });
      const tool2 = createMockTool({
        id: 'duplicate_tool',
        name: 'Updated Tool'
      });

      registerAndTrack(tool1);
      expect(() => registerAndTrack(tool2)).not.toThrow();

      const retrieved = ToolRegistryInstance.get('duplicate_tool');
      expect(retrieved?.name).toBe('Updated Tool');
    });

    it('应该拒绝没有 id 的无效工具', () => {
      const invalidTool = createMockTool({ id: '' as any });

      expect(() => ToolRegistryInstance.register(invalidTool)).toThrow('Tool must have a valid string id');
    });

    it('应该拒绝没有 name 的无效工具', () => {
      const invalidTool = createMockTool({ name: '' as any });

      expect(() => ToolRegistryInstance.register(invalidTool)).toThrow('Tool must have a valid string name');
    });

    it('应该拒绝没有 description 的无效工具', () => {
      const invalidTool = createMockTool({ description: '' as any });

      expect(() => ToolRegistryInstance.register(invalidTool)).toThrow('Tool must have a valid string description');
    });

    it('应该拒绝参数为非数组的工具', () => {
      const invalidTool = createMockTool({ parameters: null as any });

      expect(() => ToolRegistryInstance.register(invalidTool)).toThrow('Tool must have a parameters array');
    });

    it('应该拒绝没有 execute 函数的工具', () => {
      const invalidTool = createMockTool({ execute: undefined as any });

      expect(() => ToolRegistryInstance.register(invalidTool)).toThrow('Tool must have an execute function');
    });

    it('应该拒绝参数类型无效的工具', () => {
      const toolWithInvalidParam = createMockTool({
        parameters: [{
          name: 'invalid_param',
          type: 'invalid_type' as any,
          description: 'Test param'
        }]
      });

      expect(() => registerAndTrack(toolWithInvalidParam)).toThrow('has invalid type');
    });
  });

  describe('unregister()', () => {
    it('应该成功注销已存在的工具', () => {
      const tool = createMockTool({ id: 'tool_to_remove' });
      registerAndTrack(tool);

      const result = ToolRegistryInstance.unregister('tool_to_remove');

      expect(result).toBe(true);
      expect(ToolRegistryInstance.hasTool('tool_to_remove')).toBe(false);
    });

    it('注销不存在的工具应返回 false', () => {
      const result = ToolRegistryInstance.unregister('nonexistent_tool');

      expect(result).toBe(false);
    });

    it('注销后应该不影响其他工具', () => {
      registerAndTrack(createMockTool({ id: 'tool_a' }));
      registerAndTrack(createMockTool({ id: 'tool_b' }));
      registerAndTrack(createMockTool({ id: 'tool_c' }));

      ToolRegistryInstance.unregister('tool_b');

      expect(ToolRegistryInstance.hasTool('tool_a')).toBe(true);
      expect(ToolRegistryInstance.hasTool('tool_b')).toBe(false);
      expect(ToolRegistryInstance.hasTool('tool_c')).toBe(true);
    });
  });

  describe('execute()', () => {
    it('正常执行应返回成功结果', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ success: true, data: 'executed' });
      const tool = createMockTool({ execute: mockExecute });
      registerAndTrack(tool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { path: '/test/file.txt' }, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('executed');
      expect(mockExecute).toHaveBeenCalledWith(
        { path: '/test/file.txt' },
        context
      );
    });

    it('执行不存在的工具应返回错误结果', async () => {
      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('nonexistent', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in registry');
    });

    it('缺少必需参数时应返回验证错误', async () => {
      const tool = createMockTool({
        parameters: [
          { name: 'path', type: 'string', description: 'File path', required: true },
          { name: 'content', type: 'string', description: 'Content to write', required: true }
        ]
      });
      registerAndTrack(tool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { path: '/test.txt' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    it('参数类型错误时应返回验证错误', async () => {
      const tool = createMockTool({
        parameters: [
          { name: 'count', type: 'number', description: 'Count value', required: true }
        ],
        execute: vi.fn()
      });
      registerAndTrack(tool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { count: 'not-a-number' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid type for parameter');
    });

    it('枚举值不在允许列表中时应返回错误', async () => {
      const tool = createMockTool({
        parameters: [
          {
            name: 'format',
            type: 'string',
            description: 'Output format',
            required: true,
            enum: ['json', 'xml', 'yaml']
          }
        ],
        execute: vi.fn()
      });
      registerAndTrack(tool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { format: 'csv' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Must be one of');
    });

    it('权限不足且用户拒绝时应返回权限错误', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const tool = createMockTool({
        requiresPermission: true,
        execute: vi.fn()
      });
      registerAndTrack(tool);

      const context = createMockContext({
        ui: { ...createMockContext().ui!, showConfirmation: mockConfirm }
      });

      const result = await ToolRegistryInstance.execute('test_tool', { path: '/test' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User denied');
      expect(mockConfirm).toHaveBeenCalled();
    });

    it('执行抛出异常时应返回错误结果', async () => {
      const errorTool = createMockTool({
        execute: vi.fn().mockRejectedValue(new Error('Execution failed'))
      });
      registerAndTrack(errorTool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { path: '/test' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });

    it('废弃工具执行时应该记录警告', async () => {
      const deprecatedTool = createMockTool({
        deprecated: true,
        deprecationMessage: 'This tool is deprecated, use new_tool instead'
      });
      registerAndTrack(deprecatedTool);

      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const context = createMockContext({ logger });

      await ToolRegistryInstance.execute('test_tool', { path: '/test' }, context);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('执行时间应该被记录到结果中', async () => {
      const tool = createMockTool();
      registerAndTrack(tool);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('test_tool', { path: '/test' }, context);

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getToolsSchemaForLLM()', () => {
    it('应该返回符合 OpenAI Function Calling 规范的格式', () => {
      registerAndTrack(createMockTool({ id: 'tool_1', name: 'Tool One', description: 'First tool' }));
      registerAndTrack(createMockTool({ id: 'tool_2', name: 'Tool Two', description: 'Second tool' }));

      const schemas = ToolRegistryInstance.getToolsSchemaForLLM();

      expect(schemas.length).toBeGreaterThanOrEqual(2);
      expect(schemas[0]).toEqual({
        type: 'function',
        function: {
          name: 'tool_1',
          description: 'First tool',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to operate on'
              }
            },
            required: ['path']
          }
        }
      });
    });

    it('不应该包含已废弃的工具', () => {
      registerAndTrack(createMockTool({ id: 'active_tool' }));
      registerAndTrack(createMockTool({
        id: 'deprecated_tool',
        deprecated: true
      }));

      const schemas = ToolRegistryInstance.getToolsSchemaForLLM();

      const activeSchema = schemas.find(s => s.function.name === 'active_tool');
      const deprecatedSchema = schemas.find(s => s.function.name === 'deprecated_tool');

      expect(activeSchema).toBeDefined();
      expect(deprecatedSchema).toBeUndefined();
    });

    it('必需参数应该正确列在 required 数组中', () => {
      registerAndTrack(createMockTool({
        parameters: [
          { name: 'required_param', type: 'string', description: 'Required', required: true },
          { name: 'optional_param', type: 'string', description: 'Optional', required: false }
        ]
      }));

      const schemas = ToolRegistryInstance.getToolsSchemaForLLM();

      expect(schemas[0].function.parameters.required).toEqual(['required_param']);
    });

    it('枚举类型参数应该包含 enum 字段', () => {
      registerAndTrack(createMockTool({
        parameters: [
          {
            name: 'mode',
            type: 'string',
            description: 'Operation mode',
            enum: ['read', 'write', 'append']
          }
        ]
      }));

      const schemas = ToolRegistryInstance.getToolsSchemaForLLM();

      expect(schemas[0].function.parameters.properties.mode.enum).toEqual(['read', 'write', 'append']);
    });
  });

  describe('getStatistics()', () => {
    it('应该返回正确的统计信息', () => {
      registerAndTrack(createMockTool({ id: 'file_tool', category: ToolCategory.FILE, permission: ToolPermission.READ }));
      registerAndTrack(createMockTool({ id: 'terminal_tool', category: ToolCategory.TERMINAL, permission: ToolPermission.EXECUTE }));
      registerAndTrack(createMockTool({ id: 'git_tool', category: ToolCategory.GIT, permission: ToolPermission.WRITE }));

      const stats = ToolRegistryInstance.getStatistics();

      expect(stats.totalTools).toBeGreaterThanOrEqual(3);
      expect(stats.byCategory[ToolCategory.FILE]).toBe(1);
      expect(stats.byCategory[ToolCategory.TERMINAL]).toBe(1);
      expect(stats.byCategory[ToolCategory.GIT]).toBe(1);
      expect(stats.byPermission[ToolPermission.READ]).toBe(1);
      expect(stats.byPermission[ToolPermission.EXECUTE]).toBe(1);
      expect(stats.byPermission[ToolPermission.WRITE]).toBe(1);
    });

    it('应该正确统计需要权限的工具数量', () => {
      registerAndTrack(createMockTool({ id: 'no_perm', requiresPermission: false }));
      registerAndTrack(createMockTool({ id: 'with_perm', requiresPermission: true }));
      registerAndTrack(createMockTool({ id: 'also_with_perm', requiresPermission: true }));

      const stats = ToolRegistryInstance.getStatistics();

      expect(stats.requiresPermissionCount).toBe(2);
    });

    it('应该正确统计已废弃工具的数量', () => {
      registerAndTrack(createMockTool({ id: 'active' }));
      registerAndTrack(createMockTool({ id: 'dep_1', deprecated: true }));
      registerAndTrack(createMockTool({ id: 'dep_2', deprecated: true }));
      registerAndTrack(createMockTool({ id: 'dep_3', deprecated: true }));

      const stats = ToolRegistryInstance.getStatistics();

      expect(stats.deprecatedCount).toBe(3);
      expect(stats.totalTools).toBeGreaterThanOrEqual(4);
    });
  });

  describe('高危工具确认机制', () => {
    it('高危工具在无自定义检查器时应调用 UI 确认', async () => {
      const dangerousTool = createMockTool({
        id: 'delete_file_test',
        name: 'Delete File',
        description: 'Deletes a file permanently',
        category: ToolCategory.FILE,
        permission: ToolPermission.DANGEROUS,
        requiresPermission: true
      });
      registerAndTrack(dangerousTool);

      const showConfirmation = vi.fn().mockResolvedValue(true);
      const context = createMockContext({
        ui: { ...createMockContext().ui!, showConfirmation }
      });

      await ToolRegistryInstance.execute('delete_file_test', { path: '/important/file.txt' }, context);

      expect(showConfirmation).toHaveBeenCalledWith(
        expect.stringContaining('Delete File'),
        expect.objectContaining({ title: '权限确认' })
      );
    });

    it('使用自定义权限检查器时应优先使用检查器', async () => {
      const customChecker = vi.fn().mockResolvedValue(true);
      const dangerousTool = createMockTool({
        id: 'risky_operation_test',
        requiresPermission: true
      });
      registerAndTrack(dangerousTool);
      ToolRegistryInstance.registerPermissionChecker('risky_operation_test', customChecker);

      const context = createMockContext();
      await ToolRegistryInstance.execute('risky_operation_test', { path: '/test' }, context);

      expect(customChecker).toHaveBeenCalledWith('risky_operation_test', { path: '/test' });

      ToolRegistryInstance.unregisterPermissionChecker('risky_operation_test');
    });

    it('自定义权限检查器拒绝时应返回权限错误', async () => {
      const denyChecker = vi.fn().mockResolvedValue(false);
      const protectedTool = createMockTool({
        id: 'protected_op_test',
        requiresPermission: true
      });
      registerAndTrack(protectedTool);
      ToolRegistryInstance.registerPermissionChecker('protected_op_test', denyChecker);

      const context = createMockContext();
      const result = await ToolRegistryInstance.execute('protected_op_test', { path: '/secret' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');

      ToolRegistryInstance.unregisterPermissionChecker('protected_op_test');
    });
  });

  describe('辅助方法', () => {
    it('getAllTools() 应该返回所有已注册工具', () => {
      registerAndTrack(createMockTool({ id: 'a' }));
      registerAndTrack(createMockTool({ id: 'b' }));
      registerAndTrack(createMockTool({ id: 'c' }));

      const allTools = ToolRegistryInstance.getAllTools();
      expect(allTools.length).toBeGreaterThanOrEqual(3);
    });

    it('getToolsByCategory() 应该按类别过滤工具', () => {
      registerAndTrack(createMockTool({ id: 'file_1', category: ToolCategory.FILE }));
      registerAndTrack(createMockTool({ id: 'file_2', category: ToolCategory.FILE }));
      registerAndTrack(createMockTool({ id: 'term_1', category: ToolCategory.TERMINAL }));

      const fileTools = ToolRegistryInstance.getToolsByCategory(ToolCategory.FILE);
      expect(fileTools).toHaveLength(2);
    });

    it('clearAll() 应该清除所有数据', () => {
      registerAndTrack(createMockTool({ id: 'x_clear' }));
      ToolRegistryInstance.registerPermissionChecker('x_clear', vi.fn());

      ToolRegistryInstance.clearAll();
      registeredToolIds.length = 0;

      expect(ToolRegistryInstance.getAllTools()).toHaveLength(0);
    });

    it('getExecutionLogs() 应该记录每次执行', async () => {
      const tool = createMockTool();
      registerAndTrack(tool);

      const context = createMockContext();
      await ToolRegistryInstance.execute('test_tool', { path: '/a' }, context);
      await ToolRegistryInstance.execute('test_tool', { path: '/b' }, context);

      const logs = ToolRegistryInstance.getExecutionLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs[logs.length - 2].success).toBe(true);
    });

    it('getExecutionLogs(limit) 应该限制返回数量', async () => {
      const tool = createMockTool();
      registerAndTrack(tool);
      const context = createMockContext();

      for (let i = 0; i < 5; i++) {
        await ToolRegistryInstance.execute('test_tool', { path: `/file${i}` }, context);
      }

      const limitedLogs = ToolRegistryInstance.getExecutionLogs(3);
      expect(limitedLogs.length).toBeLessThanOrEqual(3);
    });

    it('clearExecutionLogs() 应该清除所有日志', async () => {
      const tool = createMockTool();
      registerAndTrack(tool);
      const context = createMockContext();

      await ToolRegistryInstance.execute('test_tool', { path: '/test' }, context);
      expect(ToolRegistryInstance.getExecutionLogs().length).toBeGreaterThan(0);

      ToolRegistryInstance.clearExecutionLogs();
      expect(ToolRegistryInstance.getExecutionLogs()).toHaveLength(0);
    });
  });
});
