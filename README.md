# tiny-claw

```
tiny-claw/
├── src/
│   ├── index.ts              # Entry point (replaces cmd/claw/main.go)
│   ├── engine/               # MainLoop core implementation
│   │   └── index.ts
│   ├── provider/             # LLM provider abstraction and vendor SDK implementations
│   │   ├── index.ts          # Provider interface
│   │   ├── anthropic.ts
│   │   └── openai.ts
│   ├── context/              # Token monitoring and dynamic prompt assembly
│   │   ├── index.ts
│   │   ├── token-counter.ts
│   │   └── prompt-builder.ts
│   ├── tools/                # Tool registry, middleware, and built-in minimal tools
│   │   ├── index.ts          # Registry & middleware
│   │   ├── bash.ts
│   │   └── edit.ts
│   ├── memory/               # Filesystem-backed memory state store
│   │   └── index.ts
│   └── feishu/               # Feishu bot interaction callbacks
│       ├── index.ts
│       └── webhook.ts
├── package.json              # Replaces go.mod
├── tsconfig.json
├── .gitignore
└── README.md
```
