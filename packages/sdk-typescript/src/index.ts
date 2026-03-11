// Alphahuman Memory SDK for TypeScript
// Aligned with AlphaHuman backend API: insert, query, admin/delete, recall, memories/recall.

const DEFAULT_BASE_URL = 'https://staging-api.alphahuman.xyz';

/** Resolve ALPHAHUMAN_BASE_URL from env when available (e.g. Node). */
function getEnvBaseUrl(): string | undefined {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : (undefined as unknown as Record<string, unknown>);
    const env = (g as { process?: { env?: Record<string, string | undefined> } })?.process?.env;
    return env?.ALPHAHUMAN_BASE_URL;
  } catch {
    return undefined;
  }
}

// ---------- Config ----------

export interface AlphahumanConfig {
  /** Bearer token (API key or JWT) for authentication */
  token: string;
  /** Base URL of the Alphahuman backend. If omitted, uses ALPHAHUMAN_BASE_URL env or default staging URL */
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
  sourceType?: 'doc' | 'chat' | 'email';
  metadata?: Record<string, unknown>;
  priority?: 'high' | 'medium' | 'low';
  createdAt?: number;
  updatedAt?: number;
  documentId?: string;
}

export interface InsertMemoryResponse {
  success: boolean;
  data: {
    status: string;
    stats: Record<string, unknown>;
    usage?: {
      llm_input_tokens: number;
      llm_output_tokens: number;
      embedding_tokens: number;
      cost_usd: number;
    };
  };
}

// ---------- Query ----------

export interface QueryMemoryParams {
  /** Query string (required) */
  query: string;
  includeReferences?: boolean;
  namespace?: string;
  maxChunks?: number;
  documentIds?: string[];
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
    cached: boolean;
    llmContextMessage?: string;
    response?: string;
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
    status: string;
    userId: string;
    namespace?: string;
    nodesDeleted: number;
    message: string;
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
    cached: boolean;
    llmContextMessage?: string;
    response?: string;
    latencySeconds?: number;
    counts?: {
      numEntities: number;
      numRelations: number;
      numChunks: number;
    };
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
    memories: MemoryItemRecalled[];
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
    this.name = 'AlphahumanError';
    this.status = status;
    this.body = body;
  }
}

// ---------- Client ----------

export class AlphahumanMemoryClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: AlphahumanConfig) {
    if (!config.token || !config.token.trim()) throw new Error('token is required');
    const baseUrl = config.baseUrl ?? getEnvBaseUrl() ?? DEFAULT_BASE_URL;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = config.token;
  }

  /** Insert (ingest) a document into memory. POST /v1/memory/insert */
  async insertMemory(params: InsertMemoryParams): Promise<InsertMemoryResponse> {
    if (!params.title || typeof params.title !== 'string') {
      throw new Error('title is required and must be a string');
    }
    if (!params.content || typeof params.content !== 'string') {
      throw new Error('content is required and must be a string');
    }
    if (!params.namespace || typeof params.namespace !== 'string') {
      throw new Error('namespace is required and must be a string');
    }
    const body = {
      title: params.title,
      content: params.content,
      namespace: params.namespace,
      sourceType: params.sourceType ?? 'doc',
      metadata: params.metadata,
      priority: params.priority,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      documentId: params.documentId,
    };
    return this.post<InsertMemoryResponse>('/v1/memory/insert', body);
  }

  /** Query memory via RAG. POST /v1/memory/query */
  async queryMemory(params: QueryMemoryParams): Promise<QueryMemoryResponse> {
    if (!params.query || typeof params.query !== 'string') {
      throw new Error('query is required and must be a string');
    }
    if (
      params.maxChunks !== undefined &&
      (typeof params.maxChunks !== 'number' || params.maxChunks < 1 || params.maxChunks > 200)
    ) {
      throw new Error('maxChunks must be between 1 and 200');
    }
    const body = {
      query: params.query,
      includeReferences: params.includeReferences,
      namespace: params.namespace,
      maxChunks: params.maxChunks,
      documentIds: params.documentIds,
      llmQuery: params.llmQuery,
    };
    return this.post<QueryMemoryResponse>('/v1/memory/query', body);
  }

  /** Delete memory (admin). POST /v1/memory/admin/delete */
  async deleteMemory(params: DeleteMemoryParams = {}): Promise<DeleteMemoryResponse> {
    return this.post<DeleteMemoryResponse>('/v1/memory/admin/delete', {
      namespace: params.namespace,
    });
  }

  /** Recall context from Master node. POST /v1/memory/recall */
  async recallMemory(params: RecallMemoryParams = {}): Promise<RecallMemoryResponse> {
    if (
      params.maxChunks !== undefined &&
      (typeof params.maxChunks !== 'number' || !Number.isInteger(params.maxChunks) || params.maxChunks <= 0)
    ) {
      throw new Error('maxChunks must be a positive integer');
    }
    return this.post<RecallMemoryResponse>('/v1/memory/recall', {
      namespace: params.namespace,
      maxChunks: params.maxChunks,
    });
  }

  /** Recall memories from Ebbinghaus bank. POST /v1/memory/memories/recall */
  async recallMemories(params: RecallMemoriesParams = {}): Promise<RecallMemoriesResponse> {
    if (
      params.topK !== undefined &&
      (typeof params.topK !== 'number' || !Number.isFinite(params.topK) || params.topK <= 0)
    ) {
      throw new Error('topK must be a positive number');
    }
    if (
      params.minRetention !== undefined &&
      (typeof params.minRetention !== 'number' || !Number.isFinite(params.minRetention) || params.minRetention < 0)
    ) {
      throw new Error('minRetention must be a non-negative number');
    }
    return this.post<RecallMemoriesResponse>('/v1/memory/memories/recall', {
      namespace: params.namespace,
      topK: params.topK,
      minRetention: params.minRetention,
      asOf: params.asOf,
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
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
        text || undefined
      );
    }
    if (!res.ok) {
      const message = (json as ErrorResponse).error ?? `HTTP ${res.status}`;
      throw new AlphahumanError(message, res.status, json);
    }
    return json as T;
  }
}

export default AlphahumanMemoryClient;
