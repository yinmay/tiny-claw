// src/tools/read_file.ts
// Real read_file tool: reads text files restricted to the workDir sandbox.

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
    },

    async execute(args: unknown): Promise<string> {
      const { path: requested } = parseArgs(args);
      const absolute = path.resolve(sandboxRoot, requested);

      const rel = path.relative(sandboxRoot, absolute);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(`Refused: path escapes sandbox: ${requested}`);
      }

      const buf = await readFile(absolute);
      if (buf.byteLength > MAX_BYTES) {
        return `${buf.subarray(0, MAX_BYTES).toString("utf8")}\n[...file too large, truncated to ${MAX_BYTES} bytes]`;
      }
      return buf.toString("utf8");
    },
  };
}

function parseArgs(raw: unknown): ReadFileArgs {
  if (!raw || typeof raw !== "object") {
    throw new Error("read_file arguments must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.path !== "string" || obj.path === "") {
    throw new Error("read_file missing required argument: path");
  }
  return { path: obj.path };
}
