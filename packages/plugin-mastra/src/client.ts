import type {
  DeleteMemoryParams,
  DeleteMemoryResponse,
  InsertMemoryParams,
  InsertDocumentsBatchParams,
  InsertDocumentsBatchResponse,
  ListDocumentsParams,
  ListDocumentsResponse,
  GetDocumentParams,
  GetDocumentResponse,
  DeleteDocumentParams,
  DeleteDocumentResponse,
  NeocortexConfig,
  QueryMemoryParams,
  QueryMemoryResponse,
  QueryMemoryContextParams,
  ChatMemoryParams,
  ChatMemoryResponse,
  InteractMemoryParams,
  InteractMemoryResponse,
  RecallThoughtsParams,
  RecallThoughtsResponse,
  SyncMemoryParams,
  SyncMemoryResponse,
  RecallMemoryParams,
  RecallMemoryResponse,
  RecallMemoriesParams,
  RecallMemoriesResponse,
  GetIngestionJobResponse,
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

  // --- Legacy/core endpoints ---

  async syncMemory(params: SyncMemoryParams): Promise<SyncMemoryResponse> {
    this.logger?.info?.("Neocortex: syncMemory", { workspaceId: params.workspaceId, agentId: params.agentId });
    const body = {
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      source: params.source,
      files: params.files.map((f) => ({
        filePath: f.filePath,
        content: f.content,
        timestamp: f.timestamp,
        hash: f.hash,
      })),
    };
    return this.post("/v1/memory/sync", body);
  }

  async recallMemory(params: RecallMemoryParams = {}): Promise<RecallMemoryResponse> {
    return this.post("/v1/memory/recall", {
      namespace: params.namespace,
      maxChunks: params.maxChunks,
    });
  }

  async recallMemories(params: RecallMemoriesParams = {}): Promise<RecallMemoriesResponse> {
    return this.post("/v1/memory/memories/recall", {
      namespace: params.namespace,
      topK: params.topK,
      minRetention: params.minRetention,
      asOf: params.asOf,
    });
  }

  async chatMemory(params: ChatMemoryParams): Promise<ChatMemoryResponse> {
    return this.post("/v1/memory/chat", {
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens ?? (params as any).max_tokens,
    });
  }

  async interactMemory(params: InteractMemoryParams): Promise<InteractMemoryResponse> {
    return this.post("/v1/memory/interact", {
      ...params,
    });
  }

  // --- Documents & mirrored endpoints ---

  async insertDocument(params: InsertMemoryParams & { documentId: string }): Promise<any> {
    const body = {
      title: params.title,
      content: params.content,
      namespace: params.namespace,
      sourceType: params.sourceType ?? "doc",
      metadata: params.metadata ?? {},
      priority: (params as any).priority,
      createdAt: (params as any).createdAt,
      updatedAt: (params as any).updatedAt,
      documentId: params.documentId,
    };
    return this.post("/v1/memory/documents", body);
  }

  async insertDocumentsBatch(params: InsertDocumentsBatchParams): Promise<InsertDocumentsBatchResponse> {
    return this.post("/v1/memory/documents/batch", params);
  }

  async listDocuments(params: ListDocumentsParams = {}): Promise<ListDocumentsResponse> {
    return this.get("/v1/memory/documents", params);
  }

  async getDocument(params: GetDocumentParams): Promise<GetDocumentResponse> {
    return this.get(`/v1/memory/documents/${encodeURIComponent(params.documentId)}`, {
      namespace: params.namespace,
    });
  }

  async deleteDocument(params: DeleteDocumentParams): Promise<DeleteDocumentResponse> {
    // TS SDK uses: DELETE /v1/memory/documents/:documentId?namespace=...
    return this.delete(`/v1/memory/documents/${encodeURIComponent(params.documentId)}`, {
      namespace: params.namespace,
    });
  }

  async queryMemoryContext(params: QueryMemoryContextParams): Promise<QueryMemoryResponse> {
    return this.post("/v1/memory/queries", {
      query: params.query,
      includeReferences: params.includeReferences,
      namespace: params.namespace,
      maxChunks: params.maxChunks,
      documentIds: params.documentIds,
      recallOnly: params.recallOnly,
      llmQuery: params.llmQuery,
    });
  }

  async chatMemoryContext(params: ChatMemoryParams): Promise<ChatMemoryResponse> {
    return this.post("/v1/memory/conversations", {
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens ?? (params as any).max_tokens,
    });
  }

  async recordInteractions(params: InteractMemoryParams): Promise<InteractMemoryResponse> {
    return this.post("/v1/memory/interactions", params);
  }

  async recallThoughts(params: RecallThoughtsParams = {}): Promise<RecallThoughtsResponse> {
    return this.post("/v1/memory/memories/thoughts", {
      namespace: params.namespace,
      maxChunks: params.maxChunks ?? (params as any).max_chunks,
      temperature: params.temperature,
      randomnessSeed: params.randomnessSeed ?? (params as any).randomness_seed,
      persist: params.persist,
      enablePredictionCheck:
        params.enablePredictionCheck ?? (params as any).enable_prediction_check,
      thoughtPrompt: params.thoughtPrompt ?? (params as any).thought_prompt,
    });
  }

  async getIngestionJob(jobId: string): Promise<GetIngestionJobResponse> {
    return this.get(
      `/v1/memory/ingestion/jobs/${encodeURIComponent(jobId)}`,
      undefined,
    );
  }

  // --- HTTP helpers ---

  private async post<T = any>(path: string, body: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    return this.parseResponse<T>(res);
  }

  private async get<T = any>(
    path: string,
    params?: any,
  ): Promise<T> {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) : "";
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return this.parseResponse<T>(res);
  }

  private async delete<T = any>(
    path: string,
    params?: any,
  ): Promise<T> {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) : "";
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return this.parseResponse<T>(res);
  }

  private async parseResponse<T = any>(res: Response): Promise<T> {
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`HTTP ${res.status}: Non-JSON response`);
    }

    if (!res.ok || json.success === false) {
      const msg = json.error || `HTTP ${res.status}`;
      this.logger?.error?.("Neocortex API error", { status: res.status, body: json });
      throw new Error(msg);
    }

    return json as T;
  }
}

