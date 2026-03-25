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

// Tool input shapes (snake_case) matching the Mastra tool surface.
export interface SyncMemoryInput {
  workspace_id: string;
  agent_id: string;
  source?: "startup" | "agent_end";
  files: Array<{
    file_path: string;
    content: string;
    timestamp: string | number;
    hash: string;
  }>;
}

export interface InsertDocumentInput {
  title: string;
  content: string;
  namespace: string;
  source_type?: string;
  metadata?: Record<string, unknown>;
  priority?: string;
  created_at?: number;
  updated_at?: number;
  document_id: string;
}

export interface InsertDocumentsBatchInput {
  items: InsertDocumentInput[];
}

export interface ListDocumentsInput {
  namespace?: string;
  limit?: number;
  offset?: number;
}

export interface GetDocumentInput {
  document_id: string;
  namespace?: string;
}

export interface DeleteDocumentInput {
  document_id: string;
  namespace: string;
}

export interface QueryMemoryContextInput {
  query: string;
  namespace?: string;
  include_references?: boolean;
  max_chunks?: number;
  document_ids?: string[];
  recall_only?: boolean;
  llm_query?: string;
}

export interface ChatMemoryContextInput {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface RecordInteractionsInput {
  namespace: string;
  entity_names: string[];
  description?: string;
  interaction_level?: string;
  interaction_levels?: string[];
  timestamp?: number;
}

export interface RecallThoughtsInput {
  namespace?: string;
  max_chunks?: number;
  temperature?: number;
  randomness_seed?: number;
  persist?: boolean;
  enable_prediction_check?: boolean;
  thought_prompt?: string;
}

export interface ChatMemoryInput extends ChatMemoryContextInput {}

export interface InteractMemoryInput extends RecordInteractionsInput {}

export interface RecallMemoryMasterInput {
  namespace?: string;
  max_chunks?: number;
}

export interface RecallMemoriesInput {
  namespace?: string;
  top_k?: number;
  min_retention?: number;
  as_of?: number;
}

export interface GetIngestionJobInput {
  job_id: string;
}

