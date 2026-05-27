import {
  AgentTool,
  ToolCategory,
  ToolContext,
  ToolExecutionLog,
  ToolPermission,
  ToolResult,
  ToolSchemaForLLM,
  ToolStatistics
} from './types';

class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, AgentTool> = new Map();
  private executionLogs: ToolExecutionLog[] = [];
  private maxLogs: number = 1000;
  private permissionCheckers: Map<string, (toolId: string, params: Record<string, any>) => Promise<boolean>> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] Tool "${tool.id}" is already registered. Overwriting.`);
    }

    this.validateTool(tool);
    this.tools.set(tool.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.id})`);
  }

  unregister(id: string): boolean {
    const removed = this.tools.delete(id);
    if (removed) {
      console.log(`[ToolRegistry] Unregistered tool: ${id}`);
    } else {
      console.warn(`[ToolRegistry] Tool "${id}" not found for unregistration.`);
    }
    return removed;
  }

  get(id: string): AgentTool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: ToolCategory): AgentTool[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  hasTool(id: string): boolean {
    return this.tools.has(id);
  }

  getToolCount(): number {
    return this.tools.size;
  }

  async execute(
    name: string,
    params: Record<string, any>,
    context: ToolContext = {}
  ): Promise<ToolResult> {
    const tool = this.get(name);

    if (!tool) {
      const errorResult: ToolResult = {
        success: false,
        error: `Tool "${name}" not found in registry`
      };
      this.logExecution(name, params, errorResult, 0);
      return errorResult;
    }

    if (tool.deprecated) {
      context.logger?.warn(
        `[ToolRegistry] Tool "${name}" is deprecated: ${tool.deprecationMessage || 'This tool is deprecated'}`
      );
    }

    const validationError = this.validateParams(tool, params);
    if (validationError) {
      const errorResult: ToolResult = {
        success: false,
        error: validationError
      };
      this.logExecution(name, params, errorResult, 0);
      return errorResult;
    }

    if (tool.requiresPermission) {
      const checker = this.permissionCheckers.get(name);
      if (checker) {
        const hasPermission = await checker(name, params);
        if (!hasPermission) {
          const errorResult: ToolResult = {
            success: false,
            error: `Permission denied for tool "${name}". User approval required.`,
            metadata: { requiresPermission: true, toolName: tool.name }
          };
          this.logExecution(name, params, errorResult, 0);
          return errorResult;
        }
      } else if (context.ui?.showConfirmation) {
        const confirmed = await context.ui.showConfirmation(
          `工具 "${tool.name}" 需要您的确认才能执行。\n\n参数: ${JSON.stringify(params, null, 2)}`,
          { title: '权限确认' }
        );

        if (!confirmed) {
          const errorResult: ToolResult = {
            success: false,
            error: `User denied execution of tool "${name}"`,
            metadata: { requiresPermission: true, userDenied: true }
          };
          this.logExecution(name, params, errorResult, 0);
          return errorResult;
        }
      }
    }

    const startTime = Date.now();
    context.logger?.info(`[ToolRegistry] Executing tool: ${name}`, params);

    try {
      const result = await tool.execute(params, context);
      const duration = Date.now() - startTime;

      result.executionTime = duration;

      this.logExecution(name, params, result, duration);

      if (result.success) {
        context.logger?.info(`[ToolRegistry] Tool ${name} executed successfully in ${duration}ms`);
      } else {
        context.logger?.error(`[ToolRegistry] Tool ${name} failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const errorResult: ToolResult = {
        success: false,
        error: `Tool execution failed: ${errorMessage}`,
        metadata: { originalError: errorMessage }
      };

      this.logExecution(name, params, errorResult, duration);
      context.logger?.error(`[ToolRegistry] Tool ${name} threw exception: ${errorMessage}`);

      return errorResult;
    }
  }

  registerPermissionChecker(
    toolId: string,
    checker: (toolId: string, params: Record<string, any>) => Promise<boolean>
  ): void {
    this.permissionCheckers.set(toolId, checker);
  }

  unregisterPermissionChecker(toolId: string): boolean {
    return this.permissionCheckers.delete(toolId);
  }

  getToolsSchemaForLLM(): ToolSchemaForLLM[] {
    return this.getAllTools()
      .filter(tool => !tool.deprecated)
      .map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: 'object' as const,
            properties: this.convertParametersToSchema(tool.parameters),
            required: tool.parameters
              .filter(p => p.required !== false)
              .map(p => p.name)
          }
        }
      }));
  }

  getStatistics(): ToolStatistics {
    const allTools = this.getAllTools();
    const stats: ToolStatistics = {
      totalTools: allTools.length,
      byCategory: {},
      byPermission: {},
      requiresPermissionCount: 0,
      deprecatedCount: 0
    };

    for (const tool of allTools) {
      stats.byCategory[tool.category] = (stats.byCategory[tool.category] || 0) + 1;
      stats.byPermission[tool.permission] = (stats.byPermission[tool.permission] || 0) + 1;

      if (tool.requiresPermission) {
        stats.requiresPermissionCount++;
      }

      if (tool.deprecated) {
        stats.deprecatedCount++;
      }
    }

    return stats;
  }

  getExecutionLogs(limit?: number): ToolExecutionLog[] {
    if (limit) {
      return this.executionLogs.slice(-limit);
    }
    return [...this.executionLogs];
  }

  clearExecutionLogs(): void {
    this.executionLogs = [];
  }

  clearAll(): void {
    this.tools.clear();
    this.permissionCheckers.clear();
    this.clearExecutionLogs();
    console.log('[ToolRegistry] All tools and logs cleared');
  }

  private validateTool(tool: AgentTool): void {
    if (!tool.id || typeof tool.id !== 'string') {
      throw new Error('Tool must have a valid string id');
    }

    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid string name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid string description');
    }

    if (!Array.isArray(tool.parameters)) {
      throw new Error('Tool must have a parameters array');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }

    for (const param of tool.parameters) {
      if (!param.name || typeof param.name !== 'string') {
        throw new Error(`Parameter must have a valid name in tool ${tool.id}`);
      }
      if (!param.type || !['string', 'number', 'boolean', 'array', 'object'].includes(param.type)) {
        throw new Error(`Parameter "${param.name}" has invalid type in tool ${tool.id}`);
      }
    }
  }

  private validateParams(tool: AgentTool, params: Record<string, any>): string | null {
    const requiredParams = tool.parameters.filter(p => p.required !== false);

    for (const param of requiredParams) {
      if (!(param.name in params) || params[param.name] === undefined || params[param.name] === null) {
        return `Missing required parameter: "${param.name}". ${param.description}`;
      }
    }

    for (const [key, value] of Object.entries(params)) {
      const paramDef = tool.parameters.find(p => p.name === key);

      if (!paramDef) {
        console.warn(`[ToolRegistry] Unknown parameter "${key}" passed to tool "${tool.id}"`);
        continue;
      }

      if (paramDef.enum && !paramDef.enum.includes(value)) {
        return `Invalid value for parameter "${key}". Must be one of: ${paramDef.enum.join(', ')}`;
      }

      if (value !== null && value !== undefined) {
        const expectedType = paramDef.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== expectedType) {
          return `Invalid type for parameter "${key}". Expected ${expectedType}, got ${actualType}`;
        }
      }
    }

    return null;
  }

  private convertParametersToSchema(parameters: AgentTool['parameters']): Record<string, any> {
    const schema: Record<string, any> = {};

    for (const param of parameters) {
      const prop: any = {
        type: param.type === 'array' ? 'array' : param.type,
        description: param.description
      };

      if (param.enum) {
        prop.enum = param.enum;
      }

      if (param.default !== undefined) {
        prop.default = param.default;
      }

      if (param.items) {
        prop.items = this.convertParameterToSchemaItem(param.items);
      }

      if (param.properties) {
        prop.properties = {};
        for (const [key, value] of Object.entries(param.properties)) {
          prop.properties[key] = this.convertParameterToSchemaItem(value);
        }
      }

      schema[param.name] = prop;
    }

    return schema;
  }

  private convertParameterToSchemaItem(param: AgentTool['parameters'][0]): any {
    const item: any = {
      type: param.type === 'array' ? 'array' : param.type,
      description: param.description
    };

    if (param.enum) {
      item.enum = param.enum;
    }

    return item;
  }

  private logExecution(
    toolName: string,
    params: Record<string, any>,
    result: ToolResult,
    duration: number
  ): void {
    const log: ToolExecutionLog = {
      toolId: toolName,
      toolName: toolName,
      params,
      result,
      timestamp: Date.now(),
      duration,
      success: result.success
    };

    this.executionLogs.push(log);

    if (this.executionLogs.length > this.maxLogs) {
      this.executionLogs = this.executionLogs.slice(-this.maxLogs / 2);
    }
  }
}

export default ToolRegistry.getInstance();
export { ToolRegistry };
