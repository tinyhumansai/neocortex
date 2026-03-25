import {
  NeocortexConfig,
  InsertMemoryParams,
  InsertDocumentsBatchParams,
  ListDocumentsParams,
  QueryMemoryResponse,
  QueryMemoryParams,
  NeocortexLogger,
} from "./types";

export class NeocortexMemoryClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger?: NeocortexLogger;

  constructor(config: NeocortexConfig) {
    if (!config.token?.trim()) throw new Error("Neocortex token is required");
    
    this.token = config.token;
    this.logger = config.logger;

    const envBase = typeof process !== "undefined" ? process.env.ALPHAHUMAN_BASE_URL : undefined;
    const baseUrl = config.baseUrl ?? envBase ?? "https://staging-api.alphahuman.xyz";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async insertMemory(params: InsertMemoryParams): Promise<{ data: Record<string, unknown> }> {
    this.logger?.info("Neocortex: Inserting memory", { namespace: params.namespace, title: params.title });
    
    const body = {
      title: params.title,
      content: params.content,
      namespace: params.namespace,
      document_id: params.documentId,
      sourceType: params.sourceType ?? "doc",
      metadata: params.metadata ?? {},
    };

    return this.post<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      "/v1/memory/insert",
      body,
    );
  }

  async queryMemory(params: QueryMemoryParams): Promise<QueryMemoryResponse> {
    this.logger?.info("Neocortex: Querying memory", { namespace: params.namespace, query: params.query });

    const body = {
      query: params.query,
      namespace: params.namespace,
      maxChunks: params.maxChunks,
    };

    return this.post<QueryMemoryResponse>("/v1/memory/query", body);
  }

  async insertDocumentsBatch(params: InsertDocumentsBatchParams): Promise<{ data: Record<string, unknown> }> {
    return this.post<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      "/v1/memory/documents/batch",
      { items: params.items },
    );
  }

  async listDocuments(params: ListDocumentsParams): Promise<{ data: Record<string, unknown> }> {
    return this.get<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      "/v1/memory/documents",
      { ...params },
    );
  }

  async getDocument(params: { documentId: string; namespace?: string }): Promise<{ data: Record<string, unknown> }> {
    return this.get<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      `/v1/memory/documents/${encodeURIComponent(params.documentId)}`,
      { namespace: params.namespace },
    );
  }

  async deleteDocument(params: { documentId: string; namespace: string }): Promise<{ data: Record<string, unknown> }> {
    return this.delete<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      `/v1/memory/documents/${encodeURIComponent(params.documentId)}`,
      { namespace: params.namespace },
    );
  }

  async recallMemory(params: { query: string; namespace?: string }): Promise<{ data: Record<string, unknown> }> {
    return this.post<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      "/v1/memory/recall",
      { query: params.query, namespace: params.namespace },
    );
  }

  async recallMemories(params: {
    query: string;
    namespace?: string;
    includeReferences?: boolean;
    maxChunks?: number;
  }): Promise<{ data: Record<string, unknown> }> {
    return this.post<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      "/v1/memory/memories/recall",
      {
        query: params.query,
        namespace: params.namespace,
        includeReferences: params.includeReferences,
        maxChunks: params.maxChunks,
      },
    );
  }

  async getIngestionJob(params: { jobId: string }): Promise<{ data: Record<string, unknown> }> {
    return this.get<{ success: boolean; data: Record<string, unknown>; error?: string }>(
      `/v1/memory/ingestion/jobs/${encodeURIComponent(params.jobId)}`,
    );
  }

  private async post<T>(path: string, body: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
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

      if (!res.ok || json.success === false) {
        const msg = json.error || `HTTP ${res.status}`;
        this.logger?.error(`Neocortex API error: ${msg}`, { status: res.status, body: json });
        throw new Error(msg);
      }

      return json as T;
    } catch (err: any) {
      this.logger?.error(`Neocortex network/request error: ${err.message}`);
      throw err;
    }
  }

  private async get<T>(path: string, queryParams?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(queryParams ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return this.request<T>(url.toString(), "GET");
  }

  private async delete<T>(path: string, queryParams?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(queryParams ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return this.request<T>(url.toString(), "DELETE");
  }

  private async request<T>(url: string, method: "GET" | "DELETE"): Promise<T> {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
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
      if (!res.ok || json.success === false) {
        const msg = json.error || `HTTP ${res.status}`;
        this.logger?.error(`Neocortex API error: ${msg}`, { status: res.status, body: json });
        throw new Error(msg);
      }
      return json as T;
    } catch (err: any) {
      this.logger?.error(`Neocortex network/request error: ${err.message}`);
      throw err;
    }
  }
}
