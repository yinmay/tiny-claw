// src/tools/registry.ts
// Concrete Registry — owns tool registration and dispatches calls.

import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "../schema/index.js";
import type { ExecuteOptions, Registry } from "./index.js";

// BaseTool — the interface every concrete tool must implement.
// Mirrors the Go BaseTool: name(), definition(), execute(rawArgs).
// Tools receive the raw JSON string emitted by the model and own their own
// parsing/validation, so the registry stays unaware of per-tool argument shapes.
export interface BaseTool {
  // Globally unique tool name — the model invokes the tool by this string.
  name(): string;

  // Metadata + JSON Schema submitted to the model.
  definition(): ToolDefinition;

  // Run the tool against raw JSON arguments. Throw on failure;
  // the registry catches and converts to ToolResult{ is_error: true }.
  execute(rawArgs: string, options?: ExecuteOptions): Promise<string>;
}

export class ToolRegistry implements Registry {
  private readonly tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    this.tools.set(tool.name(), tool);
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values(), (t) => t.definition());
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
      const output = await tool.execute(serializeArgs(call.arguments), options);
      return { tool_call_id: call.id, output, is_error: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        tool_call_id: call.id,
        output: `Tool execution failed: ${message}`,
        is_error: true,
      };
    }
  }
}

function serializeArgs(raw: unknown): string {
  if (raw == null) return "{}";
  if (typeof raw === "string") return raw || "{}";
  return JSON.stringify(raw);
}
