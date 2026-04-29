// src/tools/registry.ts
// Concrete Registry — owns tool registration and dispatches calls.

import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "../schema/index.js";
import type { ExecuteOptions, Registry } from "./index.js";

// A registered tool: schema + handler. Handlers raw-throw on failure;
// the registry catches and converts to ToolResult{ is_error: true }.
export interface Tool {
  definition: ToolDefinition;
  execute(args: unknown, options?: ExecuteOptions): Promise<string>;
}

export class ToolRegistry implements Registry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values(), (t) => t.definition);
  }

  async execute(call: ToolCall, options?: ExecuteOptions): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        tool_call_id: call.id,
        output: `Unknown tool: ${call.name}`,
        is_error: true,
      };
    }

    try {
      const args = parseArguments(call.arguments);
      const output = await tool.execute(args, options);
      return { tool_call_id: call.id, output, is_error: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        tool_call_id: call.id,
        output: `工具执行失败: ${message}`,
        is_error: true,
      };
    }
  }
}

function parseArguments(raw: unknown): unknown {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
