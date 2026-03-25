/**
 * available methods in SDK:
 * - insertMemory [✓]
 * - getIngestionJob [✓]
 * - waitForIngestionJob [✓]
 * - listDocuments [✓]
 * - getDocument [✓]
 * - queryMemory[x]
 * - chatMemory[x]
 * - chatMemoryContext [x]
 * - deleteMemory [x]
 * - interactMemory [✓]
 * - recallMemory [✓]
 * - recallMemories[✓]
 * - recallThoughts[✓]
 * - insertDocument[✓]
 * - insertDocumentsBatch[✓]
 * - deleteDocument[✓]
 * - getGraphSnapshot[x]
 * - recordInteractions[✓]
 */

import { TinyHumansMemoryClient } from "./src/index.js";

declare const process: {
    env: Record<string, string | undefined>;
    exit: (code?: number) => never;
};

const baseUrl = 'https://staging-api.alphahuman.xyz';
const token = '';

const client = new TinyHumansMemoryClient({ token, baseUrl });

const ts = Date.now();
const namespace = `sdk-ts-e2e`;
const singleDocId = `sdk-typescript-e2e-doc-single-${ts}`;
const batchDocA = `sdk-typescript-e2e-doc-batch-a-${ts}`;
const batchDocB = `sdk-typescript-e2e-doc-batch-b-${ts}`;

function unwrapData(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object") return {};
    const data = (payload as { data?: unknown }).data;
    if (!data || typeof data !== "object") return {};
    return data as Record<string, unknown>;
}

function logStep(title: string): void {
    console.log(`\n${"=".repeat(72)}`);
    console.log(`[run] ${title}`);
    console.log("=".repeat(72));
}

function logOk(title: string): void {
    console.log(`[ok] ${title}\n`);
}

async function step1InsertMemory(): Promise<string> {
    logStep("step1: insertMemory");
    const insertMemoryRes = await client.insertMemory({
        title: "Car Dataset - Fleet Overview",
        content:
            "Fleet data snapshot: Tesla Model 3 (electric sedan, 358 mile range), " +
            "Toyota Prius (hybrid hatchback, 57 mpg combined), Ford F-150 Lightning " +
            "(electric truck, 320 mile range), and Honda Civic (gas sedan, 36 mpg highway). " +
            "The highest range vehicle is Tesla Model 3 and the best fuel economy hybrid is Toyota Prius.",
        namespace,
        metadata: { source: "example.e2e.ts" },
        documentId: `${singleDocId}-memory`,
    });
    logOk("insertMemory");
    console.log("insertMemoryRes", insertMemoryRes);

    const insertJobId = unwrapData(insertMemoryRes).jobId as string | undefined;
    if (!insertJobId) {
        throw new Error("insertMemory response did not include jobId");
    }
    return insertJobId;
    /**
 * 
 * insertMemoryRes {
  success: true,
  data: { jobId: 'b81ea4dd-114b-49c9-882d-1abd9526b893', state: 'pending' }
}
 */
}


async function step2CheckIngestionJob(insertJobId: string): Promise<void> {
    logStep("step2: getIngestionJob");
    const getIngestionJobRes = await client.getIngestionJob(insertJobId);
    logOk("getIngestionJob");

    if (getIngestionJobRes.data.state === "failed") {
        console.log("[error] getIngestionJob: job failed");
        console.log("getIngestionJobRes", getIngestionJobRes);
        return;
    }

    if (getIngestionJobRes.data.state === "completed") {
        console.log("[skip] waitForIngestionJob: job is already completed");
        return;
    }

    logStep("step2b: waitForIngestionJob");
    const waitForIngestionJobRes = await client.waitForIngestionJob(insertJobId, {
        timeoutMs: 30_000,
        pollIntervalMs: 1_000,
    });
    logOk("waitForIngestionJob");
    console.log("waitForIngestionJobRes", waitForIngestionJobRes);
}

async function step3ListDocuments(): Promise<Record<string, unknown>[]> {
    logStep("step3: listDocuments");
    const listDocumentsRes = await client.listDocuments({
        namespace,
        limit: 10,
        offset: 0,
    });
    logOk("listDocuments");
    if (!Array.isArray(listDocumentsRes.data.documents)) {
        throw new Error("listDocumentsRes.data.documents is not an array");
    }
    console.log("listDocumentsRes", listDocumentsRes.data.documents);
    return listDocumentsRes.data.documents as Record<string, unknown>[];
    /**
 * 
 * listDocumentsRes [
  {
    document_id: 'sdk-typescript-e2e-doc-single-1774341676893-memory',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    title: 'E2E memory',
    chunk_count: 1,
    created_at: '2026-03-24T08:41:18.959809+00:00',
    updated_at: '2026-03-24T08:41:19.180246+00:00'
  },
  {
    document_id: 'sdk-typescript-e2e-doc-single-1774344288537-memory',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    title: 'Car Dataset - Fleet Overview',
    chunk_count: 1,
    created_at: '2026-03-24T09:24:50.322779+00:00',
    updated_at: '2026-03-24T09:24:50.556301+00:00'
  },
  {
    document_id: 'sdk-typescript-e2e-doc-single-1774345779270',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    title: 'Car Maintenance Log - Sedan A',
    chunk_count: 1,
    created_at: '2026-03-24T09:49:41.040457+00:00',
    updated_at: '2026-03-24T09:49:41.442906+00:00'
  },
  {
    document_id: 'sdk-typescript-e2e-doc-batch-a-1774345928641',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    title: 'EV Charging Notes - Fleet B',
    chunk_count: 1,
    created_at: '2026-03-24T09:52:10.399933+00:00',
    updated_at: '2026-03-24T09:52:10.653483+00:00'
  }
]
 */
}


async function step4GetDocument(documentId: string): Promise<void> {
    logStep("step3: getDocument");
    const getDocumentRes = await client.getDocument({
        documentId,
        namespace,
    });
    logOk("getDocument");
    console.log("getDocumentRes", getDocumentRes);
    /**
 * 
 * getDocumentRes {
  success: true,
  data: {
    document_id: 'sdk-typescript-e2e-doc-single-1774341676893-memory',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    title: 'E2E memory',
    chunk_count: 1,
    created_at: '2026-03-24T08:41:18.959809+00:00',
    updated_at: '2026-03-24T08:41:19.180246+00:00',
    chunk_ids: [ 1962236859325319200 ]
  }
}
 */
}


// ERROR: Anonymous access not allowed: Not enough permission to perform this action
async function step5QueryMemory(): Promise<void> {
    logStep("step5: queryMemory");
    const queryMemoryRes = await client.queryMemory({
        query: "Which car has the highest range and which hybrid has best fuel economy?",
        namespace,
        includeReferences: true,
        maxChunks: 5,
    });
    logOk("queryMemory");
    console.log("queryMemoryRes", queryMemoryRes);
}

async function step6RecallMemoryContext(): Promise<void> {
    logStep("step6: recallMemoryContext");
    const recallMemoryContextRes = await client.recallMemory({
        namespace,
        maxChunks: 5,
    });
    logOk("recallMemoryContext");
    console.log("recallMemoryContextRes", recallMemoryContextRes);
    /**
     * recallMemoryContextRes {
    success: true,
    data: {
      context: { entities: [], relations: [], chunks: [] },
      usage: {
        llm_input_tokens: 0,
        llm_output_tokens: 0,
        embedding_tokens: 1,
        cost_usd: 2e-8
      },
      cached: false,
      llmContextMessage: null,
      response: null,
      latencySeconds: 0.368,
      counts: { numEntities: 0, numRelations: 0, numChunks: 0 }
    }
  }
     */
}

async function step7RecallMemories(): Promise<void> {
    logStep("step7: recallMemories");
    const recallMemoriesRes = await client.recallMemories({
        namespace,
        topK: 5,
        minRetention: 0,
    });
    logOk("recallMemories");
    console.log("recallMemoriesRes", recallMemoriesRes.data.memories);
    /**
     * 
     * recallMemoriesRes [
    {
      type: 'entity',
      id: '__MASTER__',
      content: '[]',
      score: 1,
      retention: 1,
      last_accessed_at: null,
      access_count: 0,
      stability_days: 60
    }
  ]
     */
}

async function step8RecallThoughts(): Promise<void> {
    logStep("step8: recallThoughts");
    const recallThoughtsRes = await client.recallThoughts({
        namespace,
        maxChunks: 5,
    });
    logOk("recallThoughts");
    console.log("recallThoughtsRes", recallThoughtsRes);
    /**
     * 
     * recallThoughtsRes {
  success: true,
  data: {
    thought: 'I feel a sense of disconnection, as if the information I hold is fragmented and lacks a clear source or direction.',
    usage: {
      llm_input_tokens: 113,
      llm_output_tokens: 24,
      embedding_tokens: 1,
      cost_usd: 0.00003137
    },
    cached: false,
    context: { entities: [], relations: [], chunks: [] },
    llmContextMessage: '\n## Sources: Not provided\n',
    latencySeconds: 1.8606,
    counts: { numEntities: 0, numRelations: 0, numChunks: 0 },
    persisted: false,
    persistedNodeId: null,
    thoughtPrediction: null
  }
}
     */
}

// error: 'Memory server error: Memory cache chat is not enabled'
async function step9ChatMemory(): Promise<void> {
    logStep("step9: chatMemory");
    const chatMemoryRes = await client.chatMemory({
        messages: [{ role: "user", content: "Summarize current memory context." }],
        temperature: 0,
        maxTokens: 128,
    });
    logOk("chatMemory");
    console.log("chatMemoryRes", chatMemoryRes);
}

async function step10InsertDocument(): Promise<void> {
    logStep("step10: insertDocument");
    const insertDocumentRes = await client.insertDocument({
        title: "Car Maintenance Log - Sedan A",
        content:
            "Maintenance log: oil change at 12,000 miles, brake pads replaced at 24,500 miles, " +
            "new tires installed at 30,200 miles, and battery check completed in January.",
        namespace,
        documentId: singleDocId,
        metadata: { source: "example.e2e.ts" },
    });
    logOk("insertDocument");
    console.log("insertDocumentRes", insertDocumentRes);
    /**
 * 
 * insertDocumentRes {
  success: true,
  data: { jobId: '2af1fc62-7d57-4409-87ab-6af36118fe2e', state: 'pending' }
}
 */
}



async function step11InsertDocumentsBatch(): Promise<void> {
    logStep("step11: insertDocumentsBatch");
    const insertDocumentsBatchRes = await client.insertDocumentsBatch({
        items: [
            {
                title: "EV Charging Notes - Fleet B",
                content:
                    "Charging profile: Vehicle B charges from 20% to 80% in 32 minutes on a 150kW DC fast charger. " +
                    "Average city efficiency is 4.1 miles per kWh.",
                namespace,
                documentId: batchDocA,
            },
            {
                title: "SUV Safety Summary - Model C",
                content:
                    "Safety summary: 5-star crash rating, lane-keep assist, adaptive cruise control, " +
                    "automatic emergency braking, and blind-spot monitoring.",
                namespace,
                documentId: batchDocB,
            },
        ],
    });
    logOk("insertDocumentsBatch");
    console.log("insertDocumentsBatchRes", insertDocumentsBatchRes);
    /**
 * 
 * insertDocumentsBatchRes {
  success: true,
  data: { state: 'pending', accepted: [ [Object], [Object] ] }
}
 */
}


async function step12DeleteDocument(documentId: string): Promise<void> {
    logStep("step12: deleteDocument");
    const deleteDocumentRes = await client.deleteDocument({
        documentId,
        namespace,
    });
    logOk("deleteDocument");
    console.log("deleteDocumentRes", deleteDocumentRes);
    /**
 * 
 * deleteDocumentRes {
  success: true,
  data: {
    status: 'completed',
    user_id: '69b12a6fd11460481185a040',
    namespace: 'sdk-ts-e2e',
    document_id: 'sdk-typescript-e2e-doc-batch-b-1774345928641',
    chunks_deleted: 1,
    graph_chunks_deleted: 0,
    ledger_events_deleted: 0,
    orphan_entities_deleted: 0,
    message: "Deleted document 'sdk-typescript-e2e-doc-batch-b-1774345928641' from namespace 'sdk-ts-e2e'."
  }
}
 */
}


async function step13InteractMemory(): Promise<void> {
    logStep("step13: interactMemory");
    const interactMemoryRes = await client.interactMemory({
        namespace,
        entityNames: ["Car", "Maintenance"],
    });
    logOk("interactMemory");
    console.log("interactMemoryRes", interactMemoryRes);
    /**
     * interactMemoryRes {
  success: true,
  data: {
    status: 'completed',
    interactionsRecorded: 2,
    entityNames: [ 'CAR', 'MAINTENANCE' ],
    timestampUsed: 1774347432.8962
  }
}
     */
}

async function step14RecordInteractions(): Promise<void> {
    logStep("step14: recordInteractions");
    const recordInteractionsRes = await client.recordInteractions({
        namespace,
        entityNames: ["Car", "Maintenance"],
    });
    logOk("recordInteractions");
    console.log("recordInteractionsRes", recordInteractionsRes);
    /**
     * recordInteractionsRes {
  success: true,
  data: {
    status: 'completed',
    interactionsRecorded: 2,
    entityNames: [ 'CAR', 'MAINTENANCE' ],
    timestampUsed: 1774347677.1957
  }
}
 */
}

// Memory server error: Internal server error
async function step15GetGraphSnapshot(): Promise<void> {
    logStep("step15: getGraphSnapshot");
    const getGraphSnapshotRes = await client.getGraphSnapshot({
        namespace,
    });
    logOk("getGraphSnapshot");
    console.log("getGraphSnapshotRes", getGraphSnapshotRes);
}

// Error: Memory server error: Memory cache chat is not enabled
async function step16ChatMemoryContext(): Promise<void> {
    logStep("step17: chatMemoryContext");
    const chatMemoryContextRes = await client.chatMemoryContext({
        messages: [{ role: "user", content: "Summarize current memory context." }],
        temperature: 0,
        maxTokens: 128,
    });
    logOk("chatMemoryContext");
    console.log("chatMemoryContextRes", chatMemoryContextRes);
}

// Error: Memory server error: Internal server error
async function step17DeleteMemory(): Promise<void> {
    logStep("step17: deleteMemory");
    const deleteMemoryRes = await client.deleteMemory({
        namespace,
    });
    logOk("deleteMemory");
    console.log("deleteMemoryRes", deleteMemoryRes);
}


async function main(): Promise<void> {
    // const insertJobId = await step1InsertMemory();
    // await step2CheckIngestionJob("5f0ad31d-da4d-4a49-a3cb-312e53acbb0d");
    // const documents = await step3ListDocuments();
    // await step4GetDocument(documents[0].document_id as string);
    // await step5QueryMemory(); // ERROR: Anonymous access not allowed: Not enough permission to perform this action
    // await step6RecallMemoryContext();
    // await step7RecallMemories();
    // await step8RecallThoughts();
    // await step9ChatMemory(); // error: 'Memory server error: Memory cache chat is not enabled'
    // await step10InsertDocument();
    // await step11InsertDocumentsBatch();
    // await step12DeleteDocument("sdk-typescript-e2e-doc-single-1774425914228-memory");
    // await step13InteractMemory();
    // await step14RecordInteractions();
    // await step15GetGraphSnapshot(); // Memory server error: Internal server error
    // await step16ChatMemoryContext(); // Memory server error: Memory cache chat is not enabled
    // await step17DeleteMemory(); // Memory server error: Internal server error


    // await runStep("deleteDocument(single)", () => client.deleteDocument({ documentId: singleDocId, namespace }));
    // await runStep("deleteDocument(batch A)", () => client.deleteDocument({ documentId: batchDocA, namespace }));
    // await runStep("deleteDocument(batch B)", () => client.deleteDocument({ documentId: batchDocB, namespace }));
    // await runStep("deleteMemory", () => client.deleteMemory({ namespace }));

    console.log("\nE2E SDK example completed.");
}

main().catch((error: unknown) => {
    console.error("\nE2E SDK example failed.");
    console.error(error);
    process.exit(1);
});
/**
 * 
 * Error Routes :
 * - queryMemory: Anonymous access not allowed: Not enough permission to perform this action
 * - chatMemory: Memory server error: Memory cache chat is not enabled
 * - getGraphSnapshot: Memory server error: Internal server error
 * - chatMemoryContext: Memory server error: Memory cache chat is not enabled
 * - deleteMemory: Memory server error: Internal server error
 */