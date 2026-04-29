// Anthropic SDK provider implementation, pointed at Zhipu's Anthropic-compatible endpoint.

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
  Tool,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/messages/messages";

import type { Message, ToolDefinition } from "../schema/index.js";
import type { GenerateOptions, LLMProvider } from "./index.js";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    model: string,
    apiKey: string,
    baseURL = ZHIPU_BASE_URL,
    maxTokens = DEFAULT_MAX_TOKENS,
  ) {
    this.client = new Anthropic({ apiKey, baseURL });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  static fromZhipuEnv(model: string): AnthropicProvider {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      throw new Error("ZHIPU_API_KEY environment variable is required");
    }
    return new AnthropicProvider(model, apiKey);
  }

  async generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<Message> {
    const { systemPrompt, anthropicMsgs } = translateMessages(messages);
    const tools = availableTools.map(toAnthropicTool);

    const resp = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: anthropicMsgs,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        ...(tools.length > 0 ? { tools } : {}),
      },
      { signal: options?.signal },
    );

    const result: Message = { role: "assistant", content: "" };

    for (const block of resp.content) {
      if (block.type === "text") {
        result.content += block.text;
      } else if (block.type === "tool_use") {
        result.tool_calls = result.tool_calls ?? [];
        result.tool_calls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        });
      }
    }

    return result;
  }
}

function translateMessages(messages: Message[]): {
  systemPrompt: string;
  anthropicMsgs: MessageParam[];
} {
  let systemPrompt = "";
  const anthropicMsgs: MessageParam[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        systemPrompt = msg.content;
        break;

      case "user":
        if (msg.tool_call_id) {
          // Tool result: surface as a tool_result block inside a user message.
          anthropicMsgs.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: msg.tool_call_id,
              content: msg.content,
              is_error: false,
            }],
          });
        } else {
          anthropicMsgs.push({
            role: "user",
            content: [{ type: "text", text: msg.content }],
          });
        }
        break;

      case "assistant": {
        const blocks: ContentBlockParam[] = [];
        if (msg.content) {
          blocks.push({ type: "text", text: msg.content });
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            blocks.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: parseToolArguments(tc.arguments),
            });
          }
        }
        if (blocks.length > 0) {
          anthropicMsgs.push({ role: "assistant", content: blocks });
        }
        break;
      }
    }
  }

  return { systemPrompt, anthropicMsgs };
}

function parseToolArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (typeof args === "string") {
    if (!args) return {};
    try {
      const parsed = JSON.parse(args);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof args === "object") return args as Record<string, unknown>;
  return {};
}

function toAnthropicTool(def: ToolDefinition): ToolUnion {
  // ToolInputSchema requires type === "object"; extract properties / required from input_schema.
  const schema = (def.input_schema ?? {}) as Record<string, unknown>;
  const properties = (schema.properties as Record<string, unknown> | undefined) ?? {};
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : undefined;

  const tool: Tool = {
    name: def.name,
    description: def.description,
    input_schema: {
      type: "object",
      properties,
      ...(required ? { required } : {}),
    },
  };
  return tool;
}
