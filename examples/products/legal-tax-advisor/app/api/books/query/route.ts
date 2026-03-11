import { NextRequest, NextResponse } from "next/server";
import { getBooksCollectionForRead, isChromaEnabled } from "@/lib/server/chroma";

/**
 * GET /api/books/query?q=<query>&limit=<n>
 * Query ChromaDB directly with vector search (same as chat uses).
 * Returns matching chunks with documents, metadatas, and distances.
 */
export async function GET(req: NextRequest) {
  if (!isChromaEnabled()) {
    return NextResponse.json(
      { error: "Chroma is not configured. Set CHROMA_URL." },
      { status: 503 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Missing query. Use ?q=your+search+phrase" },
      { status: 400 }
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "10", 10) || 10), 50);

  try {
    const collection = await getBooksCollectionForRead();
    const result = await collection.query({
      queryTexts: [q],
      nResults: limit,
      include: ["documents", "metadatas", "distances"],
    });

    const ids = (result.ids ?? [])[0] ?? [];
    const documents = (result.documents ?? [])[0] ?? [];
    const metadatas = (result.metadatas ?? [])[0] ?? [];
    const distances = (result.distances ?? [])[0] ?? [];

    const results = ids.map((id, i) => ({
      id,
      document: documents[i] ?? null,
      metadata: metadatas[i] ?? null,
      distance: distances[i] ?? null,
    }));

    return NextResponse.json({
      query: q,
      limit,
      count: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
