/**
 * E2E for plugin-opencode using real Neocortex memory.
 *
 * This script does NOT run inside OpenCode; instead it directly exercises
 * the OpenCodeNeocortexMemory adapter used by the plugin.
 *
 * Required env:
 *   ALPHAHUMAN_API_KEY
 *
 * Optional env:
 *   ALPHAHUMAN_BASE_URL
 *
 * Run from this package directory:
 *   npx tsx e2e.ts
 */

import { OpenCodeNeocortexMemory } from "./src/index";

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

const ALPHAHUMAN_API_KEY = getEnv("ALPHAHUMAN_API_KEY");
const ALPHAHUMAN_BASE_URL = getEnv("ALPHAHUMAN_BASE_URL");

if (!ALPHAHUMAN_API_KEY) {
  throw new Error("Missing ALPHAHUMAN_API_KEY");
}

const namespace = `opencode-e2e-${Date.now()}`;

async function run() {
  console.log("OpenCode plugin E2E");
  console.log("  namespace:", namespace);
  console.log("  ALPHAHUMAN_BASE_URL:", ALPHAHUMAN_BASE_URL || "(default)");
  console.log("---");

  const memory = new OpenCodeNeocortexMemory({
    token: ALPHAHUMAN_API_KEY,
    baseUrl: ALPHAHUMAN_BASE_URL || undefined,
    defaultNamespace: namespace,
  });

  // Phase 1: save memory
  console.log("Phase 1: saveMemory");
  const saveResult = await memory.saveMemory({
    namespace,
    key: "preferred_drink",
    content: "The user's preferred drink is coffee.",
    metadata: { source: "plugin-opencode-e2e" },
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

  // Phase 3: delete memory (admin)
  console.log("\nPhase 3: deleteMemory");
  const deleteResult = await memory.deleteMemory({ namespace });
  console.log("deleteMemory result:", deleteResult);

  console.log("\n---");
  console.log(
    "If results look wrong, verify ALPHAHUMAN_API_KEY / ALPHAHUMAN_BASE_URL and try again."
  );
}

run().catch((e) => {
  console.error("E2E failed:", e);
  throw e;
});

