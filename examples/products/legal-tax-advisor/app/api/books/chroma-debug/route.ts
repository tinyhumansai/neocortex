import { NextResponse } from "next/server";
import { getBooksCollectionForRead, isChromaEnabled } from "@/lib/server/chroma";

/**
 * GET /api/books/chroma-debug — Inspect what the app's Chroma client sees (collections, count, sample).
 * No auth; for local debugging only.
 */
export async function GET() {
  if (!isChromaEnabled()) {
    return NextResponse.json({
      chromaEnabled: false,
      message: "CHROMA_URL is not set; using MongoDB keyword retrieval.",
    });
  }

  try {
    const collection = await getBooksCollectionForRead();
    const count = await collection.count();

    const sample = await collection.get({
      limit: 3,
      include: ["documents", "metadatas"],
    });

    const coll = collection as { tenant?: string; database?: string };
    const SAMPLE_SIZE = 3;
    return NextResponse.json({
      chromaEnabled: true,
      collectionName: "lexai_books",
      tenant: coll.tenant ?? null,
      database: coll.database ?? null,
      count: count,
      totalChunks: count,
      sampleSize: SAMPLE_SIZE,
      sampleNote: `Showing ${SAMPLE_SIZE} of ${count} chunks (preview only). All ${count} chunks are used for vector search in chat.`,
      sample: {
        ids: sample.ids ?? [],
        metadatas: sample.metadatas ?? [],
        documents: (sample.documents ?? []).map((d) =>
          typeof d === "string" ? d.slice(0, 200) + (d.length > 200 ? "…" : "") : d
        ),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const notFound = /does not exist|not found|404/i.test(message);
    return NextResponse.json(
      {
        chromaEnabled: true,
        error: message,
        hint: notFound
          ? "Collection not created yet. Run POST /api/books/absorb first."
          : undefined,
      },
      { status: notFound ? 404 : 500 }
    );
  }
}
