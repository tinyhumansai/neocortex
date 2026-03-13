export type Primitive = string | number | boolean | null;

export interface NeocortexConfig {
  /** Bearer token (API key or JWT) for authentication */
  token: string;
  /** Base URL of the Neocortex backend. */
  baseUrl?: string;
  /** Optional logger for production tracking */
  logger?: NeocortexLogger;
}

export interface NeocortexLogger {
  info: (msg: string, data?: any) => void;
  error: (msg: string, err?: any) => void;
}

export interface InsertMemoryParams {
  title: string;
  content: string;
  namespace: string;
  sourceType?: "doc" | "chat" | "email";
  metadata?: Record<string, unknown>;
}

export interface QueryMemoryParams {
  query: string;
  namespace?: string;
  maxChunks?: number;
}

export interface QueryContextOut {
  entities: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  chunks: Array<Record<string, unknown>>;
}

export interface QueryMemoryResponseData {
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
}

export interface QueryMemoryResponse {
  success: boolean;
  data: QueryMemoryResponseData;
}

export interface SaveMemoryRequest {
  user_id?: string;
  conversation_id?: string;
  phone_number?: string;
  namespace?: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RecallMemoryRequest {
  user_id?: string;
  conversation_id?: string;
  phone_number?: string;
  namespace?: string;
  query: string;
  max_chunks?: number;
}

export type NamespaceStrategy = (input: {
  userId?: string;
  conversationId?: string;
  phoneNumber?: string;
  explicitNamespace?: string;
}) => string;
