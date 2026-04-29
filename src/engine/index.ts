// src/engine/index.ts
// AgentEngine — the core driver of the tiny OS: a standard ReAct loop.

import type { LLMProvider } from "../provider/index.js";
import type { Message } from "../schema/index.js";
import type { Registry } from "../tools/index.js";

export interface AgentEngineConfig {
  provider: LLMProvider;
  registry: Registry;
  // Workspace: borrowed from OpenClaw — the agent must have a clear physical boundary.
  workDir: string;
  // Slow-thinking mode toggle.
  enableThinking?: boolean;
}

export interface RunOptions {
  signal?: AbortSignal;
}

export class AgentEngine {
  private readonly provider: LLMProvider;
  private readonly registry: Registry;
  readonly workDir: string;

  constructor(config: AgentEngineConfig) {
    this.provider = config.provider;
    this.registry = config.registry;
    this.workDir = config.workDir;
  }

  // Run drives the agent's lifecycle until the model stops requesting tools.
  async run(userPrompt: string, options: RunOptions = {}): Promise<void> {
    const { signal } = options;
    console.log(`[Engine] Starting, workspace locked to: ${this.workDir}`);

    // 1. Seed the session context.
    // In production this would be assembled by a dynamic prompt builder
    // loading AGENTS.md; hardcoded for now.
    const contextHistory: Message[] = [
      {
        role: "system",
        content:
          "You are tiny-claw, an expert coding assistant. You have full access to tools in the workspace.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    let turnCount = 0;

    // 2. The Main Loop — heartbeat (standard ReAct cycle).
    while (true) {
      turnCount++;
      console.log(`========== [Turn ${turnCount}] start ==========`);

      const availableTools = this.registry.getAvailableTools();

      // Reasoning step.
      console.log("[Engine] Thinking (Reasoning)...");
      let responseMsg: Message;
      try {
        responseMsg = await this.provider.generate(
          contextHistory,
          availableTools,
          { signal },
        );
      } catch (err) {
        throw new Error(`model generation failed: ${(err as Error).message}`, {
          cause: err,
        });
      }

      // Append the model's full response to history.
      contextHistory.push(responseMsg);

      // Plain-text content (reasoning or final answer).
      if (responseMsg.content !== "") {
        console.log(`🤖 Model: ${responseMsg.content}`);
      }

      // 3. Exit condition: no tool calls => task complete.
      const toolCalls = responseMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        console.log("[Engine] Task complete, exiting loop.");
        break;
      }

      // 4. Action + Observation.
      console.log(`[Engine] Model requested ${toolCalls.length} tool call(s)...`);

      for (const toolCall of toolCalls) {
        console.log(
          `  -> 🛠️  Executing tool: ${toolCall.name}, args: ${JSON.stringify(toolCall.arguments)}`,
        );

        const result = await this.registry.execute(toolCall, { signal });

        if (result.is_error) {
          console.log(`  -> ❌ Tool error: ${result.output}`);
        } else {
          console.log(
            `  -> ✅ Tool ok (${result.output.length} bytes returned)`,
          );
        }

        // Wrap the observation as a user message so the model can correlate
        // it with its tool call. tool_call_id is mandatory for that linkage.
        contextHistory.push({
          role: "user",
          content: result.output,
          tool_call_id: toolCall.id,
        });
      }

      // Loop back: the model continues reasoning with the new observation.
    }
  }
}
