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
// Upgraded mock LLM provider
// ==========================================
class MockProvider implements LLMProvider {
  private turn = 0;

  async generate(
    _messages: Message[],
    availableTools: ToolDefinition[],
    _options?: GenerateOptions,
  ): Promise<Message> {
    // Empty tool list => engine is in Phase 1 (Thinking).
    if (availableTools.length === 0) {
      return {
        role: "assistant",
        content:
          "[reasoning] Goal: check files in the workspace. I shouldn't guess — first call the bash tool to run `ls`, see what's there, then decide next steps.",
      };
    }

    // Tools available => Phase 2 (Action).
    this.turn++;
    if (this.turn === 1) {
      // First action turn: follow the plan and call the tool precisely.
      return {
        role: "assistant",
        content: "Now executing the step I just planned.",
        tool_calls: [
          {
            id: "call_123",
            name: "bash",
            arguments: { command: "ls -la" },
          },
        ],
      };
    }

    // Second action turn: summarize and exit.
    return {
      role: "assistant",
      content:
        "Based on the tool output I can see main.go — task complete!",
    };
  }
}

// ==========================================
// Mock tool registry
// ==========================================
class MockRegistry implements Registry {
  // A single fake ToolDefinition is enough for Phase 2 to detect "tools present".
  getAvailableTools(): ToolDefinition[] {
    return [{ name: "bash", description: "", input_schema: null }];
  }

  async execute(
    call: ToolCall,
    _options?: ExecuteOptions,
  ): Promise<ToolResult> {
    return {
      tool_call_id: call.id,
      output: "-rw-r--r--  1 user group  234 Oct 24 10:00 index.ts\n",
      is_error: false,
    };
  }
}

// ==========================================
// Wire up and run
// ==========================================
async function main(): Promise<void> {
  const workDir = process.cwd();

  const provider = new MockProvider();
  const registry = new MockRegistry();

  // Instantiate the engine with EnableThinking = true.
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
