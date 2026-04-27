// src/schema/index.ts
// Core message and tool schema — the contract for talking to LLMs.

// Role of a message in the conversation.
export type Role =
  | "system" // System prompt: defines the agent's persona and guardrails.
  | "user" // User input or the result of a tool execution (observation).
  | "assistant"; // Model output: reasoning text and/or tool calls.

// A single message exchanged in the context window.
export interface Message {
  role: Role;
  content: string; // Plain text content.

  // Populated when the model decides to call tools (parallel calls supported).
  tool_calls?: ToolCall[];

  // Set when this message is a response to a specific tool call,
  // so the model can correlate observation with request.
  tool_call_id?: string;
}

// A request from the model to invoke a tool.
export interface ToolCall {
  id: string; // Unique id for this tool call.
  name: string; // Tool name (e.g. "bash").
  // Raw JSON arguments. Kept as `unknown` so individual tools own parsing/validation.
  arguments: unknown;
}

// The physical result of executing a tool locally.
export interface ToolResult {
  tool_call_id: string;
  output: string; // Stdout/stderr or error stack.
  is_error: boolean; // True on failure — enables retry/self-heal logic upstream.
}

// Metadata describing a tool the model is allowed to call.
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: unknown; // JSON Schema describing `arguments`.
}
