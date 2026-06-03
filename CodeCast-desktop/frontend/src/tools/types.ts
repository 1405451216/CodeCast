// 工具类型 - 已迁移到 AP Tool（cast_tools_*）
export interface CastTool {
  name: string;
  description: string;
  category: string;
}
export interface AgentTool extends CastTool {
  parameters: Record<string, any>;
}
