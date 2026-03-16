import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NeocortexMemoryClient } from "./client";
import type {
  DeleteMemoryInput,
  NeocortexConfig,
  RecallMemoryInput,
  SaveMemoryInput,
} from "./types";

export * from "./types";
export * from "./utils";
export * from "./client";

export interface ClaudeCodeNeocortexConfig extends NeocortexConfig {
  /** Default namespace when one is not provided by the caller. */
  defaultNamespace?: string;
}

export class ClaudeCodeNeocortexMemory {
  private readonly client: NeocortexMemoryClient;
  private readonly defaultNamespace: string;

  constructor(config: ClaudeCodeNeocortexConfig) {
    this.client = new NeocortexMemoryClient(config);
    this.defaultNamespace = config.defaultNamespace?.trim() || "default";
  }

  private resolveNamespace(ns?: string | null): string {
    const trimmed = ns?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : this.defaultNamespace;
  }

  async saveMemory(input: SaveMemoryInput) {
    const namespace = this.resolveNamespace(input.namespace);
    const res = await this.client.insertMemory({
      title: input.key,
      content: input.content,
      namespace,
      sourceType: "doc",
      metadata: input.metadata,
    });
    const status = (res as any)?.data?.status ?? "completed";
    return {
      ok: true as const,
      namespace,
      message: `Saved memory '${input.key}' in namespace '${namespace}' (status=${status}).`,
    };
  }

  async recallMemory(input: RecallMemoryInput) {
    const namespace = this.resolveNamespace(input.namespace);
    const res = await this.client.queryMemory({
      query: input.query,
      namespace,
      maxChunks: input.max_chunks ?? 10,
    });
    const data = res.data;
    const direct = data.llmContextMessage || data.response;
    if (typeof direct === "string" && direct.trim()) {
      return { ok: true as const, namespace, context: direct.trim(), raw: data };
    }

    const chunks = data.context?.chunks ?? [];
    const texts: string[] = [];
    for (const chunk of chunks) {
      if (chunk && typeof chunk === "object") {
        const text = (chunk as any).content ?? (chunk as any).text ?? (chunk as any).body ?? "";
        if (typeof text === "string" && text.trim()) texts.push(text.trim());
      }
    }
    return {
      ok: true as const,
      namespace,
      context: texts.length ? texts.join("\n\n") : "No relevant memories found.",
      raw: data,
    };
  }

  async deleteMemory(input: DeleteMemoryInput) {
    const namespace = input.namespace?.trim() || undefined;
    const res = await this.client.deleteMemory({ namespace });
    return {
      ok: true as const,
      namespace,
      message: res.data?.message || "Memory deleted.",
      raw: res.data,
    };
  }

  /**
   * MCP tool definitions that can be registered on a Model Context Protocol server
   * for consumption by Claude Code via `.mcp.json` or plugin configuration.
   */
  getMcpTools() {
    const saveMemorySchema = z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      key: z.string().describe("Short key/title for the memory."),
      content: z.string().describe("The content to remember."),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON-serializable metadata."),
    });

    const recallMemorySchema = z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      query: z.string().describe("Natural-language query for memory."),
      max_chunks: z
        .number()
        .int()
        .optional()
        .describe("Maximum number of memory chunks to retrieve (default 10)."),
    });

    const deleteMemorySchema = z.object({
      namespace: z.string().optional().describe("Namespace to delete."),
    });

    return [
      {
        name: "neocortex_save_memory",
        description: "Save a user preference or important fact into Neocortex memory.",
        inputSchema: saveMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = saveMemorySchema.parse(args);
          const memory = (server as any).__memory as ClaudeCodeNeocortexMemory;
          return await memory.saveMemory(input);
        },
      },
      {
        name: "neocortex_recall_memory",
        description: "Recall relevant long-term memory for a given query from Neocortex.",
        inputSchema: recallMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recallMemorySchema.parse(args);
          const memory = (server as any).__memory as ClaudeCodeNeocortexMemory;
          return await memory.recallMemory(input);
        },
      },
      {
        name: "neocortex_delete_memory",
        description: "Delete all Neocortex memory in a namespace (admin delete).",
        inputSchema: deleteMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = deleteMemorySchema.parse(args);
          const memory = (server as any).__memory as ClaudeCodeNeocortexMemory;
          return await memory.deleteMemory(input);
        },
      },
    ];
  }
}

/**
 * Convenience entry point to run a Neocortex memory MCP server over stdio.
 *
 * Intended usage from a Claude Code MCP server definition:
 *
 *   {
 *     "mcpServers": {
 *       "neocortex-memory": {
 *         "command": "node",
 *         "args": ["./node_modules/@neocortex/plugin-claude-code/dist/index.js"],
 *         "env": {
 *           "ALPHAHUMAN_API_KEY": "...",
 *           "ALPHAHUMAN_BASE_URL": "https://api.yourbackend.com"
 *         }
 *       }
 *     }
 *   }
 */
export async function runNeocortexMcpServerFromEnv() {
  const token =
    process.env.ALPHAHUMAN_API_KEY ||
    process.env.NEOCORTEX_API_KEY ||
    process.env.NEOCORTEX_TOKEN;

  if (!token || !token.trim()) {
    throw new Error(
      "Neocortex token is required. Set ALPHAHUMAN_API_KEY, NEOCORTEX_API_KEY, or NEOCORTEX_TOKEN."
    );
  }

  const memory = new ClaudeCodeNeocortexMemory({
    token,
    baseUrl: process.env.ALPHAHUMAN_BASE_URL || process.env.NEOCORTEX_BASE_URL,
  });

  const server = new McpServer({
    name: "neocortex-memory-mcp",
    version: "0.1.0",
  });

  // Attach memory instance to server so tool handlers can access it.
  (server as any).__memory = memory;

  for (const tool of memory.getMcpTools()) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, tool.handler as any);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Allow running as `node dist/index.js` directly.
if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.js")) {
  // eslint-disable-next-line no-void
  void runNeocortexMcpServerFromEnv();
}

