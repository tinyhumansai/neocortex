import path from "path";
import fs from "fs/promises";
import { connectDb } from "../db/mongo";
import { Book } from "../models";
import { logger } from "../logger";
import { getBooksCollection, getBooksCollectionForRead, isChromaEnabled } from "../chroma";

const BOOKS_DIR = path.join(process.cwd(), "books");
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

export interface AbsorbResult {
  bookId: string;
  title: string;
  filename: string;
  totalPages: number;
  totalChunks: number;
}

/**
 * Extract text from a PDF buffer. Uses dynamic import so pdf-parse/pdfjs-dist
 * load only when parsing (and run as Node externals, not webpack-bundled).
 */
async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; totalPages: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    await parser.destroy();
    const fullText = result.text ?? "";
    const totalPages = result.pages?.length ?? 0;
    return { text: fullText.trim(), totalPages };
  } catch (err) {
    await parser.destroy().catch(() => {});
    throw err;
  }
}

/**
 * Split text into overlapping chunks for storage and retrieval.
 */
function chunkText(text: string, options: { chunkSize?: number; overlap?: number } = {}): string[] {
  const size = options.chunkSize ?? CHUNK_SIZE;
  const overlap = options.overlap ?? CHUNK_OVERLAP;
  if (!text || text.length <= size) return text ? [text] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const nextNewline = text.indexOf("\n", end);
      if (nextNewline !== -1 && nextNewline - end < 300) {
        end = nextNewline + 1;
      } else {
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start) end = lastSpace + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter(Boolean);
}

const CHROMA_REQUIRED_MSG =
  "Chroma is required for book absorption. Set CHROMA_URL (e.g. http://localhost:8000) and run the Chroma server: npm run chroma";

/**
 * Ingest a single PDF from the books/ folder: extract text, chunk, store in Chroma only.
 */
export async function absorbBook(filename: string): Promise<AbsorbResult> {
  if (!isChromaEnabled()) {
    throw new Error(CHROMA_REQUIRED_MSG);
  }
  await connectDb();

  const filePath = path.join(BOOKS_DIR, filename);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Book not found: ${filename}`);
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are supported");
  }

  // Always run Chroma ingestion: we no longer skip based on MongoDB "completed"
  // (that status may be from an old run; Chroma is the only store for book content)
  const book = await Book.findOneAndUpdate(
    { filename },
    {
      $set: {
        title: filename.replace(/\.pdf$/i, "").replace(/-/g, " "),
        filename,
        sourcePath: filePath,
        status: "processing",
        errorMessage: null,
      },
    },
    { upsert: true, new: true }
  );

  try {
    const buffer = await fs.readFile(filePath);
    const { text, totalPages } = await extractTextFromPdf(buffer);

    const chunks = chunkText(text);
    const bookId = book._id;
    const bookIdStr = bookId.toString();
    const title = book.title ?? filename.replace(/\.pdf$/i, "").replace(/-/g, " ");

    const collection = await getBooksCollection();
    await collection.delete({ where: { bookId: bookIdStr } });
    const ids = chunks.map((_, i) => `${bookIdStr}_${i}`);
    const metadatas = chunks.map((_, i) => ({
      bookId: bookIdStr,
      chunkIndex: i,
      filename,
      title,
    }));
    const CHROMA_BATCH = 100;
    for (let i = 0; i < chunks.length; i += CHROMA_BATCH) {
      await collection.add({
        ids: ids.slice(i, i + CHROMA_BATCH),
        documents: chunks.slice(i, i + CHROMA_BATCH),
        metadatas: metadatas.slice(i, i + CHROMA_BATCH),
      });
    }
    const count = await collection.count();
    logger.info("Chroma add complete", {
      filename,
      chromaCount: count,
      expectedChunks: chunks.length,
    });
    if (count === 0) {
      throw new Error(
        `Chroma reported 0 documents after add (expected ${chunks.length}). The server may have an existing collection created without an embedding function. Try: stop Chroma, delete the ./chroma-data folder, run "npm run chroma" again, then re-run absorption.`
      );
    }

    await Book.updateOne(
      { _id: bookId },
      {
        $set: {
          totalPages,
          totalChunks: chunks.length,
          status: "completed",
          errorMessage: null,
        },
      }
    );

    logger.info("Book absorbed", { filename, totalPages, totalChunks: chunks.length });

    return {
      bookId: bookId.toString(),
      title: book.title,
      filename: book.filename,
      totalPages,
      totalChunks: chunks.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await Book.updateOne({ _id: book._id }, { $set: { status: "failed", errorMessage: message } });
    logger.error("Book absorption failed", { filename, error: message });
    throw err;
  }
}

/**
 * List PDFs in the books/ directory.
 */
export async function listBooksOnDisk(): Promise<string[]> {
  const dir = await fs.readdir(BOOKS_DIR).catch(() => []);
  return dir.filter((f) => f.toLowerCase().endsWith(".pdf"));
}

/**
 * Retrieve relevant book chunks via Chroma vector search (semantic similarity to the user query).
 * Used to inject CA book context into the chat system prompt. Returns empty string if Chroma is disabled.
 */
const CHROMA_QUERY_TIMEOUT_MS = 15_000;

export async function getRelevantBookChunks(query: string, limit: number = 10): Promise<string> {
  if (!isChromaEnabled()) return "";

  try {
    const collection = await getBooksCollectionForRead();
    const result = await Promise.race([
      collection.query({
        queryTexts: [query],
        nResults: limit,
        include: ["documents", "metadatas"],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Chroma query timed out")), CHROMA_QUERY_TIMEOUT_MS)
      ),
    ]);
    const docs = (result.documents ?? [])[0];
    const metadatas = (result.metadatas ?? [])[0];
    if (!docs || docs.length === 0) return "";

    const withSource = docs.map((doc, i) => {
      const meta = metadatas?.[i] as
        | { filename?: string; caseId?: string; cnr?: string }
        | undefined;
      let source = "";
      if (meta && typeof meta === "object") {
        if ("caseId" in meta && meta.caseId) source = `[Source: case ${meta.caseId}]`;
        else if ("filename" in meta && meta.filename) source = `[Source: ${meta.filename}]`;
      }
      return source ? `${doc}\n${source}` : doc;
    });
    return withSource.filter(Boolean).join("\n\n---\n\n");
  } catch (err) {
    logger.error("Chroma retrieval failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "";
  }
}

/**
 * Retrieve relevant case chunks from Chroma (ingested scraped cases only).
 * Filters by source: "case" so only case content is returned, not books.
 */
export async function getRelevantCaseChunks(query: string, limit: number = 10): Promise<string> {
  if (!isChromaEnabled()) return "";

  try {
    const collection = await getBooksCollectionForRead();
    const result = await Promise.race([
      collection.query({
        queryTexts: [query],
        nResults: limit,
        where: { source: { $eq: "case" } },
        include: ["documents", "metadatas"],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Chroma query timed out")), CHROMA_QUERY_TIMEOUT_MS)
      ),
    ]);
    const docs = (result.documents ?? [])[0];
    const metadatas = (result.metadatas ?? [])[0];
    if (!docs || docs.length === 0) return "";

    const withSource = docs.map((doc, i) => {
      const meta = metadatas?.[i] as { caseId?: string; cnr?: string } | undefined;
      const source = meta?.caseId ? `[Source: case ${meta.caseId}]` : "";
      return source ? `${doc}\n${source}` : doc;
    });
    return withSource.filter(Boolean).join("\n\n---\n\n");
  } catch (err) {
    logger.error("Chroma case retrieval failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "";
  }
}
