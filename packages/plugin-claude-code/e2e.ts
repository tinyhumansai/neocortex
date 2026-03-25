/**
 * E2E for plugin-claude-code using real Neocortex memory.
 *
 * Required env:
 *   TINYHUMANS_API_KEY
 *
 * Optional env:
 *   TINYHUMANS_BASE_URL
 *
 * Run from this package directory:
 *   npx tsx e2e.ts
 */
import { ClaudeCodeNeocortexMemory } from "./src/index";

function getEnv(name: string): string {
  try {
    const g =
      typeof globalThis !== "undefined"
        ? globalThis
        : ((undefined as unknown) as Record<string, unknown>);
    const env = (g as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    return env?.[name] ?? "";
  } catch {
    return "";
  }
}

const TINYHUMANS_API_KEY = getEnv("TINYHUMANS_API_KEY");
const TINYHUMANS_BASE_URL = getEnv("TINYHUMANS_BASE_URL");

if (!TINYHUMANS_API_KEY) {
  throw new Error("Missing TINYHUMANS_API_KEY");
}

const namespace = `claude-code-e2e-${Date.now()}`;

function parseJobId(text: string): string | null {
  if (!text) return null;
  const m1 = text.match(/jobId['"]?\s*[:=]\s*['"]?([a-zA-Z0-9_-]+)/);
  if (m1?.[1]) return m1[1];
  const m2 = text.match(/job_id['"]?\s*[:=]\s*['"]?([a-zA-Z0-9_-]+)/);
  if (m2?.[1]) return m2[1];
  return null;
}

async function run() {
  console.log("Claude Code plugin E2E");
  console.log("  namespace:", namespace);
  console.log("  TINYHUMANS_BASE_URL:", TINYHUMANS_BASE_URL || "(default)");
  console.log("---");

  const memory = new ClaudeCodeNeocortexMemory({
    token: TINYHUMANS_API_KEY,
    baseUrl: TINYHUMANS_BASE_URL || undefined,
    defaultNamespace: namespace,
  });

  // Phase 1: save + recall (keep for later cleanup)
  console.log("Phase 1: saveMemory / recallMemory");
  const saveResult = await memory.saveMemory({
    namespace,
    key: "preferred_drink",
    content: "The user's preferred drink is coffee.",
    metadata: { source: "plugin-claude-code-e2e" },
  });
  console.log("saveMemory result:", saveResult);

  const recallResult = await memory.recallMemory({
    namespace,
    query: "What is the user's preferred drink?",
    max_chunks: 5,
  });
  console.log("recallMemory result:", {
    ok: recallResult.ok,
    namespace: recallResult.namespace,
    contextPreview: recallResult.context.slice(0, 200),
  });

  // Phase 2: document ops (single + batch)
  console.log("\nPhase 2: document ops");
  const docId = `claude-code-doc-${Date.now()}`;
  const batchDocId1 = `claude-code-batch-doc-1-${Date.now()}`;
  const batchDocId2 = `claude-code-batch-doc-2-${Date.now()}`;

  let insertDocumentRaw: any = null;
  let insertBatchRaw: any = null;

  try {
    const insertDocRes = await memory.insertDocument({
      title: "Claude Code E2E Doc",
      content: "Claude Code E2E document: preferred drink is coffee.",
      namespace,
      source_type: "doc",
      metadata: { source: "plugin-claude-code-e2e" },
      priority: "low",
      document_id: docId,
      created_at: undefined,
      updated_at: undefined,
    });
    insertDocumentRaw = insertDocRes.raw;
    console.log("insertDocument result: (raw preview)", JSON.stringify(insertDocumentRaw).slice(0, 400));
  } catch (e) {
    console.log("insertDocument failed (best-effort):", e);
  }

  try {
    const insertBatchRes = await memory.insertDocumentsBatch({
      items: [
        {
          title: "Claude Code Batch Doc 1",
          content: "Batch doc 1: coffee reminder.",
          namespace,
          source_type: "doc",
          metadata: { source: "plugin-claude-code-e2e" },
          priority: "low",
          document_id: batchDocId1,
        },
        {
          title: "Claude Code Batch Doc 2",
          content: "Batch doc 2: coffee again.",
          namespace,
          source_type: "doc",
          metadata: { source: "plugin-claude-code-e2e" },
          priority: "low",
          document_id: batchDocId2,
        },
      ],
    });
    insertBatchRaw = insertBatchRes.raw;
    console.log("insertDocumentsBatch result: (raw preview)", JSON.stringify(insertBatchRaw).slice(0, 400));
  } catch (e) {
    console.log("insertDocumentsBatch failed (best-effort):", e);
  }

  try {
    const listRes = await memory.listDocuments({ namespace, limit: 10, offset: 0 });
    console.log("listDocuments (raw preview):", JSON.stringify(listRes.raw).slice(0, 300));
  } catch (e) {
    console.log("listDocuments failed (best-effort):", e);
  }

  try {
    const getRes = await memory.getDocument({ document_id: docId, namespace });
    console.log("getDocument (raw preview):", JSON.stringify(getRes.raw).slice(0, 300));
  } catch (e) {
    console.log("getDocument failed (best-effort):", e);
  }

  try {
    const queryCtxRes = await memory.queryMemoryContext({
      query: "What is the user's preferred drink?",
      namespace,
      include_references: false,
      max_chunks: 5,
      document_ids: [docId],
      recall_only: false,
      llm_query: undefined,
    });
    console.log("queryMemoryContext:", queryCtxRes.context.slice(0, 300));
  } catch (e) {
    console.log("queryMemoryContext failed (best-effort):", e);
  }

  try {
    const chatCtxRes = await memory.chatMemoryContext({
      messages: [{ role: "user", content: "Answer: what is my preferred drink?" }],
      temperature: 0.2,
      max_tokens: 150,
    });
    console.log("chatMemoryContext (content preview):", chatCtxRes.content.slice(0, 250));
  } catch (e) {
    console.log("chatMemoryContext failed (best-effort):", e);
  }

  // Phase 3: interactions + thoughts + chat/interact
  console.log("\nPhase 3: interactions + thoughts + chat/interact");
  try {
    const res = await memory.recordInteractions({
      namespace,
      entity_names: ["ClaudeCode-ENTITY-A", "ClaudeCode-ENTITY-B"],
      description: "Recorded via plugin-claude-code-e2e",
      interaction_level: "engage",
      timestamp: undefined,
    });
    console.log("recordInteractions raw preview:", JSON.stringify(res.raw).slice(0, 250));
  } catch (e) {
    console.log("recordInteractions failed (best-effort):", e);
  }

  try {
    const res = await memory.recallThoughts({
      namespace,
      max_chunks: 5,
      temperature: 0.2,
      randomness_seed: 1,
      persist: false,
      enable_prediction_check: false,
      thought_prompt: undefined,
    });
    console.log("recallThoughts thought preview:", (res.thought ?? "").slice(0, 250));
  } catch (e) {
    console.log("recallThoughts failed (best-effort):", e);
  }

  try {
    const res = await memory.chatMemory({
      messages: [{ role: "user", content: "What is my preferred drink?" }],
      temperature: 0.2,
      max_tokens: 150,
    });
    console.log("chatMemory (content preview):", res.content.slice(0, 250));
  } catch (e) {
    console.log("chatMemory failed (best-effort):", e);
  }

  try {
    const res = await memory.interactMemory({
      namespace,
      entity_names: ["ClaudeCode-ENTITY-A"],
      description: "Interacted via plugin-claude-code-e2e",
      interaction_level: "engage",
      timestamp: undefined,
    });
    console.log("interactMemory raw preview:", JSON.stringify(res.raw).slice(0, 250));
  } catch (e) {
    console.log("interactMemory failed (best-effort):", e);
  }

  // Phase 4: master/memories + ingestion job (if job_id can be inferred)
  console.log("\nPhase 4: master/memories + ingestion job");
  try {
    const res = await memory.recallMemoryMaster({ namespace, max_chunks: 5 });
    console.log("recallMemoryMaster context preview:", res.context.slice(0, 250));
  } catch (e) {
    console.log("recallMemoryMaster failed (best-effort):", e);
  }

  try {
    const res = await memory.recallMemories({
      namespace,
      top_k: 5,
      min_retention: undefined,
      as_of: undefined,
    });
    console.log("recallMemories raw preview:", JSON.stringify(res.raw).slice(0, 250));
  } catch (e) {
    console.log("recallMemories failed (best-effort):", e);
  }

  const jobId =
    parseJobId(JSON.stringify(insertDocumentRaw ?? {})) ||
    parseJobId(JSON.stringify(insertBatchRaw ?? {}));
  if (jobId) {
    try {
      const res = await memory.getIngestionJob({ job_id: jobId });
      console.log("getIngestionJob raw:", JSON.stringify(res.raw).slice(0, 450));
    } catch (e) {
      console.log("getIngestionJob failed (best-effort):", e);
    }
  } else {
    console.log("getIngestionJob skipped (jobId not found in insert responses).");
  }

  // Phase 5: optional syncMemory
  console.log("\nPhase 5: syncMemory (optional)");
  const workspaceId = getEnv("WORKSPACE_ID");
  const agentId = getEnv("AGENT_ID");
  if (workspaceId && agentId) {
    try {
      const res = await memory.syncMemory({
        workspace_id: workspaceId,
        agent_id: agentId,
        source: "startup",
        files: [
          {
            file_path: "claude-code-e2e-example.ts",
            content: "E2E syncMemory content (generated).",
            timestamp: Date.now(),
            hash: "claude-code-e2e-hash",
          },
        ],
      });
      console.log("syncMemory raw preview:", JSON.stringify(res.raw).slice(0, 300));
    } catch (e) {
      console.log("syncMemory failed (best-effort):", e);
    }
  } else {
    console.log("syncMemory skipped (set WORKSPACE_ID + AGENT_ID to enable).");
  }

  // Phase 6: cleanup
  console.log("\nPhase 6: cleanup (delete_document + delete_memory)");
  try {
    await memory.deleteDocument({ document_id: docId, namespace });
    console.log("deleteDocument (doc) done");
  } catch (e) {
    console.log("deleteDocument (doc) skipped:", e);
  }

  try {
    await memory.deleteDocument({ document_id: batchDocId1, namespace });
    console.log("deleteDocument (batch doc 1) done");
  } catch (e) {
    console.log("deleteDocument (batch doc 1) skipped:", e);
  }

  try {
    await memory.deleteDocument({ document_id: batchDocId2, namespace });
    console.log("deleteDocument (batch doc 2) done");
  } catch (e) {
    console.log("deleteDocument (batch doc 2) skipped:", e);
  }

  try {
    const deleteResult = await memory.deleteMemory({ namespace });
    console.log("deleteMemory result:", deleteResult);
  } catch (e) {
    console.log("deleteMemory failed (best-effort):", e);
  }

  console.log("\n---");
  console.log(
    "If results look wrong, verify TINYHUMANS_API_KEY / TINYHUMANS_BASE_URL and try again."
  );
}

run().catch((e) => {
  console.error("E2E failed:", e);
  throw e;
});

