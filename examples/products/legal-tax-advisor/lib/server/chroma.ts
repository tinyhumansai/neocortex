import { getConfig } from "./config";

type ChromaClientInstance = Awaited<ReturnType<typeof createChromaClient>>;
let _client: ChromaClientInstance | null = null;

function parseChromaUrl(url: string): { host: string; port: number; ssl: boolean } {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    return {
      host: u.hostname || "localhost",
      port: u.port ? parseInt(u.port, 10) : 8000,
      ssl: u.protocol === "https:",
    };
  } catch {
    return { host: "localhost", port: 8000, ssl: false };
  }
}

async function createChromaClient() {
  const { ChromaClient } = await import("chromadb");
  const url = getConfig().CHROMA_URL.trim();
  const { host, port, ssl } = parseChromaUrl(url);
  return new ChromaClient({ host, port, ssl });
}

export const LEXAI_BOOKS_COLLECTION = "lexai_books";

export function isChromaEnabled(): boolean {
  const url = getConfig().CHROMA_URL?.trim();
  return !!url;
}

/** Lazy init Chroma client (dynamic import so build works without Chroma). */
export async function getChromaClient(): Promise<ChromaClientInstance> {
  if (_client) return _client;
  const url = getConfig().CHROMA_URL?.trim();
  if (!url) throw new Error("CHROMA_URL is not set");
  _client = await createChromaClient();
  return _client;
}

/** Get or create the books collection. Uses Chroma's default embedding (no OpenAI required). */
export async function getBooksCollection() {
  const client = await getChromaClient();
  try {
    const { DefaultEmbeddingFunction } = await import("@chroma-core/default-embed");
    const embeddingFunction = new DefaultEmbeddingFunction();
    return await client.getOrCreateCollection({
      name: LEXAI_BOOKS_COLLECTION,
      metadata: { description: "CA book chunks with embeddings" },
      embeddingFunction,
    });
  } catch (err) {
    throw new Error(
      `ChromaDB connection failed (is Chroma running at ${getConfig().CHROMA_URL}?): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Get the books collection by name only (for read-only use e.g. debug). Avoids get_or_create returning a different collection when config differs. */
export async function getBooksCollectionForRead() {
  const client = await getChromaClient();
  try {
    const { DefaultEmbeddingFunction } = await import("@chroma-core/default-embed");
    const embeddingFunction = new DefaultEmbeddingFunction();
    return await client.getCollection({
      name: LEXAI_BOOKS_COLLECTION,
      embeddingFunction,
    });
  } catch (err) {
    throw new Error(
      `ChromaDB get collection failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
