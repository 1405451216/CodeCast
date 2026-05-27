export type {
  ToolPermission,
  ToolCategory,
  AgentTool,
  ToolResult,
  ToolContext,
  ToolParameter,
  ToolExecutionLog,
  ToolSchemaForLLM,
  ToolStatistics
} from './types';

import toolRegistry, { ToolRegistry } from './ToolRegistry';

import { fileTools } from './builtin/FileTools';
import { terminalTools } from './builtin/TerminalTools';
import { gitTools } from './builtin/GitTools';
import { testTools } from './builtin/TestTools';
import { webTools } from './builtin/WebTools';
import { userInteractionTools } from './builtin/UserInteractionTools';

const allBuiltinTools = [
  ...fileTools,
  ...terminalTools,
  ...gitTools,
  ...testTools,
  ...webTools,
  ...userInteractionTools
];

function registerAllBuiltinTools(): void {
  console.log(`[ToolRegistry] Registering ${allBuiltinTools.length} builtin tools...`);

  for (const tool of allBuiltinTools) {
    toolRegistry.register(tool);
  }

  const stats = toolRegistry.getStatistics();
  console.log(`[ToolRegistry] Registration complete. Total: ${stats.totalTools} tools`);
  console.log('[ToolRegistry] By category:', JSON.stringify(stats.byCategory, null, 2));
}

export {
  toolRegistry as default,
  toolRegistry,
  ToolRegistry,
  registerAllBuiltinTools
};

export { fileTools } from './builtin/FileTools';
export { terminalTools } from './builtin/TerminalTools';
export { gitTools } from './builtin/GitTools';
export { testTools } from './builtin/TestTools';
export { webTools } from './builtin/WebTools';
export { userInteractionTools } from './builtin/UserInteractionTools';
