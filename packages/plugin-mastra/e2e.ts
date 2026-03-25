/**
 * E2E for plugin-mastra using real Mastra Agent + Neocortex tools.
 *
 * Required env:
 *   TINYHUMANS_API_KEY
 *
 * Optional env:
 *   TINYHUMANS_BASE_URL
 *   OPENAI_API_KEY (recommended so Mastra can run the LLM + call tools)
 *
 * Run from this package directory:
 *   npx tsx e2e.ts
 */

import { Agent } from "@mastra/core/agent";
import { createNeocortexMastraTools } from "./src/index";

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
const OPENAI_API_KEY = getEnv("OPENAI_API_KEY");

if (!TINYHUMANS_API_KEY) {
  throw new Error("Missing TINYHUMANS_API_KEY");
}

const namespace = `mastra-e2e-${Date.now()}`;

async function run() {
  console.log("Mastra plugin E2E");
  console.log("  namespace:", namespace);
  console.log("  TINYHUMANS_BASE_URL:", TINYHUMANS_BASE_URL || "(default)");
  console.log("  OPENAI_API_KEY:", OPENAI_API_KEY ? "set" : "not set");
  console.log("---");

  const {
    neocortexSaveMemory,
    neocortexRecallMemory,
    neocortexDeleteMemory,
    neocortexSyncMemory,
    neocortexInsertDocument,
    neocortexInsertDocumentsBatch,
    neocortexListDocuments,
    neocortexGetDocument,
    neocortexDeleteDocument,
    neocortexQueryMemoryContext,
    neocortexChatMemoryContext,
    neocortexRecordInteractions,
    neocortexRecallThoughts,
    neocortexChatMemory,
    neocortexInteractMemory,
    neocortexRecallMemoryMaster,
    neocortexRecallMemories,
    neocortexGetIngestionJob,
  } =
    createNeocortexMastraTools({
      token: TINYHUMANS_API_KEY,
      baseUrl: TINYHUMANS_BASE_URL || undefined,
      defaultNamespace: namespace,
    });

  const agent = new Agent({
    id: "neocortex-mastra-e2e",
    name: "Neocortex Mastra E2E Agent",
    instructions: [
      "You are a test agent.",
      "When the user states a preference or important fact, call neocortex_save_memory.",
      "When the user asks about past preferences/facts, call neocortex_recall_memory and answer using its context.",
      "Avoid calling neocortex_sync_memory via the LLM; it is exercised via direct tool calls in this E2E.",
      "Keep answers short and direct.",
    ].join("\n"),
    model: "openai/gpt-5.1",
    tools: {
      // Use tool IDs as keys so toolName matches IDs in traces/streams
      [neocortexSaveMemory.id]: neocortexSaveMemory,
      [neocortexRecallMemory.id]: neocortexRecallMemory,
      [neocortexDeleteMemory.id]: neocortexDeleteMemory,
      [neocortexSyncMemory.id]: neocortexSyncMemory,
      [neocortexInsertDocument.id]: neocortexInsertDocument,
      [neocortexInsertDocumentsBatch.id]: neocortexInsertDocumentsBatch,
      [neocortexListDocuments.id]: neocortexListDocuments,
      [neocortexGetDocument.id]: neocortexGetDocument,
      [neocortexDeleteDocument.id]: neocortexDeleteDocument,
      [neocortexQueryMemoryContext.id]: neocortexQueryMemoryContext,
      [neocortexChatMemoryContext.id]: neocortexChatMemoryContext,
      [neocortexRecordInteractions.id]: neocortexRecordInteractions,
      [neocortexRecallThoughts.id]: neocortexRecallThoughts,
      [neocortexChatMemory.id]: neocortexChatMemory,
      [neocortexInteractMemory.id]: neocortexInteractMemory,
      [neocortexRecallMemoryMaster.id]: neocortexRecallMemoryMaster,
      [neocortexRecallMemories.id]: neocortexRecallMemories,
      [neocortexGetIngestionJob.id]: neocortexGetIngestionJob,
    },
  });

  // Turn 1: should trigger neocortex_save_memory
  const msg1 = "Please remember: my preferred drink is coffee.";
  console.log("User:", msg1);
  try {
    const r1 = await agent.generate(msg1, {
      memory: { thread: namespace, resource: "plugin-mastra-e2e" },
    });
    console.log(r1);
    console.log("Agent:", r1.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Agent task 1 failed (best-effort):", msg);
  }

  // Turn 2: should trigger neocortex_recall_memory
  const msg2 = "What is my preferred drink?";
  console.log("\nUser:", msg2);
  try {
    const r2 = await agent.generate(msg2, {
      memory: { thread: namespace, resource: "plugin-mastra-e2e" },
    });
    console.log(r2);
    console.log("Agent:", r2.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Agent task 2 failed (best-effort):", msg);
  }

  console.log("\n---");
  console.log(
    "Next: best-effort tool usage coverage (agent tasks + direct tool calls)."
  );

  const TOOL_EXEC_CONTEXT = {} as any;
  const rawData = (raw: any): any => raw?.data ?? raw;
  function execTool(tool: any, params: any) {
    const execute = tool?.execute as unknown;
    if (typeof execute !== "function") {
      throw new Error("Tool execute missing or not a function");
    }
    return (execute as any)(params, TOOL_EXEC_CONTEXT);
  }

  const docId = `mastra-doc-${Date.now()}`;
  const docBatchId1 = `mastra-doc-batch-1-${Date.now()}`;
  const docBatchId2 = `mastra-doc-batch-2-${Date.now()}`;
  const docContent =
    "Mastra E2E document: my preferred drink is coffee, and I like succinct answers.";

  async function waitForJobCompletion(jobId: string) {
    const startedAt = Date.now();
    const timeoutMs = 30_000;
    const intervalMs = 1_000;

    while (Date.now() - startedAt < timeoutMs) {
      const jobRes = await execTool(neocortexGetIngestionJob, { job_id: jobId });
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

  async function agentTask(label: string, prompt: string) {
    try {
      const r = await agent.generate(prompt, {
        memory: { thread: namespace, resource: "plugin-mastra-e2e" },
      });
      console.log(`${label}:`, r.text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`${label} failed (best-effort):`, msg);
    }
  }

  // Agent-directed tool usage (best-effort; should call additional tools).
  await agentTask(
    "Agent task list_documents",
    `Use the tool neocortex_list_documents with namespace=${JSON.stringify(
      namespace
    )}, limit=5, offset=0. Then summarize the results.`
  );
  await agentTask(
    "Agent task query_memory_context",
    `Use the tool neocortex_query_memory_context with query=${JSON.stringify(
      "What is my preferred drink?"
    )}, namespace=${JSON.stringify(namespace)}, include_references=false, max_chunks=3. Answer using the context returned.`
  );
  // Direct tool calls to deterministically exercise each remaining tool.
  try {
    const insertDocRes = await execTool(neocortexInsertDocument, {
      title: "Mastra E2E Doc",
      content: docContent,
      namespace,
      source_type: "doc",
      document_id: docId,
    });
    const insertRaw = (insertDocRes as any)?.raw ?? insertDocRes;
    const insertData = rawData(insertRaw);
    const jobId: string | undefined =
      insertData?.jobId ?? insertRaw?.jobId;
    const insertState: string | undefined =
      insertData?.state ?? insertRaw?.state;
    console.log("insert_document:", { state: insertState, jobId });

    if (jobId && (insertState?.toLowerCase() ?? "").includes("pending")) {
      console.log("Waiting for ingestion job:", jobId);
      await waitForJobCompletion(jobId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct insert_document failed (best-effort):", msg);
  }

  //Additional agent-directed tool usage (best-effort).
  await agentTask(
    "Agent task chat_memory_context",
    `Use the tool neocortex_chat_memory_context with namespace=${JSON.stringify(
      namespace
    )}, messages=[{role:"user",content:"Answer: what is my preferred drink?"}], temperature=0.2, max_tokens=150.`
  );
  await agentTask(
    "Agent task record_interactions",
    `Use the tool neocortex_record_interactions with namespace=${JSON.stringify(
      namespace
    )}, entity_names=["MAStra-ENTITY-A","MAStra-ENTITY-B"], description="Recorded via plugin-mastra e2e.ts", interaction_level="engage".`
  );
  await agentTask(
    "Agent task recall_thoughts",
    `Use the tool neocortex_recall_thoughts with namespace=${JSON.stringify(
      namespace
    )}, max_chunks=5. Return the thoughts/thought if present.`
  );

  try {
    const batchInsertRes = await execTool(neocortexInsertDocumentsBatch, {
      items: [
        {
          title: "Mastra E2E Batch Doc 1",
          content:
            "Mastra E2E batch document 1: reminder - my preferred drink is coffee.",
          namespace,
          source_type: "doc",
          document_id: docBatchId1,
        },
        {
          title: "Mastra E2E Batch Doc 2",
          content:
            "Mastra E2E batch document 2: memory check - coffee again.",
          namespace,
          source_type: "doc",
          document_id: docBatchId2,
        },
      ],
    });
    console.log(
      "insert_documents_batch:",
      (batchInsertRes as any)?.raw ?? batchInsertRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct insert_documents_batch failed (best-effort):", msg);
  }

  try {
    const listRes = await execTool(neocortexListDocuments, {
      namespace,
      limit: 10,
      offset: 0,
    });
    console.log("list_documents:", (listRes as any)?.raw ?? listRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct list_documents failed (best-effort):", msg);
  }

  try {
    const getDocRes = await execTool(neocortexGetDocument, {
      document_id: docId,
      namespace,
    });
    console.log("get_document:", (getDocRes as any)?.raw ?? getDocRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct get_document failed (best-effort):", msg);
  }

  try {
    const queryRes = await execTool(neocortexQueryMemoryContext, {
      query: "What is my preferred drink?",
      namespace,
      include_references: false,
      max_chunks: 5,
    });
    console.log(
      "query_memory_context:",
      (queryRes as any)?.context ?? queryRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct query_memory_context failed (best-effort):", msg);
  }

  try {
    const chatContextRes = await execTool(neocortexChatMemoryContext, {
      messages: [
        {
          role: "user",
          content:
            "Answer: what is my preferred drink based on stored documents?",
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    });
    console.log(
      "chat_memory_context:",
      (chatContextRes as any)?.content ?? chatContextRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct chat_memory_context failed (best-effort):", msg);
  }

  try {
    const interactionsRes = await execTool(neocortexRecordInteractions, {
      namespace,
      entity_names: ["MAStra-ENTITY-A", "MAStra-ENTITY-B"],
      description: "Recorded via plugin-mastra e2e.ts",
      interaction_level: "engage",
    });
    console.log(
      "record_interactions:",
      (interactionsRes as any)?.raw ?? interactionsRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct record_interactions failed (best-effort):", msg);
  }

  try {
    const thoughtsRes = await execTool(neocortexRecallThoughts, {
      namespace,
      max_chunks: 5,
    });
    console.log(
      "recall_thoughts:",
      (thoughtsRes as any)?.raw?.data?.thought ??
        (thoughtsRes as any)?.raw ??
        thoughtsRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct recall_thoughts failed (best-effort):", msg);
  }

  try {
    const masterRes = await execTool(neocortexRecallMemoryMaster, {
      namespace,
      max_chunks: 5,
    });
    console.log(
      "recall_memory_master:",
      (masterRes as any)?.context ?? masterRes
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct recall_memory_master failed (best-effort):", msg);
  }

  try {
    const memoriesRes = await execTool(neocortexRecallMemories, {
      namespace,
      top_k: 5,
    });
    console.log("recall_memories:", (memoriesRes as any)?.raw ?? memoriesRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct recall_memories failed (best-effort):", msg);
  }

  try {
    const chatRes = await execTool(neocortexChatMemory, {
      messages: [
        {
          role: "user",
          content: "What is my preferred drink?",
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    });
    console.log("chat_memory:", (chatRes as any)?.content ?? chatRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct chat_memory failed (best-effort):", msg);
  }

  try {
    const interactRes = await execTool(neocortexInteractMemory, {
      namespace,
      entity_names: ["MAStra-ENTITY-A"],
      description: "Interacted via plugin-mastra e2e.ts",
      interaction_level: "engage",
    });
    console.log("interact_memory:", (interactRes as any)?.raw ?? interactRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct interact_memory failed (best-effort):", msg);
  }

  // Best-effort admin sync (requires backend understanding of workspace/agent IDs).
  try {
    const syncRes = await execTool(neocortexSyncMemory, {
      workspace_id: "mastra-e2e-workspace",
      agent_id: "mastra-e2e-agent",
      source: "startup",
      files: [],
    });
    console.log("sync_memory:", (syncRes as any)?.raw ?? syncRes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("Direct sync_memory failed (best-effort):", msg);
  }

  // Best-effort cleanup of inserted docs.
  try {
    await execTool(neocortexDeleteDocument, { document_id: docId, namespace });
    console.log("delete_document (docId): ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("delete_document (docId) skipped:", msg);
  }

  try {
    await execTool(neocortexDeleteDocument, {
      document_id: docBatchId1,
      namespace,
    });
    console.log("delete_document (batch doc 1): ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("delete_document (batch doc 1) skipped:", msg);
  }

  try {
    await execTool(neocortexDeleteDocument, {
      document_id: docBatchId2,
      namespace,
    });
    console.log("delete_document (batch doc 2): ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("delete_document (batch doc 2) skipped:", msg);
  }

  try {
    await execTool(neocortexDeleteMemory, { namespace });
    console.log("delete_memory: ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("delete_memory skipped:", msg);
  }
}

run().catch((e) => {
  console.error("E2E failed:", e);
  throw e;
});