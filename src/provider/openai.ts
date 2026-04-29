// OpenAI SDK provider implementation, pointed at Zhipu's OpenAI-compatible endpoint.

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { Message, ToolCall, ToolDefinition } from "../schema/index.js";
import type { GenerateOptions, LLMProvider } from "./index.js";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model: string, apiKey: string, baseURL = ZHIPU_BASE_URL) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  static fromZhipuEnv(model: string): OpenAIProvider {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      throw new Error("ZHIPU_API_KEY environment variable is required");
    }
    return new OpenAIProvider(model, apiKey);
  }

  async generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    options?: GenerateOptions,
  ): Promise<Message> {
    const openaiMessages = messages.map(toOpenAIMessage);
    const tools = availableTools.map(toOpenAITool);

    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: openaiMessages,
        ...(tools.length > 0 ? { tools } : {}),
      },
      { signal: options?.signal },
    );

    const choice = completion.choices[0];
    if (!choice) {
      throw new Error("API 返回了空的 Choices");
    }

    const result: Message = {
      role: "assistant",
      content: choice.message.content ?? "",
    };

    const toolCalls = choice.message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      result.tool_calls = toolCalls.flatMap(fromOpenAIToolCall);
    }

    return result;
  }
}

function toOpenAIMessage(msg: Message): ChatCompletionMessageParam {
  switch (msg.role) {
    case "system":
      return { role: "system", content: msg.content };

    case "user":
      // 工具结果：作为 role=tool 回填，承接上一轮 tool_call。
      if (msg.tool_call_id) {
        return {
          role: "tool",
          tool_call_id: msg.tool_call_id,
          content: msg.content,
        };
      }
      return { role: "user", content: msg.content };

    case "assistant": {
      const param: ChatCompletionMessageParam = {
        role: "assistant",
        content: msg.content || null,
      };
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        param.tool_calls = msg.tool_calls.map(toOpenAIToolCall);
      }
      return param;
    }
  }
}

function toOpenAIToolCall(tc: ToolCall): ChatCompletionMessageToolCall {
  return {
    id: tc.id,
    type: "function",
    function: {
      name: tc.name,
      arguments: typeof tc.arguments === "string"
        ? tc.arguments
        : JSON.stringify(tc.arguments ?? {}),
    },
  };
}

function fromOpenAIToolCall(tc: ChatCompletionMessageToolCall): ToolCall[] {
  if (tc.type !== "function") return [];
  return [{
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }];
}

function toOpenAITool(def: ToolDefinition): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: def.name,
      description: def.description,
      parameters: (def.input_schema ?? {}) as Record<string, unknown>,
    },
  };
}
