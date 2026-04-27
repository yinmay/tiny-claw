# tiny-claw

⏺ tiny-claw/
  ├── src/
  │   ├── index.ts              # 程序入口（替代 cmd/claw/main.go）
  │   ├── engine/               # MainLoop 核心实现
  │   │   └── index.ts
  │   ├── provider/             # 大模型接口抽象与具体厂商 SDK 实现
  │   │   ├── index.ts          # Provider 接口定义
  │   │   ├── anthropic.ts
  │   │   └── openai.ts
  │   ├── context/              # Token 监控、Prompt 动态组装
  │   │   ├── index.ts
  │   │   ├── token-counter.ts
  │   │   └── prompt-builder.ts
  │   ├── tools/                # 工具注册表、Middleware、基础极简工具
  │   │   ├── index.ts          # 注册表 & Middleware
  │   │   ├── bash.ts
  │   │   └── edit.ts
  │   ├── memory/               # 基于文件系统的记忆状态存取
  │   │   └── index.ts
  │   └── feishu/               # 飞书机器人交互回调
  │       ├── index.ts
  │       └── webhook.ts
  ├── package.json              # 替代 go.mod
  ├── tsconfig.json
  ├── .gitignore
  └── README.md