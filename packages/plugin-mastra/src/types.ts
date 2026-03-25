export interface NeocortexLogger {
  info?: (msg: string, data?: unknown) => void;
  warn?: (msg: string, data?: unknown) => void;
  error?: (msg: string, data?: unknown) => void;
}

export interface NeocortexConfig {
  /** Bearer token (API key or JWT) for authentication */
  token: string;
  /** Base URL of the Alphahuman/Neocortex backend. */
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

// ----------------------------
// Newer endpoints (aligned with sdk-typescript)
// ----------------------------

export interface SyncFileParams {
  filePath: string;
  content: string;
  timestamp: string;
  hash: string;
}

export interface SyncMemoryParams {
  workspaceId: string;
  agentId: string;
  source?: "startup" | "agent_end";
  files: SyncFileParams[];
}

export interface SyncMemoryResponse {
  success: boolean;
  data: {
    synced?: number;
    jobId?: string;
    state?: string;
  };
}

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
    jobId?: string;
    state?: string;
  };
}

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
    documentId: string;
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

export interface DeleteDocumentResponse {
  success: boolean;
  data: {
    status?: string;
    message?: string;
    nodesDeleted?: number;
    jobId?: string;
    state?: string;
    [key: string]: unknown;
  };
}

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

export interface QueryMemoryContextParams {
  query: string;
  includeReferences?: boolean;
  namespace?: string;
  maxChunks?: number;
  documentIds?: string[];
  recallOnly?: boolean;
  llmQuery?: string;
}

export interface RecallMemoryParams {
  namespace?: string;
  maxChunks?: number;
}

export interface RecallMemoryResponse {
  success: boolean;
  data: QueryMemoryResponseData & {
    latencySeconds?: number;
    counts?: {
      numEntities: number;
      numRelations: number;
      numChunks: number;
    };
  };
}

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

/** A minimal “tool” interface compatible with most TS agent frameworks. */
export interface MastraTool<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: TParams) => Promise<TResult> | TResult;
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

// Tool input shapes (snake_case) for the Mastra tool schemas.
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

export interface GetGraphSnapshotInput {
  namespace?: string;
  mode?: string;
  limit?: number;
  seed_limit?: number;
}

