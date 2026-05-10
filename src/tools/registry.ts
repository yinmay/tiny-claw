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
    const name = tool.name();
    if (this.tools.has(name)) {
      console.warn(`[Warning] tool '${name}' already registered — overwriting.`);
    }
    this.tools.set(name, tool);
    console.log(`[Registry] mounted tool: ${name}`);
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values(), (t) => t.definition());
  }

  async execute(call: ToolCall, options?: ExecuteOptions): Promise<ToolResult> {
    // 1. Routing: a missing tool means the model hallucinated — surface it back.
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        tool_call_id: call.id,
        output: `Error: no tool named '${call.name}' is registered.`,
        is_error: true,
      };
    }

    // 2. Execute: hand the raw JSON byte stream straight to the concrete tool.
    try {
      const output = await tool.execute(serializeArgs(call.arguments), options);
      // 3. Wrap success.
      return { tool_call_id: call.id, output, is_error: false };
    } catch (err) {
      // 3. Wrap physical failure so the model can attempt to self-correct.
      const message = err instanceof Error ? err.message : String(err);
      return {
        tool_call_id: call.id,
        output: `Error executing ${call.name}: ${message}`,
        is_error: true,
      };
    }
  }
}

// Factory mirroring Go's NewRegistry().
export function newRegistry(): ToolRegistry {
  return new ToolRegistry();
}

function serializeArgs(raw: unknown): string {
  if (raw == null) return "{}";
  if (typeof raw === "string") return raw || "{}";
  return JSON.stringify(raw);
}
