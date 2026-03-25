import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TinyHumansMemoryClient,
  TinyHumansError,
  InsertMemoryParams,
  QueryMemoryParams,
  DeleteMemoryParams,
  RecallMemoryParams,
  RecallMemoriesParams,
} from '../src/index';

describe('TinyHumansMemoryClient', () => {
  const baseUrl = 'https://api.test.example';
  const token = 'test-token';

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('constructor', () => {
    it('throws when token is missing', () => {
      expect(() => new TinyHumansMemoryClient({ token: '' })).toThrow('token is required');
      expect(() => new TinyHumansMemoryClient({ token: '   ' })).toThrow('token is required');
    });

    it('uses provided baseUrl and token', () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      expect(client).toBeDefined();
    });
  });

  describe('insertMemory', () => {
    it('validates required fields', async () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await expect(client.insertMemory({ title: '', content: 'x', namespace: 'ns', documentId: 'doc_x' })).rejects.toThrow(
        'title is required'
      );
      await expect(client.insertMemory({ title: 't', content: '', namespace: 'ns', documentId: 'doc_x' })).rejects.toThrow(
        'content is required'
      );
      await expect(client.insertMemory({ title: 't', content: 'c', namespace: '', documentId: 'doc_x' })).rejects.toThrow(
        'namespace is required'
      );
      await expect(client.insertMemory({ title: 't', content: 'c', namespace: 'ns', documentId: '' })).rejects.toThrow(
        'documentId is required'
      );
    });

    it('POSTs to /v1/memory/insert with correct body and headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              data: { status: 'ok', stats: {} },
            })
          ),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      const params: InsertMemoryParams = {
        title: 'My Doc',
        content: 'Some content',
        namespace: 'default',
        documentId: 'doc_1',
        sourceType: 'doc',
        metadata: { source: 'test' },
      };
      await client.insertMemory(params);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/insert`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: 'My Doc',
            content: 'Some content',
            namespace: 'default',
            documentId: 'doc_1',
            sourceType: 'doc',
            metadata: { source: 'test' },
            priority: undefined,
            createdAt: undefined,
            updatedAt: undefined,
          }),
        })
      );
    });

    it('returns parsed response data', async () => {
      const data = { status: 'ok', stats: { ingested: 1 }, usage: { cost_usd: 0.01 } };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data })),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      const result = await client.insertMemory({
        title: 'T',
        content: 'C',
        namespace: 'ns',
        documentId: 'doc_2',
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });
  });

  describe('queryMemory', () => {
    it('validates query is required', async () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await expect(
        client.queryMemory({ query: '' } as QueryMemoryParams)
      ).rejects.toThrow('query is required');
    });

    it('validates maxChunks range', async () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve('{"success":true,"data":{}}') });
      await expect(client.queryMemory({ query: 'q', maxChunks: 0 })).rejects.toThrow('maxChunks');
      await expect(client.queryMemory({ query: 'q', maxChunks: 201 })).rejects.toThrow('maxChunks');
    });

    it('POSTs to /v1/memory/query', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              data: { cached: false, context: {}, usage: {} },
            })
          ),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await client.queryMemory({ query: 'hello', namespace: 'ns', maxChunks: 10 });
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/query`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: 'hello',
            includeReferences: undefined,
            namespace: 'ns',
            maxChunks: 10,
            documentIds: undefined,
            llmQuery: undefined,
          }),
        })
      );
    });
  });

  describe('deleteMemory', () => {
    it('POSTs to /v1/memory/admin/delete', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              data: {
                status: 'ok',
                userId: 'u1',
                nodesDeleted: 5,
                message: 'Deleted',
              },
            })
          ),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      const params: DeleteMemoryParams = { namespace: 'my-ns' };
      await client.deleteMemory(params);
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/admin/delete`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ namespace: 'my-ns' }),
        })
      );
    });
  });

  describe('recallMemory', () => {
    it('validates maxChunks when provided', async () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await expect(recallMemory({ maxChunks: 0 })).rejects.toThrow('maxChunks');
      await expect(recallMemory({ maxChunks: 1.5 })).rejects.toThrow('maxChunks');
      async function recallMemory(p: RecallMemoryParams) {
        return client.recallMemory(p);
      }
    });

    it('POSTs to /v1/memory/recall', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              data: { cached: false, response: 'context here' },
            })
          ),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await client.recallMemory({ namespace: 'ns', maxChunks: 10 });
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/recall`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ namespace: 'ns', maxChunks: 10 }),
        })
      );
    });
  });

  describe('recallMemories', () => {
    it('validates topK and minRetention when provided', async () => {
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await expect(recallMemories({ topK: 0 })).rejects.toThrow('topK');
      await expect(recallMemories({ minRetention: -1 })).rejects.toThrow('minRetention');
      async function recallMemories(p: RecallMemoriesParams) {
        return client.recallMemories(p);
      }
    });

    it('POSTs to /v1/memory/memories/recall', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              data: { memories: [] },
            })
          ),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await client.recallMemories({ namespace: 'ns', topK: 5 });
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/memories/recall`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ namespace: 'ns', topK: 5, minRetention: undefined, asOf: undefined }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws AlphahumanError on non-ok response with error message', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ success: false, error: 'Bad request' })),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      try {
        await client.insertMemory({ title: 'T', content: 'C', namespace: 'ns', documentId: 'doc_3' });
        expect.fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(TinyHumansError);
        expect((e as TinyHumansError).message).toBe('Bad request');
        expect((e as TinyHumansError).status).toBe(400);
        expect((e as TinyHumansError).body).toEqual({ success: false, error: 'Bad request' });
      }
    });

    it('throws on non-JSON response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('not json') });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await expect(client.insertMemory({ title: 'T', content: 'C', namespace: 'ns', documentId: 'doc_4' })).rejects.toThrow(
        'non-JSON response'
      );
    });
  });

  describe('chatMemory', () => {
    it('POSTs to /v1/memory/chat', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: { content: 'hello' } })),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await client.chatMemory({ messages: [{ role: 'user', content: 'hi' }] });
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/chat`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
        })
      );
    });
  });

  describe('listDocuments', () => {
    it('GETs from /v1/memory/documents with query params', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, data: {} })),
      });
      const client = new TinyHumansMemoryClient({ token, baseUrl });
      await client.listDocuments({ namespace: 'ns', limit: 10 });
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/memory/documents?namespace=ns&limit=10`,
        expect.objectContaining({ method: 'GET' })
      );
    });
  });
});

