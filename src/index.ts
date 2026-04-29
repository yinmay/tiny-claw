// src/index.ts
import { AgentEngine } from "./engine/index.js";
import type { GenerateOptions, LLMProvider } from "./provider/index.js";
import type {
  Message,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./schema/index.js";
import type { ExecuteOptions, Registry } from "./tools/index.js";

// ==========================================
// 1. Mock LLM provider
// ==========================================
// Branches on whether tools were exposed to it:
//  - no tools  -> emit a plain-text plan (the Thinking phase).
//  - tools     -> on first action turn request bash, then declare done.
class MockProvider implements LLMProvider {
  private actionTurn = 0;

  async generate(
    _messages: Message[],
    availableTools: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<Message> {
    if (availableTools.length === 0) {
      return {
        role: "assistant",
        content:
          "Plan: 1) list files in the workspace via bash `ls -la`; 2) inspect the result; 3) report back.",
      };
    }

    this.actionTurn++;
    if (this.actionTurn === 1) {
      return {
        role: "assistant",
        content: "Executing the plan — running ls -la.",
        tool_calls: [
          {
            id: "call_123",
            name: "bash",
            arguments: { command: "ls -la" },
          },
        ],
      };
    }

    return {
      role: "assistant",
      content: "I see the file list — it includes main.go. Task complete!",
    };
  }
}

// ==========================================
// 2. Mock tool registry
// ==========================================
class MockRegistry implements Registry {
  getAvailableTools(): ToolDefinition[] {
    return [];
  }

  async execute(
    call: ToolCall,
    _options?: ExecuteOptions,
  ): Promise<ToolResult> {
    return {
      tool_call_id: call.id,
      output: "-rw-r--r--  1 user group  234 Oct 24 10:00 main.go\n",
      is_error: false,
    };
  }
}

// ==========================================
// 3. Wire up and run
// ==========================================
async function main(): Promise<void> {
  // Use the current working directory as the physical workspace boundary.
  const workDir = process.cwd();

  const provider = new MockProvider();
  const registry = new MockRegistry();

  const engine = new AgentEngine({
    provider,
    registry,
    workDir,
    enableThinking: true,
  });

  await engine.run("Please check the files in the current directory");
}

main().catch((err) => {
  console.error("Engine crashed:", err);
  process.exit(1);
});
