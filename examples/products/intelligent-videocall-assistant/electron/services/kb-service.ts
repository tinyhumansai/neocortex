import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { settingsStore } from './settings-store';
import type { KBDocument, KBReference } from '../../shared/types';

interface KBChunk {
    id: string;
    documentId: string;
    text: string;
    embedding: number[];
}

// Simple in-memory vector store with cosine similarity
class VectorStore {
    private chunks: KBChunk[] = [];
    private storagePath: string;

    constructor() {
        const dataDir = path.join(app.getPath('userData'), 'kb');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        this.storagePath = path.join(dataDir, 'chunks.json');
        this.load();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.storagePath)) {
                this.chunks = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
            }
        } catch { }
    }

    private save(): void {
        fs.writeFileSync(this.storagePath, JSON.stringify(this.chunks));
    }

    add(chunks: KBChunk[]): void {
        this.chunks.push(...chunks);
        this.save();
    }

    removeByDocumentId(documentId: string): void {
        this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
        this.save();
    }

    search(queryEmbedding: number[], topK: number): KBChunk[] {
        if (this.chunks.length === 0) return [];

        const scored = this.chunks.map((chunk) => ({
            chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((s) => s.chunk);
    }

    getAll(): KBChunk[] {
        return this.chunks;
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] ** 2;
        normB += b[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// Split text into overlapping chunks
function chunkText(text: string, chunkSize = 400, overlap = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    while (i < words.length) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
        i += chunkSize - overlap;
    }
    return chunks.filter((c) => c.trim().length > 20);
}

class KBService {
    private vectorStore = new VectorStore();
    private documentsPath: string;
    private documents: Map<string, KBDocument> = new Map();

    constructor() {
        const dataDir = path.join(app.getPath('userData'), 'kb');
        this.documentsPath = path.join(dataDir, 'documents.json');
        this.loadDocuments();
    }

    private loadDocuments(): void {
        try {
            if (fs.existsSync(this.documentsPath)) {
                const docs: KBDocument[] = JSON.parse(fs.readFileSync(this.documentsPath, 'utf-8'));
                docs.forEach((d) => this.documents.set(d.id, d));
            }
        } catch { }
    }

    private saveDocuments(): void {
        fs.writeFileSync(this.documentsPath, JSON.stringify([...this.documents.values()]));
    }

    private async embed(texts: string[]): Promise<number[][]> {
        const settings = settingsStore.get();
        const client = new OpenAI({ apiKey: settings.openaiApiKey });
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
        });
        return response.data.map((d) => d.embedding);
    }

    private async extractText(filePath: string, type: string): Promise<string> {
        if (type === 'pdf') {
            const buffer = fs.readFileSync(filePath);
            const data = await pdfParse(buffer);
            return data.text;
        } else if (type === 'docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else {
            return fs.readFileSync(filePath, 'utf-8');
        }
    }

    async ingest(filePath: string, fileName: string): Promise<KBDocument> {
        const ext = path.extname(fileName).replace('.', '').toLowerCase();
        const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'txt';
        const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const doc: KBDocument = {
            id,
            name: fileName,
            type,
            size: fs.statSync(filePath).size,
            chunkCount: 0,
            uploadedAt: Date.now(),
            status: 'processing',
        };
        this.documents.set(id, doc);
        this.saveDocuments();

        try {
            const text = await this.extractText(filePath, type);
            const textChunks = chunkText(text);
            const embeddings = await this.embed(textChunks);

            const chunks: KBChunk[] = textChunks.map((t, i) => ({
                id: `${id}-chunk-${i}`,
                documentId: id,
                text: t,
                embedding: embeddings[i],
            }));

            this.vectorStore.add(chunks);
            doc.chunkCount = chunks.length;
            doc.status = 'ready';
            this.documents.set(id, doc);
            this.saveDocuments();
        } catch (err) {
            doc.status = 'error';
            this.documents.set(id, doc);
            this.saveDocuments();
            throw err;
        }

        return doc;
    }

    async retrieve(query: string, topK = 5): Promise<Array<{ text: string; documentId: string }>> {
        if (this.documents.size === 0) return [];
        try {
            const [embedding] = await this.embed([query]);
            const chunks = this.vectorStore.search(embedding, topK);
            return chunks.map((c) => ({ text: c.text, documentId: c.documentId }));
        } catch {
            return [];
        }
    }

    listDocuments(): KBDocument[] {
        return [...this.documents.values()];
    }

    deleteDocument(id: string): void {
        this.documents.delete(id);
        this.vectorStore.removeByDocumentId(id);
        this.saveDocuments();
    }
}

export const kbService = new KBService();
