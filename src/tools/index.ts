// src/tools/index.ts
// Tool registry — registration and dispatch of tool executions.

import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "../schema/index.js";

export interface ExecuteOptions {
  signal?: AbortSignal;
}

export interface Registry {
  // Schemas for every tool currently mounted in the system.
  getAvailableTools(): ToolDefinition[];

  // Execute the tool call requested by the model and return its result.
  execute(call: ToolCall, options?: ExecuteOptions): Promise<ToolResult>;
}
