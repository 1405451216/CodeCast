import type { ToolDefinition } from '@agentprimordia/sdk';

// 工具类型 - 现在从 @agentprimordia/sdk 导入
export type { ToolDefinition, ToolCallRequest, ToolCallResponse } from '@agentprimordia/sdk';

// ToolDefinition UI 扩展（添加 category 字段）
export interface CastTool extends ToolDefinition {
  category: string;
}

// 兼容旧引用（已废弃）
export type AgentTool = CastTool;
