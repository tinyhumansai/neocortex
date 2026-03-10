import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db/mongo";
import { Book } from "@/lib/server/models";
import { absorbBook, listBooksOnDisk } from "@/lib/server/services/bookAbsorption";

/**
 * GET /api/books/absorb — List PDFs on disk and their ingestion status.
 */
export async function GET() {
  try {
    await connectDb();
    const files = await listBooksOnDisk();
    const books = await Book.find({ filename: { $in: files } })
      .sort({ updatedAt: -1 })
      .lean();

    const byFile = new Map(books.map((b) => [b.filename, b]));
    const list = files.map((filename) => {
      const book = byFile.get(filename);
      return {
        filename,
        status: book?.status ?? "pending",
        totalPages: book?.totalPages ?? null,
        totalChunks: book?.totalChunks ?? null,
        ingestedAt: book?.updatedAt ?? null,
      };
    });

    return NextResponse.json({ books: list });
  } catch (err) {
    console.error("[books/absorb GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list books" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/books/absorb — Ingest a PDF from the books/ folder.
 * Body: { "filename": "example.pdf" }
 * Or body: {} to ingest all pending PDFs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename = body.filename as string | undefined;

    if (filename) {
      const result = await absorbBook(filename);
      return NextResponse.json(result);
    }

    const files = await listBooksOnDisk();
    const results: Awaited<ReturnType<typeof absorbBook>>[] = [];
    for (const f of files) {
      try {
        const result = await absorbBook(f);
        results.push(result);
      } catch (e) {
        console.error(`Failed to absorb ${f}:`, e);
      }
    }
    return NextResponse.json({ absorbed: results.length, results });
  } catch (err) {
    console.error("[books/absorb POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Absorption failed" },
      { status: 500 }
    );
  }
}
