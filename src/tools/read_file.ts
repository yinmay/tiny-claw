// src/tools/read_file.ts
// Real read_file tool: reads text files restricted to the workDir sandbox.

import { readFile } from "node:fs/promises";
import * as path from "node:path";

import type { ToolDefinition } from "../schema/index.js";
import type { BaseTool } from "./registry.js";

interface ReadFileArgs {
  path: string;
}

const MAX_BYTES = 256 * 1024;

export class ReadFileTool implements BaseTool {
  private readonly sandboxRoot: string;

  constructor(workDir: string) {
    this.sandboxRoot = path.resolve(workDir);
  }

  name(): string {
    return "read_file";
  }

  definition(): ToolDefinition {
    return {
      name: this.name(),
      description:
        "Read a text file inside the workspace. `path` may be relative to workDir or absolute, but must resolve inside the workDir sandbox.",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path to read, relative to workDir or absolute.",
          },
        },
        required: ["path"],
      },
    };
  }

  async execute(rawArgs: string): Promise<string> {
    const { path: requested } = parseArgs(rawArgs);
    const absolute = path.resolve(this.sandboxRoot, requested);

    const rel = path.relative(this.sandboxRoot, absolute);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Refused: path escapes sandbox: ${requested}`);
    }

    const buf = await readFile(absolute);
    if (buf.byteLength > MAX_BYTES) {
      return `${buf.subarray(0, MAX_BYTES).toString("utf8")}\n[...file too large, truncated to ${MAX_BYTES} bytes]`;
    }
    return buf.toString("utf8");
  }
}

export function createReadFileTool(workDir: string): ReadFileTool {
  return new ReadFileTool(workDir);
}

function parseArgs(rawArgs: string): ReadFileArgs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs || "{}");
  } catch {
    throw new Error("read_file arguments must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("read_file arguments must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.path !== "string" || obj.path === "") {
    throw new Error("read_file missing required argument: path");
  }
  return { path: obj.path };
}
