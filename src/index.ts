// src/index.ts
import { AgentEngine } from "./engine/index.js";
import { OpenAIProvider } from "./provider/openai.js";
import { createReadFileTool } from "./tools/read_file.js";
import { ToolRegistry } from "./tools/registry.js";

async function main(): Promise<void> {
  if (!process.env.ZHIPU_API_KEY) {
    throw new Error("Please export the ZHIPU_API_KEY environment variable");
  }

  const workDir = process.cwd();

  // 1. Initialize the real provider brain (pointed at Zhipu GLM-4.5).
  // Swap OpenAIProvider.fromZhipuEnv for AnthropicProvider.fromZhipuEnv freely — same effect.
  const provider = OpenAIProvider.fromZhipuEnv("glm-4.5-air");

  // 2. Wire up the real registry, mount the read_file tool (sandboxed to workDir).
  const registry = new ToolRegistry();
  registry.register(createReadFileTool(workDir));

  // 3. Instantiate and run the engine with slow-thinking disabled.
  const engine = new AgentEngine({
    provider,
    registry,
    workDir,
    enableThinking: false,
  });

  // Test task: have the model use read_file to read the project entry point.
  const prompt = "Please read package.json and tell me the project name and which packages it depends on.";

  await engine.run(prompt);
}

main().catch((err) => {
  console.error("Engine crashed:", err);
  process.exit(1);
});
