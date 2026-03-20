#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envFile = process.env.ENV_FILE || path.join(pkgRoot, ".env");
loadEnvFile(envFile);

const token = process.env.ALPHAHUMAN_TOKEN || process.env.TINYHUMANS_TOKEN;
if (!token) {
  console.error("Missing token. Set ALPHAHUMAN_TOKEN or TINYHUMANS_TOKEN.");
  process.exit(2);
}

const baseUrl = process.env.TINYHUMANS_BASE_URL || process.env.ALPHAHUMAN_BASE_URL;
const { AlphahumanMemoryClient } = await import(path.join(pkgRoot, "dist", "index.js"));
const client = new AlphahumanMemoryClient({ token, baseUrl });

const ts = Date.now();
const namespace = `sdk-ts-routes-${ts}`;
const docSingle = `ts-doc-single-${ts}`;
const docBatch1 = `ts-doc-batch-1-${ts}`;
const docBatch2 = `ts-doc-batch-2-${ts}`;

const results = [];
let maybeJobId;

function collectJobIds(payload) {
  const ids = [];
  if (!payload || typeof payload !== "object") return ids;
  const direct = payload?.data?.jobId ?? payload?.jobId;
  if (typeof direct === "string" && direct) ids.push(direct);
  const accepted = payload?.data?.accepted ?? payload?.accepted;
  if (Array.isArray(accepted)) {
    for (const row of accepted) {
      const jid = row?.jobId ?? row?.job_id;
      if (typeof jid === "string" && jid) ids.push(jid);
    }
  }
  return [...new Set(ids)];
}

function collectDocumentIds(payload) {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const key of ["documentId", "document_id", "id"]) {
      const value = node[key];
      if (typeof value === "string" && value) found.push(value);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(payload);
  return [...new Set(found)];
}

async function run(name, fn, optional = false) {
  try {
    const data = await fn();
    results.push({ name, ok: true, msg: "ok" });
    return data;
  } catch (err) {
    if (optional) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name, ok: true, msg: `optional-skip: ${message}` });
      return undefined;
    }
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, msg: message });
    return undefined;
  }
}

try {
  await run("insertMemory", () =>
    client.insertMemory({
      title: "TS Route Test Memory",
      content: "typescript route test memory",
      namespace,
      sourceType: "doc",
      metadata: { source: "sdk-typescript-route-test" },
      documentId: `${docSingle}-memory`,
    }),
  );

  await run("queryMemory", () =>
    client.queryMemory({
      query: "what memory was stored",
      namespace,
      maxChunks: 5,
      includeReferences: true,
    }),
  );

  const singleInsertRes = await run("insertDocument", () =>
    client.insertDocument({
      title: "TS Route Test Single",
      content: "Single document for route test",
      namespace,
      sourceType: "doc",
      metadata: { source: "sdk-typescript-route-test", kind: "single" },
      documentId: docSingle,
    }),
  );
  const singleJobIds = collectJobIds(singleInsertRes);
  if (singleJobIds.length > 0) {
    if (!maybeJobId) maybeJobId = singleJobIds[0];
    for (const jid of singleJobIds) {
      await run(`insertDocumentJobPoll(${jid})`, () => client.waitForIngestionJob(jid));
    }
  } else {
    results.push({ name: "insertDocumentJobPoll", ok: false, msg: "insertDocument did not return jobId" });
  }

  const batchRes = await run("insertDocumentsBatch", () =>
    client.insertDocumentsBatch({
      items: [
        {
          title: "TS Route Test Batch 1",
          content: "Batch document 1",
          namespace,
          documentId: docBatch1,
        },
        {
          title: "TS Route Test Batch 2",
          content: "Batch document 2",
          namespace,
          documentId: docBatch2,
        },
      ],
    }),
  );
  const batchJobIds = collectJobIds(batchRes);
  if (batchJobIds.length > 0) {
    if (!maybeJobId) maybeJobId = batchJobIds[0];
    for (const jid of batchJobIds) {
      await run(`insertDocumentsBatchJobPoll(${jid})`, () => client.waitForIngestionJob(jid));
    }
  } else {
    results.push({
      name: "insertDocumentsBatchJobPoll",
      ok: false,
      msg: "insertDocumentsBatch did not return jobId",
    });
  }

  const listDocumentsRes = await run("listDocuments", () => client.listDocuments({ namespace, limit: 20, offset: 0 }));
  const listedIds = collectDocumentIds(listDocumentsRes);
  const getDocId = listedIds.includes(docSingle) ? docSingle : listedIds[0] ?? docSingle;
  await run("getDocument", () => client.getDocument({ documentId: getDocId, namespace }));

  await run("queryMemoryContext", () =>
    client.queryMemoryContext({
      query: "summarize route test docs",
      namespace,
      includeReferences: true,
      maxChunks: 5,
      documentIds: [docSingle],
    }),
  );

  await run("chatMemoryContext", () =>
    client.chatMemoryContext({
      messages: [{ role: "user", content: "Summarize what the route test inserted." }],
      temperature: 0,
      maxTokens: 128,
    }),
    true,
  );

  await run("recordInteractions", () =>
    client.recordInteractions({
      namespace,
      entityNames: ["TS-ROUTE-TEST-A", "TS-ROUTE-TEST-B"],
      description: "typescript route test interactions",
      interactionLevel: "engage",
    }),
  );

  await run("recallThoughts", () =>
    client.recallThoughts({ namespace, maxChunks: 5, thoughtPrompt: "Reflect on stored docs" }),
  );

  await run("getGraphSnapshot", () =>
    client.getGraphSnapshot({ namespace, mode: "latest_chunks", limit: 10, seed_limit: 3 }),
    true,
  );

  await run("chatMemory", () =>
    client.chatMemory({
      messages: [{ role: "user", content: "Reply with ok" }],
      temperature: 0,
      maxTokens: 64,
    }),
    true,
  );

  await run("interactMemory", () =>
    client.interactMemory({
      namespace,
      entityNames: ["TS-ROUTE-TEST-A", "TS-ROUTE-TEST-B"],
      description: "typescript route test interact",
      interactionLevel: "engage",
      timestamp: Math.floor(Date.now() / 1000),
    }),
  );

  await run("recallMemory", () => client.recallMemory({ namespace, maxChunks: 5 }));
  await run("recallMemories", () => client.recallMemories({ namespace, topK: 5, minRetention: 0 }));

  if (maybeJobId) {
    await run("getIngestionJob", () => client.getIngestionJob(maybeJobId));
  } else {
    results.push({ name: "getIngestionJob", ok: true, msg: "optional-skip: no jobId returned by inserts" });
  }

} finally {
  const cleanupIds = [docSingle, docBatch1, docBatch2];
  const listForCleanup = await run("listDocuments(cleanup)", () => client.listDocuments({ namespace, limit: 200, offset: 0 }), true);
  for (const discovered of collectDocumentIds(listForCleanup)) {
    if (!cleanupIds.includes(discovered)) cleanupIds.push(discovered);
  }
  for (const docId of cleanupIds) {
    await run(`deleteDocument(${docId})`, () => client.deleteDocument({ documentId: docId, namespace }), true);
  }
  await run("deleteMemory", () => client.deleteMemory({ namespace }), true);
}

console.log("\nRoute smoke test results (sdk-typescript):");
for (const row of results) {
  console.log(`- ${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.msg}`);
}

const failed = results.filter((row) => !row.ok);
if (failed.length > 0) {
  console.error(`\nFailed checks: ${failed.length}`);
  process.exit(1);
}

console.log(`\nAll required checks passed: ${results.length}`);
