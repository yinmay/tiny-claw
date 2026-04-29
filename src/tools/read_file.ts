// src/tools/read_file.ts
// 真实的 read_file 工具：限定在 workDir 沙箱内读取文本文件。

import { readFile } from "node:fs/promises";
import * as path from "node:path";

import type { Tool } from "./registry.js";

interface ReadFileArgs {
  path: string;
}

const MAX_BYTES = 256 * 1024;

export function createReadFileTool(workDir: string): Tool {
  const sandboxRoot = path.resolve(workDir);

  return {
    definition: {
      name: "read_file",
      description:
        "读取工作区内的文本文件。path 可以是相对 workDir 的相对路径，也可以是绝对路径，但都必须落在 workDir 沙箱内。",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要读取的文件路径，相对 workDir 或绝对路径。",
          },
        },
        required: ["path"],
      },
    },

    async execute(args: unknown): Promise<string> {
      const { path: requested } = parseArgs(args);
      const absolute = path.resolve(sandboxRoot, requested);

      const rel = path.relative(sandboxRoot, absolute);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(`拒绝访问沙箱外路径: ${requested}`);
      }

      const buf = await readFile(absolute);
      if (buf.byteLength > MAX_BYTES) {
        return `${buf.subarray(0, MAX_BYTES).toString("utf8")}\n[...文件过大，已截断到 ${MAX_BYTES} 字节]`;
      }
      return buf.toString("utf8");
    },
  };
}

function parseArgs(raw: unknown): ReadFileArgs {
  if (!raw || typeof raw !== "object") {
    throw new Error("read_file 参数必须是对象");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.path !== "string" || obj.path === "") {
    throw new Error("read_file 缺少必填参数 path");
  }
  return { path: obj.path };
}
