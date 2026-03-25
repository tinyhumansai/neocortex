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
      document_id: params.documentId,
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

  async syncMemory(params: {
    workspace_id: string;
    agent_id: string;
    source?: "startup" | "agent_end";
    files: Array<{
      file_path?: string;
      filePath?: string;
      content: string;
      timestamp?: string | number;
      hash: string;
    }>;
  }): Promise<any> {
    const body = {
      workspaceId: params.workspace_id,
      agentId: params.agent_id,
      source: params.source,
      files: (params.files ?? []).map((f) => ({
        filePath: f.file_path ?? f.filePath,
        content: f.content,
        timestamp: String(f.timestamp ?? ""),
        hash: f.hash,
      })),
    };
    return this.post("/v1/memory/sync", body);
  }

  async insertDocument(params: {
    title: string;
    content: string;
    namespace: string;
    source_type?: string;
    metadata?: Record<string, unknown>;
    priority?: string;
    created_at?: number;
    updated_at?: number;
    document_id: string;
  }): Promise<any> {
    const body = {
      title: params.title,
      content: params.content,
      namespace: params.namespace,
      sourceType: params.source_type ?? "doc",
      metadata: params.metadata ?? {},
      priority: params.priority,
      createdAt: params.created_at,
      updatedAt: params.updated_at,
      documentId: params.document_id,
    };
    return this.post("/v1/memory/documents", body);
  }

  async insertDocumentsBatch(params: {
    items: Array<{
      title: string;
      content: string;
      namespace: string;
      source_type?: string;
      metadata?: Record<string, unknown>;
      priority?: string;
      created_at?: number;
      updated_at?: number;
      document_id: string;
    }>;
  }): Promise<any> {
    const items = (params.items ?? []).map((it) => ({
      title: it.title,
      content: it.content,
      namespace: it.namespace,
      sourceType: it.source_type ?? "doc",
      metadata: it.metadata ?? {},
      priority: it.priority,
      createdAt: it.created_at,
      updatedAt: it.updated_at,
      documentId: it.document_id,
    }));
    return this.post("/v1/memory/documents/batch", { items });
  }

  async listDocuments(params: {
    namespace?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    return this.get("/v1/memory/documents", params);
  }

  async getDocument(params: { document_id: string; namespace?: string }): Promise<any> {
    return this.get(`/v1/memory/documents/${encodeURIComponent(params.document_id)}`, {
      namespace: params.namespace,
    });
  }

  async deleteDocument(params: { document_id: string; namespace: string }): Promise<any> {
    return this.delete(`/v1/memory/documents/${encodeURIComponent(params.document_id)}`, {
      namespace: params.namespace,
    });
  }

  async queryMemoryContext(params: {
    query: string;
    namespace?: string;
    include_references?: boolean;
    max_chunks?: number;
    document_ids?: string[];
    recall_only?: boolean;
    llm_query?: string;
  }): Promise<any> {
    return this.post("/v1/memory/queries", {
      query: params.query,
      includeReferences: params.include_references,
      namespace: params.namespace,
      maxChunks: params.max_chunks,
      documentIds: params.document_ids,
      recallOnly: params.recall_only,
      llmQuery: params.llm_query,
    });
  }

  async chatMemoryContext(params: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<any> {
    return this.post("/v1/memory/conversations", {
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });
  }

  async recordInteractions(params: {
    namespace: string;
    entity_names: string[];
    description?: string;
    interaction_level?: string;
    interaction_levels?: string[];
    timestamp?: number;
  }): Promise<any> {
    return this.post("/v1/memory/interactions", {
      namespace: params.namespace,
      entityNames: params.entity_names,
      description: params.description,
      interactionLevel: params.interaction_level,
      interactionLevels: params.interaction_levels,
      timestamp: params.timestamp,
    });
  }

  async recallThoughts(params: {
    namespace?: string;
    max_chunks?: number;
    temperature?: number;
    randomness_seed?: number;
    persist?: boolean;
    enable_prediction_check?: boolean;
    thought_prompt?: string;
  }): Promise<any> {
    return this.post("/v1/memory/memories/thoughts", {
      namespace: params.namespace,
      maxChunks: params.max_chunks,
      temperature: params.temperature,
      randomnessSeed: params.randomness_seed,
      persist: params.persist,
      enablePredictionCheck: params.enable_prediction_check,
      thoughtPrompt: params.thought_prompt,
    });
  }

  async chatMemory(params: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<any> {
    return this.post("/v1/memory/chat", {
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });
  }

  async interactMemory(params: {
    namespace: string;
    entity_names: string[];
    description?: string;
    interaction_level?: string;
    interaction_levels?: string[];
    timestamp?: number;
  }): Promise<any> {
    return this.post("/v1/memory/interact", {
      namespace: params.namespace,
      entityNames: params.entity_names,
      description: params.description,
      interactionLevel: params.interaction_level,
      interactionLevels: params.interaction_levels,
      timestamp: params.timestamp,
    });
  }

  async recallMemoryMaster(params: { namespace?: string; max_chunks?: number }): Promise<any> {
    return this.post("/v1/memory/recall", {
      namespace: params.namespace,
      maxChunks: params.max_chunks,
    });
  }

  async recallMemories(params: {
    namespace?: string;
    top_k?: number;
    min_retention?: number;
    as_of?: number;
  }): Promise<any> {
    return this.post("/v1/memory/memories/recall", {
      namespace: params.namespace,
      topK: params.top_k,
      minRetention: params.min_retention,
      asOf: params.as_of,
    });
  }

  async getIngestionJob(params: { job_id: string }): Promise<any> {
    return this.get(
      `/v1/memory/ingestion/jobs/${encodeURIComponent(params.job_id)}`,
      undefined,
    );
  }

  private buildQuery(params: Record<string, unknown> | undefined): string {
    if (!params) return "";
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, Array.isArray(v) ? JSON.stringify(v) : String(v)]),
    ).toString();
    return qs ? `?${qs}` : "";
  }

  private async get<T = any>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}${this.buildQuery(params)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
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

  private async delete<T = any>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${this.buildQuery(params)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
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

