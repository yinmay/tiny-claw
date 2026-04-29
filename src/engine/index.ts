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
  readonly enableThinking: boolean;

  constructor(config: AgentEngineConfig) {
    this.provider = config.provider;
    this.registry = config.registry;
    this.workDir = config.workDir;
    this.enableThinking = config.enableThinking ?? false;
  }

  // Run drives the agent's lifecycle until the model stops requesting tools.
  async run(userPrompt: string, options: RunOptions = {}): Promise<void> {
    const { signal } = options;
    console.log(`[Engine] Starting, workspace locked to: ${this.workDir}`);
    console.log(`[Engine] Thinking phase enabled: ${this.enableThinking}`);

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

    // 2. The Main Loop — heartbeat (two-phase ReAct cycle).
    while (true) {
      turnCount++;
      console.log(`========== [Turn ${turnCount}] start ==========`);

      const availableTools = this.registry.getAvailableTools();

      // ================================================================
      // Phase 1: Thinking — strip tools, force the model to plan in text.
      // ================================================================
      if (this.enableThinking) {
        console.log(
          "[Engine][Phase 1] Tools withheld — entering slow thinking / planning phase...",
        );

        // Key trick: pass an empty tool list. With no JSON schemas visible,
        // the model is forced to emit a plain-text plan.
        let thinkResp: Message;
        try {
          thinkResp = await this.provider.generate(contextHistory, [], {
            signal,
          });
        } catch (err) {
          throw new Error(
            `thinking-phase generation failed: ${(err as Error).message}`,
            { cause: err },
          );
        }

        if (thinkResp.content !== "") {
          console.log(`🧠 [Thinking trace]: ${thinkResp.content}`);
          contextHistory.push(thinkResp);
        }
      }

      // ================================================================
      // Phase 2: Action — restore tools; the model executes its own plan.
      // ================================================================
      console.log("[Engine][Phase 2] Tools restored — awaiting model action...");

      let actionResp: Message;
      try {
        actionResp = await this.provider.generate(
          contextHistory,
          availableTools,
          { signal },
        );
      } catch (err) {
        throw new Error(
          `action-phase generation failed: ${(err as Error).message}`,
          { cause: err },
        );
      }

      contextHistory.push(actionResp);

      if (actionResp.content !== "") {
        console.log(`🤖 [Reply]: ${actionResp.content}`);
      }

      // ================================================================
      // Exit + tool execution (unchanged).
      // ================================================================
      const toolCalls = actionResp.tool_calls ?? [];
      if (toolCalls.length === 0) {
        console.log("[Engine] No tool call requested — task complete.");
        break;
      }

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

        // Wrap the observation as a user message; tool_call_id is mandatory
        // for the model to correlate observation with its earlier call.
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
