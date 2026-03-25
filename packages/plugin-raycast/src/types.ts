export interface NeocortexLogger {
  info?: (msg: string, data?: unknown) => void;
  warn?: (msg: string, data?: unknown) => void;
  error?: (msg: string, data?: unknown) => void;
}

export interface NeocortexConfig {
  /** Bearer token (API key or JWT) for authentication */
  token: string;
  /** Base URL of the TinyHuman/Neocortex backend. */
  baseUrl?: string;
  /** Optional logger */
  logger?: NeocortexLogger;
}

export interface InsertMemoryParams {
  title: string;
  content: string;
  namespace: string;
  documentId: string;
  sourceType?: "doc" | "chat" | "email";
  metadata?: Record<string, unknown>;
}

export interface QueryMemoryParams {
  query: string;
  namespace?: string;
  maxChunks?: number;
  includeReferences?: boolean;
  documentIds?: string[];
  llmQuery?: string;
}

export interface QueryContextOut {
  entities: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  chunks: Array<Record<string, unknown>>;
}

export interface QueryMemoryResponseData {
  context?: QueryContextOut;
  cached: boolean;
  llmContextMessage?: string;
  response?: string;
  usage?: {
    llm_input_tokens: number;
    llm_output_tokens: number;
    embedding_tokens: number;
    cost_usd: number;
  };
}

export interface QueryMemoryResponse {
  success: boolean;
  data: QueryMemoryResponseData;
}

export interface DeleteMemoryParams {
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

export interface SaveMemoryInput {
  namespace?: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RecallMemoryInput {
  namespace?: string;
  query: string;
  max_chunks?: number;
}

export interface DeleteMemoryInput {
  namespace?: string;
}

