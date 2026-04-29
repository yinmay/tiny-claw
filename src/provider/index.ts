// src/provider/index.ts
// Unified contract for talking to an LLM.

import type { Message, ToolDefinition } from "../schema/index.js";

export interface GenerateOptions {
  signal?: AbortSignal;
}

export interface LLMProvider {
  // Run one inference pass given the current message history and available tools.
  // Returns the assistant's next message (which may include tool_calls).
  generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<Message>;
}
