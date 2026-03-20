// Alphahuman Memory SDK for TypeScript
// Aligned with AlphaHuman backend API: insert, query, admin/delete, recall, memories/recall, chat, thought, interact, etc.

const DEFAULT_BASE_URL = "https://api.tinyhumans.ai";

/** Resolve TINYHUMANS_BASE_URL from env when available (e.g. Node). */
function getEnvBaseUrl(): string | undefined {
  try {
    const g =
      typeof globalThis !== "undefined"
        ? globalThis
        : (undefined as unknown as Record<string, unknown>);
    const env = (
      g as { process?: { env?: Record<string, string | undefined> } }
    )?.process?.env;
    return env?.TINYHUMANS_BASE_URL ?? env?.ALPHAHUMAN_BASE_URL;
  } catch {
    return undefined;
  }
}

// ---------- Config ----------

export interface AlphahumanConfig {
  /** Bearer token (API key or JWT) for authentication */
  token: string;
  /** Base URL of the Alphahuman backend. If omitted, uses TINYHUMANS_BASE_URL env or default API URL */
  baseUrl?: string;
}

// ---------- Insert (ingest) ----------

export interface InsertMemoryParams {
  /** Document title */
  title: string;
  /** Document content */
  content: string;
  /** Namespace (required) */
  namespace: string;
  sourceType?: "doc" | "chat" | "email";
  metadata?: Record<string, unknown>;
  priority?: "high" | "medium" | "low";
  createdAt?: number;
  updatedAt?: number;
  documentId?: string;
}

export interface InsertMemoryResponse {
  success: boolean;
  data: {
    status?: string;
    stats?: Record<string, unknown>;
    usage?: {
      llm_input_tokens: number;
      llm_output_tokens: number;
      embedding_tokens: number;
      cost_usd: number;
    };
    jobId?: string;
    state?: string;
  };
}

// ---------- Chat ----------

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatMemoryParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number;
}

export interface ChatMemoryResponse {
  success: boolean;
  data: {
    content?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model?: string;
    // For pending background requests via api key
    jobId?: string;
    state?: string;
  };
}

// ---------- Interact ----------

export interface InteractMemoryParams {
  namespace: string;
  entityNames: string[];
  description?: string;
  interactionLevel?: "view" | "read" | "react" | "engage" | "create";
  interactionLevels?: Array<"view" | "read" | "react" | "engage" | "create">;
  timestamp?: number;
}

export interface InteractMemoryResponse {
  success: boolean;
  data: {
    status?: string;
    interactionsRecorded?: number;
    entityNames?: string[];
    timestampUsed?: number;
    jobId?: string;
    state?: string;
  };
}

// ---------- Recall Thoughts ----------

export interface RecallThoughtsParams {
  namespace?: string;
  maxChunks?: number;
  max_chunks?: number;
  temperature?: number;
  randomnessSeed?: number;
  randomness_seed?: number;
  persist?: boolean;
  enablePredictionCheck?: boolean;
  enable_prediction_check?: boolean;
  thoughtPrompt?: string;
  thought_prompt?: string;
}

export interface RecallThoughtsResponse {
  success: boolean;
  data: {
    thought?: string;
    context?: Record<string, unknown>;
    llm_context_message?: string;
    usage?: {
      llm_input_tokens: number;
      llm_output_tokens: number;
      embedding_tokens: number;
      cost_usd: number;
    };
    cached?: boolean;
    latency_seconds?: number;
    persisted?: boolean;
    jobId?: string;
    state?: string;
  };
}

// ---------- Ingestion Jobs ----------

export interface GetIngestionJobResponse {
  success: boolean;
  data: {
    jobId: string;
    state: string;
    endpoint: string;
    attempts: number;
    error: string | null;
    response: Record<string, unknown> | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
}

// ---------- Documents ----------

export interface InsertDocumentsBatchParams {
  items: Array<{
    title: string;
    content: string;
    namespace: string;
    sourceType?: "doc" | "chat" | "email";
    metadata?: Record<string, unknown>;
    priority?: "high" | "medium" | "low";
    createdAt?: number;
    updatedAt?: number;
    documentId?: string;
  }>;
}

export interface InsertDocumentsBatchResponse {
  success: boolean;
  data: {
    status?: string;
    results?: any[];
    state?: string;
    accepted?: Array<{ index: number; jobId: string }>;
  };
}

export interface ListDocumentsParams {
  namespace?: string;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsResponse {
  success: boolean;
  data: Record<string, unknown>;
}

export interface GetDocumentParams {
  documentId: string;
  namespace?: string;
}

export interface GetDocumentResponse {
  success: boolean;
  data: Record<string, unknown>;
}

export interface DeleteDocumentParams {
  documentId: string;
  namespace: string;
}

// ---------- Graph Snapshot ----------

export interface GetGraphSnapshotParams {
  namespace?: string;
  mode?: "master" | "latest_chunks";
  limit?: number;
  seed_limit?: number;
}

export interface GetGraphSnapshotResponse {
  success: boolean;
  data: Record<string, unknown>;
}

// ---------- Query ----------

export interface QueryMemoryParams {
  /** Query string (required) */
  query: string;
  includeReferences?: boolean;
  namespace?: string;
  maxChunks?: number;
  documentIds?: string[];
  recallOnly?: boolean;
  llmQuery?: string;
}

export interface QueryContextOut {
  entities: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  chunks: Array<Record<string, unknown>>;
}

export interface QueryMemoryResponse {
  success: boolean;
  data: {
    context?: QueryContextOut;
    usage?: {
      llm_input_tokens: number;
      llm_output_tokens: number;
      embedding_tokens: number;
      cost_usd: number;
    };
    cached?: boolean;
    llmContextMessage?: string;
    response?: string;
    jobId?: string;
    state?: string;
  };
}

// ---------- Delete (admin) ----------

export interface DeleteMemoryParams {
  /** Optional namespace to scope deletion */
  namespace?: string;
}

export interface DeleteMemoryResponse {
  success: boolean;
  data: {
    status?: string;
    userId?: string;
    namespace?: string;
    nodesDeleted?: number;
    message?: string;
    jobId?: string;
    state?: string;
  };
}

// ---------- Recall ----------

export interface RecallMemoryParams {
  namespace?: string;
  maxChunks?: number;
}

export interface RecallMemoryResponse {
  success: boolean;
  data: {
    context?: QueryContextOut;
    usage?: {
      llm_input_tokens: number;
      llm_output_tokens: number;
      embedding_tokens: number;
      cost_usd: number;
    };
    cached?: boolean;
    llmContextMessage?: string;
    response?: string;
    latencySeconds?: number;
    counts?: {
      numEntities: number;
      numRelations: number;
      numChunks: number;
    };
    jobId?: string;
    state?: string;
  };
}

// ---------- Memories recall (Ebbinghaus) ----------

export interface RecallMemoriesParams {
  namespace?: string;
  topK?: number;
  minRetention?: number;
  asOf?: number;
}

export interface MemoryItemRecalled {
  type: string;
  id: string;
  content: string;
  score: number;
  retention: number;
  last_accessed_at?: string;
  access_count: number;
  stability_days: number;
}

export interface RecallMemoriesResponse {
  success: boolean;
  data: {
    memories?: MemoryItemRecalled[];
    jobId?: string;
    state?: string;
  };
}

// ---------- Error ----------

export interface ErrorResponse {
  success: false;
  error: string;
}

export class AlphahumanError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "AlphahumanError";
    this.status = status;
    this.body = body;
  }
}

// ---------- Client ----------

export class AlphahumanMemoryClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: AlphahumanConfig) {
    if (!config.token || !config.token.trim())
      throw new Error("token is required");
    const baseUrl = config.baseUrl ?? getEnvBaseUrl() ?? DEFAULT_BASE_URL;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = config.token;
  }

  // --- Core / Legacy Endpoints ---

  /** Insert (ingest) a document into memory. POST /memory/insert */
  async insertMemory(
    params: InsertMemoryParams,
  ): Promise<InsertMemoryResponse> {
    this.validateInsertParams(params);
    return this.post<InsertMemoryResponse>("/memory/insert", params);
  }

  /** Query memory via RAG. POST /memory/query */
  async queryMemory(params: QueryMemoryParams): Promise<QueryMemoryResponse> {
    this.validateQueryParams(params);
    return this.post<QueryMemoryResponse>("/memory/query", params);
  }

  /** Chat with DeltaNet memory cache. POST /memory/chat */
  async chatMemory(params: ChatMemoryParams): Promise<ChatMemoryResponse> {
    if (!params.messages || !Array.isArray(params.messages))
      throw new Error("messages array is required");
    return this.post<ChatMemoryResponse>("/memory/chat", params);
  }

  /** Delete memory (admin). POST /memory/admin/delete */
  async deleteMemory(
    params: DeleteMemoryParams = {},
  ): Promise<DeleteMemoryResponse> {
    return this.post<DeleteMemoryResponse>("/memory/admin/delete", {
      namespace: params.namespace,
    });
  }

  /** Record entity interactions. POST /memory/interact */
  async interactMemory(
    params: InteractMemoryParams,
  ): Promise<InteractMemoryResponse> {
    if (!params.namespace) throw new Error("namespace is required");
    if (!params.entityNames || !Array.isArray(params.entityNames))
      throw new Error("entityNames array is required");
    return this.post<InteractMemoryResponse>("/memory/interact", params);
  }

  /** Recall context from Master node. POST /memory/recall */
  async recallMemory(
    params: RecallMemoryParams = {},
  ): Promise<RecallMemoryResponse> {
    if (
      params.maxChunks !== undefined &&
      (typeof params.maxChunks !== "number" ||
        !Number.isInteger(params.maxChunks) ||
        params.maxChunks <= 0)
    ) {
      throw new Error("maxChunks must be a positive integer");
    }
    return this.post<RecallMemoryResponse>("/memory/recall", {
      namespace: params.namespace,
      maxChunks: params.maxChunks,
    });
  }

  /** Recall memories from Ebbinghaus bank. POST /memory/memories/recall */
  async recallMemories(
    params: RecallMemoriesParams = {},
  ): Promise<RecallMemoriesResponse> {
    if (
      params.topK !== undefined &&
      (typeof params.topK !== "number" ||
        !Number.isFinite(params.topK) ||
        params.topK <= 0)
    ) {
      throw new Error("topK must be a positive number");
    }
    if (
      params.minRetention !== undefined &&
      (typeof params.minRetention !== "number" ||
        !Number.isFinite(params.minRetention) ||
        params.minRetention < 0)
    ) {
      throw new Error("minRetention must be a non-negative number");
    }
    return this.post<RecallMemoriesResponse>("/memory/memories/recall", {
      namespace: params.namespace,
      topK: params.topK,
      minRetention: params.minRetention,
      asOf: params.asOf,
    });
  }

  /** Generate reflective thoughts. POST /memory/memories/thoughts */
  async recallThoughts(
    params: RecallThoughtsParams = {},
  ): Promise<RecallThoughtsResponse> {
    return this.post<RecallThoughtsResponse>(
      "/memory/memories/thoughts",
      params,
    );
  }

  /** Get memory ingestion job status. GET /memory/ingestion/jobs/:jobId */
  async getIngestionJob(jobId: string): Promise<GetIngestionJobResponse> {
    if (!jobId) throw new Error("jobId is required");
    return this.get<GetIngestionJobResponse>(
      `/memory/ingestion/jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /** Poll an ingestion job until it reaches a terminal state. */
  async waitForIngestionJob(
    jobId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {},
  ): Promise<GetIngestionJobResponse> {
    if (!jobId) throw new Error("jobId is required");
    const timeoutMs = options.timeoutMs ?? 30_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    if (timeoutMs <= 0) throw new Error("timeoutMs must be > 0");
    if (pollIntervalMs <= 0) throw new Error("pollIntervalMs must be > 0");

    const pendingStates = new Set([
      "pending",
      "queued",
      "processing",
      "in_progress",
      "in-progress",
      "started",
      "start",
    ]);
    const completedStates = new Set(["completed", "done", "succeeded", "success"]);
    const failedStates = new Set(["failed", "error", "cancelled", "canceled"]);

    const deadline = Date.now() + timeoutMs;
    let last: GetIngestionJobResponse | null = null;

    while (Date.now() < deadline) {
      const job = await this.getIngestionJob(jobId);
      last = job;
      const stateRaw = job.data?.state;
      const state = (stateRaw ?? "").trim().toLowerCase();
      if (completedStates.has(state)) return job;
      if (failedStates.has(state)) {
        throw new Error(`Ingestion job ${jobId} failed (state=${stateRaw})`);
      }
      if (state && !pendingStates.has(state)) return job;
      await this.sleep(pollIntervalMs);
    }

    throw new Error(
      `Ingestion job ${jobId} timed out after ${timeoutMs}ms${
        last ? ` (last_state=${last.data?.state ?? "unknown"})` : ""
      }`,
    );
  }

  // --- Document & Mirrored Endpoints ---

  /** Ingest a single memory document. POST /memory/documents */
  async insertDocument(
    params: InsertMemoryParams,
  ): Promise<InsertMemoryResponse> {
    this.validateInsertParams(params);
    return this.post<InsertMemoryResponse>("/memory/documents", params);
  }

  /** Ingest multiple memory documents in batch. POST /memory/documents/batch */
  async insertDocumentsBatch(
    params: InsertDocumentsBatchParams,
  ): Promise<InsertDocumentsBatchResponse> {
    if (
      !params.items ||
      !Array.isArray(params.items) ||
      params.items.length === 0
    ) {
      throw new Error("items must be a non-empty array");
    }
    return this.post<InsertDocumentsBatchResponse>(
      "/memory/documents/batch",
      params,
    );
  }

  /** List ingested memory documents. GET /memory/documents */
  async listDocuments(
    params: ListDocumentsParams = {},
  ): Promise<ListDocumentsResponse> {
    const search = new URLSearchParams();
    if (params.namespace) search.append("namespace", params.namespace);
    if (params.limit !== undefined)
      search.append("limit", String(params.limit));
    if (params.offset !== undefined)
      search.append("offset", String(params.offset));
    const qs = search.toString() ? `?${search.toString()}` : "";
    return this.get<ListDocumentsResponse>(`/memory/documents${qs}`);
  }

  /** Get details for a memory document. GET /memory/documents/:documentId */
  async getDocument(params: GetDocumentParams): Promise<GetDocumentResponse> {
    if (!params.documentId) throw new Error("documentId is required");
    const qs = params.namespace
      ? `?namespace=${encodeURIComponent(params.namespace)}`
      : "";
    return this.get<GetDocumentResponse>(
      `/memory/documents/${encodeURIComponent(params.documentId)}${qs}`,
    );
  }

  /** Delete a memory document. DELETE /memory/documents/:documentId */
  async deleteDocument(
    params: DeleteDocumentParams,
  ): Promise<DeleteMemoryResponse> {
    if (!params.documentId) throw new Error("documentId is required");
    if (!params.namespace) throw new Error("namespace is required");
    const qs = `?namespace=${encodeURIComponent(params.namespace)}`;
    return this.delete<DeleteMemoryResponse>(
      `/memory/documents/${encodeURIComponent(params.documentId)}${qs}`,
    );
  }

  /** Get admin graph snapshot. GET /memory/admin/graph-snapshot */
  async getGraphSnapshot(
    params: GetGraphSnapshotParams = {},
  ): Promise<GetGraphSnapshotResponse> {
    const search = new URLSearchParams();
    if (params.namespace) search.append("namespace", params.namespace);
    if (params.mode) search.append("mode", params.mode);
    if (params.limit !== undefined)
      search.append("limit", String(params.limit));
    if (params.seed_limit !== undefined)
      search.append("seed_limit", String(params.seed_limit));
    const qs = search.toString() ? `?${search.toString()}` : "";
    return this.get<GetGraphSnapshotResponse>(
      `/memory/admin/graph-snapshot${qs}`,
    );
  }

  /** Query memory context. POST /memory/queries */
  async queryMemoryContext(
    params: QueryMemoryParams,
  ): Promise<QueryMemoryResponse> {
    this.validateQueryParams(params);
    return this.post<QueryMemoryResponse>("/memory/queries", params);
  }

  /** Chat with memory context. POST /memory/conversations */
  async chatMemoryContext(
    params: ChatMemoryParams,
  ): Promise<ChatMemoryResponse> {
    if (!params.messages || !Array.isArray(params.messages))
      throw new Error("messages array is required");
    return this.post<ChatMemoryResponse>("/memory/conversations", params);
  }

  /** Record interaction signals. POST /memory/interactions */
  async recordInteractions(
    params: InteractMemoryParams,
  ): Promise<InteractMemoryResponse> {
    if (!params.namespace) throw new Error("namespace is required");
    if (!params.entityNames || !Array.isArray(params.entityNames))
      throw new Error("entityNames array is required");
    return this.post<InteractMemoryResponse>("/memory/interactions", params);
  }

  // --- Helpers ---

  private validateInsertParams(params: InsertMemoryParams) {
    if (!params.title || typeof params.title !== "string") {
      throw new Error("title is required and must be a string");
    }
    if (!params.content || typeof params.content !== "string") {
      throw new Error("content is required and must be a string");
    }
    if (!params.namespace || typeof params.namespace !== "string") {
      throw new Error("namespace is required and must be a string");
    }
  }

  private validateQueryParams(params: QueryMemoryParams) {
    if (!params.query || typeof params.query !== "string") {
      throw new Error("query is required and must be a string");
    }
    if (
      params.maxChunks !== undefined &&
      (typeof params.maxChunks !== "number" ||
        params.maxChunks < 1 ||
        params.maxChunks > 200)
    ) {
      throw new Error("maxChunks must be between 1 and 200");
    }
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  private async delete<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new AlphahumanError(
        `HTTP ${res.status}: non-JSON response`,
        res.status,
        text || undefined,
      );
    }
    if (!res.ok) {
      const message = (json as ErrorResponse).error ?? `HTTP ${res.status}`;
      throw new AlphahumanError(message, res.status, json);
    }
    return json as T;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

export default AlphahumanMemoryClient;
