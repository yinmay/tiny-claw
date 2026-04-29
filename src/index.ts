// src/index.ts
import { AgentEngine } from "./engine/index.js";
import { OpenAIProvider } from "./provider/openai.js";
import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./schema/index.js";
import type { ExecuteOptions, Registry } from "./tools/index.js";

// 伪造的工具注册表 (用于测试 Provider 的工具提取能力)
class MockRegistry implements Registry {
  getAvailableTools(): ToolDefinition[] {
    return [
      {
        name: "get_weather",
        description: "获取指定城市的当前天气情况。",
        input_schema: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
    ];
  }

  async execute(
    call: ToolCall,
    _options?: ExecuteOptions,
  ): Promise<ToolResult> {
    console.log(`  -> [Mock 工具执行] 获取 ${call.name} 的天气中...`);
    return {
      tool_call_id: call.id,
      output: "API 返回：今天是晴天，气温 25 度。",
      is_error: false,
    };
  }
}

async function main(): Promise<void> {
  if (!process.env.ZHIPU_API_KEY) {
    throw new Error("请先导出 ZHIPU_API_KEY 环境变量");
  }

  const workDir = process.cwd();

  // 1. 初始化真实的 Provider 大脑 (指向智谱 GLM-4.5)
  // 这里你可以任意切换 AnthropicProvider.fromZhipuEnv 或 OpenAIProvider.fromZhipuEnv，效果完全一致！
  const provider = OpenAIProvider.fromZhipuEnv("glm-4.5-air");

  // 2. 注入伪造的工具注册表
  const registry = new MockRegistry();

  // 3. 实例化并运行引擎，开启 enableThinking = true (开启慢思考阶段！)
  const engine = new AgentEngine({
    provider,
    registry,
    workDir,
    enableThinking: true,
  });

  // 设定测试任务
  const prompt = "我想去北京跑步，帮我查查天气适合吗？";

  await engine.run(prompt);
}

main().catch((err) => {
  console.error("引擎运行崩溃:", err);
  process.exit(1);
});
