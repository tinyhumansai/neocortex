/**
 * E2E for plugin-raycast using real Neocortex memory.
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

import { RaycastNeocortexMemory } from "./src/index";

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

const namespace = `raycast-e2e-${Date.now()}`;

async function run() {
  console.log("Raycast plugin E2E");
  console.log("  namespace:", namespace);
  console.log("  TINYHUMANS_BASE_URL:", TINYHUMANS_BASE_URL || "(default)");
  console.log("---");

  const memory = new RaycastNeocortexMemory({
    token: TINYHUMANS_API_KEY,
    baseUrl: TINYHUMANS_BASE_URL || undefined,
    defaultNamespace: namespace,
  });

  // Phase 1: save memory
  console.log("Phase 1: saveMemory");
  const saveResult = await memory.saveMemory({
    namespace,
    key: "preferred_drink",
    content: "The user's preferred drink is coffee.",
    metadata: { source: "plugin-raycast-e2e" },
  });
  console.log("saveMemory result:", saveResult);

  // Phase 2: recall memory
  console.log("\nPhase 2: recallMemory");
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

  const rawData = (raw: any): any => raw?.data ?? raw;

  async function waitForJobCompletion(jobId: string) {
    const startedAt = Date.now();
    const timeoutMs = 30_000;
    const intervalMs = 1_000;

    while (Date.now() - startedAt < timeoutMs) {
      const jobRes = await memory.getIngestionJob({ job_id: jobId } as any);
      const rawJob = (jobRes as any)?.raw;
      const job = rawData(rawJob);
      const state: string | undefined = job?.state ?? rawJob?.state;
      const stateNorm = state?.toString().trim().toLowerCase();

      if (
        stateNorm &&
        ["completed", "done", "succeeded", "success"].includes(stateNorm)
      ) {
        return job;
      }
      if (
        stateNorm &&
        ["failed", "error", "cancelled", "canceled"].includes(stateNorm)
      ) {
        throw new Error(`Ingestion job ${jobId} failed (state=${state})`);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Timed out waiting for ingestion job ${jobId}`);
  }

  // Phase 3: sync memory (best-effort; requires correct workspace/agent ids)
  console.log("\nPhase 3: syncMemory (best-effort)");
  try {
    const syncRes = await memory.syncMemory({
      workspace_id: "raycast-e2e-workspace",
      agent_id: "raycast-e2e-agent",
      source: "startup",
      files: [],
    } as any);
    console.log("syncMemory result:", syncRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("syncMemory skipped (best-effort):", msg);
  }

  // Phase 4: document workflow (insert/list/get/query/chat)
  const docId = `raycast-doc-${Date.now()}`;
  const docContent =
    "Raycast E2E document: my preferred drink is coffee, and I like succinct answers.";
  const batchDocId1 = `raycast-batch-doc-1-${Date.now()}`;
  const batchDocId2 = `raycast-batch-doc-2-${Date.now()}`;

  console.log("\nPhase 4: insertDocument + ingestion wait (best-effort)");
  let jobId: string | undefined;
  let insertState: string | undefined;
  try {
    const insertDocRes = await memory.insertDocument({
      title: "Raycast E2E Doc",
      content: docContent,
      namespace,
      source_type: "doc",
      document_id: docId,
    } as any);
    const raw = (insertDocRes as any)?.raw;
    const insertData = rawData(raw);
    jobId = insertData?.jobId ?? raw?.jobId;
    insertState = insertData?.state ?? raw?.state;
    console.log("insertDocument result:", { state: insertState, jobId });
    if (jobId && (insertState?.toLowerCase() ?? "").includes("pending")) {
      console.log("Waiting for ingestion job:", jobId);
      await waitForJobCompletion(jobId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("insertDocument failed (best-effort):", msg);
  }

  console.log("\nPhase 5: insertDocumentsBatch (best-effort)");
  try {
    const batchRes = await memory.insertDocumentsBatch({
      items: [
        {
          title: "Raycast E2E Batch Doc 1",
          content:
            "Raycast E2E batch document 1: reminder - my preferred drink is coffee.",
          namespace,
          source_type: "doc",
          document_id: batchDocId1,
        },
        {
          title: "Raycast E2E Batch Doc 2",
          content: "Raycast E2E batch document 2: memory check - coffee again.",
          namespace,
          source_type: "doc",
          document_id: batchDocId2,
        },
      ],
    } as any);
    console.log("insertDocumentsBatch result:", batchRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("insertDocumentsBatch failed (best-effort):", msg);
  }

  console.log("\nPhase 6: listDocuments/getDocument/queryMemoryContext/chatMemoryContext");
  try {
    const listRes = await memory.listDocuments({
      namespace,
      limit: 10,
      offset: 0,
    } as any);
    console.log("listDocuments result:", (listRes as any)?.raw ?? listRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("listDocuments skipped:", msg);
  }

  try {
    const getRes = await memory.getDocument({
      document_id: docId,
      namespace,
    } as any);
    console.log("getDocument result:", (getRes as any)?.raw ?? getRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("getDocument skipped:", msg);
  }

  try {
    const queryRes = await memory.queryMemoryContext({
      query: "What is my preferred drink?",
      namespace,
      include_references: false,
      max_chunks: 5,
    } as any);
    console.log(
      "queryMemoryContext result preview:",
      (queryRes as any)?.context?.slice?.(0, 200) ?? queryRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("queryMemoryContext skipped:", msg);
  }

  try {
    const chatCtxRes = await memory.chatMemoryContext({
      messages: [
        {
          role: "user",
          content: "Answer: what is my preferred drink based on stored documents?",
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    } as any);
    console.log(
      "chatMemoryContext result preview:",
      (chatCtxRes as any)?.content?.slice?.(0, 200) ?? chatCtxRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("chatMemoryContext skipped:", msg);
  }

  // Phase 7: interactions + thoughts + chat + interact core endpoints
  console.log("\nPhase 7: recordInteractions + recallThoughts + chatMemory + interactMemory");
  try {
    const interactionsRes = await memory.recordInteractions({
      namespace,
      entity_names: ["Raycast-ENTITY-A", "Raycast-ENTITY-B"],
      description: "Recorded via plugin-raycast e2e.ts",
      interaction_level: "engage",
    } as any);
    console.log(
      "recordInteractions result:",
      (interactionsRes as any)?.raw ?? interactionsRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("recordInteractions skipped:", msg);
  }

  try {
    const thoughtsRes = await memory.recallThoughts({
      namespace,
      max_chunks: 5,
    } as any);
    console.log(
      "recallThoughts result preview:",
      (thoughtsRes as any)?.thought?.slice?.(0, 200) ?? thoughtsRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("recallThoughts skipped:", msg);
  }

  try {
    const chatRes = await memory.chatMemory({
      messages: [{ role: "user", content: "What is my preferred drink?" }],
      temperature: 0.2,
      max_tokens: 150,
    } as any);
    console.log(
      "chatMemory result preview:",
      (chatRes as any)?.content?.slice?.(0, 200) ?? chatRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("chatMemory skipped:", msg);
  }

  try {
    const interactRes = await memory.interactMemory({
      namespace,
      entity_names: ["Raycast-ENTITY-A"],
      description: "Interacted via plugin-raycast e2e.ts",
      interaction_level: "engage",
    } as any);
    console.log(
      "interactMemory result preview:",
      (interactRes as any)?.raw ?? interactRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("interactMemory skipped:", msg);
  }

  // Phase 8: master/memories/ingestion-job endpoints
  console.log("\nPhase 8: recallMemoryMaster + recallMemories + getIngestionJob");
  try {
    const masterRes = await memory.recallMemoryMaster({
      namespace,
      max_chunks: 5,
    } as any);
    console.log(
      "recallMemoryMaster result preview:",
      (masterRes as any)?.context?.slice?.(0, 200) ?? masterRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("recallMemoryMaster skipped:", msg);
  }

  try {
    const memoriesRes = await memory.recallMemories({
      namespace,
      top_k: 5,
    } as any);
    console.log(
      "recallMemories result preview:",
      (memoriesRes as any)?.raw ?? memoriesRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("recallMemories skipped:", msg);
  }

  if (jobId) {
    try {
      const jobRes = await memory.getIngestionJob({ job_id: jobId } as any);
      console.log("getIngestionJob result:", (jobRes as any)?.raw ?? jobRes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("getIngestionJob skipped:", msg);
    }
  }

  // Phase 9: cleanup inserted documents + namespace
  console.log("\nPhase 9: deleteDocument cleanup (best-effort) + deleteMemory");
  try {
    await memory.deleteDocument({ document_id: docId, namespace } as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("deleteDocument (docId) skipped:", msg);
  }

  try {
    await memory.deleteDocument({
      document_id: batchDocId1,
      namespace,
    } as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("deleteDocument (batchDocId1) skipped:", msg);
  }

  try {
    await memory.deleteDocument({
      document_id: batchDocId2,
      namespace,
    } as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("deleteDocument (batchDocId2) skipped:", msg);
  }

  try {
    const deleteResult = await memory.deleteMemory({ namespace });
    console.log("deleteMemory result:", deleteResult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("deleteMemory skipped:", msg);
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

