import type {
  DeleteMemoryParams,
  DeleteMemoryResponse,
  InsertMemoryParams,
  NeocortexConfig,
  QueryMemoryParams,
  QueryMemoryResponse,
} from "./types";
import { resolveBaseUrl } from "./utils";

export class NeocortexMemoryClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger?: NeocortexConfig["logger"];

  constructor(config: NeocortexConfig) {
    if (!config.token?.trim()) throw new Error("Neocortex token is required");
    this.token = config.token;
    this.baseUrl = resolveBaseUrl(config.baseUrl);
    this.logger = config.logger;
  }

  async insertMemory(params: InsertMemoryParams): Promise<{ data: Record<string, unknown> }> {
    this.logger?.info?.("Neocortex: insertMemory", {
      namespace: params.namespace,
      title: params.title,
    });
    const body = {
      title: params.title,
      content: params.content,
      namespace: params.namespace,
      sourceType: params.sourceType ?? "doc",
      metadata: params.metadata ?? {},
    };
    return this.post("/v1/memory/insert", body);
  }

  async queryMemory(params: QueryMemoryParams): Promise<QueryMemoryResponse> {
    this.logger?.info?.("Neocortex: queryMemory", {
      namespace: params.namespace,
      query: params.query,
    });
    const body = {
      query: params.query,
      includeReferences: params.includeReferences,
      namespace: params.namespace,
      maxChunks: params.maxChunks,
      documentIds: params.documentIds,
      llmQuery: params.llmQuery,
    };
    return this.post("/v1/memory/query", body);
  }

  async deleteMemory(params: DeleteMemoryParams): Promise<DeleteMemoryResponse> {
    this.logger?.warn?.("Neocortex: deleteMemory", { namespace: params.namespace });
    const body = { namespace: params.namespace };
    return this.post("/v1/memory/admin/delete", body);
  }

  private async post<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`HTTP ${res.status}: Non-JSON response`);
    }

    if (!res.ok || (json as any).success === false) {
      const msg = (json as any).error || `HTTP ${res.status}`;
      this.logger?.error?.("Neocortex API error", { status: res.status, body: json });
      throw new Error(msg);
    }

    return json as T;
  }
}

