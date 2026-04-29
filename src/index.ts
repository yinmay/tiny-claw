// src/index.ts
import { AgentEngine } from "./engine/index.js";
import { OpenAIProvider } from "./provider/openai.js";
import { createReadFileTool } from "./tools/read_file.js";
import { ToolRegistry } from "./tools/registry.js";

async function main(): Promise<void> {
  if (!process.env.ZHIPU_API_KEY) {
    throw new Error("请先导出 ZHIPU_API_KEY 环境变量");
  }

  const workDir = process.cwd();

  // 1. 初始化真实的 Provider 大脑 (指向智谱 GLM-4.5)
  // 这里你可以任意切换 AnthropicProvider.fromZhipuEnv 或 OpenAIProvider.fromZhipuEnv，效果完全一致！
  const provider = OpenAIProvider.fromZhipuEnv("glm-4.5-air");

  // 2. 接入真实的 Registry，挂载 read_file 工具 (沙箱锁定到 workDir)
  const registry = new ToolRegistry();
  registry.register(createReadFileTool(workDir));

  // 3. 实例化并运行引擎，关闭慢思考
  const engine = new AgentEngine({
    provider,
    registry,
    workDir,
    enableThinking: false,
  });

  // 设定测试任务：让模型用 read_file 读取项目入口
  const prompt = "请读取 package.json，告诉我这个项目叫什么名字、依赖了哪些包。";

  await engine.run(prompt);
}

main().catch((err) => {
  console.error("引擎运行崩溃:", err);
  process.exit(1);
});
