import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

import 'package:tinyhumans_sdk/tinyhumans_sdk.dart';

MockClient mockClient(
  int statusCode,
  String body, {
  void Function(http.Request)? onRequest,
}) {
  return MockClient((request) async {
    onRequest?.call(request);
    return http.Response(body, statusCode,
        headers: {'content-type': 'application/json'});
  });
}

TinyHumansMemoryClient createClient({
  int statusCode = 200,
  String body = '{"success":true,"data":{}}',
  void Function(http.Request)? onRequest,
}) {
  return TinyHumansMemoryClient(
    'test-token',
    baseUrl: 'https://test.example.com',
    httpClient: mockClient(statusCode, body, onRequest: onRequest),
  );
}

void main() {
  // ── Constructor ──

  group('Constructor', () {
    test('rejects empty token', () {
      expect(
        () => TinyHumansMemoryClient('',
            baseUrl: 'https://test.example.com',
            httpClient: mockClient(200, '{}')),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('rejects whitespace token', () {
      expect(
        () => TinyHumansMemoryClient('   ',
            baseUrl: 'https://test.example.com',
            httpClient: mockClient(200, '{}')),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('accepts valid token', () {
      final client = createClient();
      expect(client, isNotNull);
      client.close();
    });
  });

  // ── Model ID ──

  group('modelId', () {
    test('sends default X-Model-Id header', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.recallMemory();

      expect(captured, isNotNull);
      expect(captured!.headers['x-model-id'], equals('neocortex-mk1'));
    });

    test('sends custom X-Model-Id header', () async {
      http.Request? captured;
      final client = TinyHumansMemoryClient(
        'test-token',
        modelId: 'custom-model',
        baseUrl: 'https://test.example.com',
        httpClient: mockClient(200, '{"success":true,"data":{}}',
            onRequest: (r) => captured = r),
      );

      await client.recallMemory();

      expect(captured, isNotNull);
      expect(captured!.headers['x-model-id'], equals('custom-model'));
    });
  });

  // ── InsertMemory ──

  group('insertMemory', () {
    test('sends correct request', () async {
      http.Request? captured;
      final client = createClient(
        body:
            '{"success":true,"data":{"status":"ok","stats":{"chunks":3}}}',
        onRequest: (r) => captured = r,
      );

      final resp = await client.insertMemory(InsertMemoryParams(
        title: 't1',
        content: 'c1',
        namespace: 'ns1',
        documentId: 'doc-1',
      ));

      expect(resp.success, isTrue);
      expect(resp.status, equals('ok'));

      expect(captured, isNotNull);
      expect(captured!.method, equals('POST'));
      expect(captured!.url.toString(),
          endsWith('/memory/insert'));
      expect(captured!.headers['authorization'],
          equals('Bearer test-token'));
      expect(captured!.headers['content-type'],
          equals('application/json'));
      expect(captured!.headers['x-model-id'],
          equals('neocortex-mk1'));

      final reqBody = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(reqBody['title'], equals('t1'));
      expect(reqBody['content'], equals('c1'));
      expect(reqBody['namespace'], equals('ns1'));
      expect(reqBody['sourceType'], equals('doc'));
    });

    test('parses usage', () async {
      final client = createClient(
        body:
            '{"success":true,"data":{"status":"ok","stats":{},"usage":{"llm_input_tokens":10}}}',
      );

      final resp = await client.insertMemory(InsertMemoryParams(
        title: 't',
        content: 'c',
        namespace: 'ns',
        documentId: 'doc-1',
      ));

      expect(resp.usage, isNotNull);
    });

    test('throws on missing title', () {
      final client = createClient();
      expect(
        () => client.insertMemory(
            InsertMemoryParams(content: 'c', namespace: 'ns')),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on missing content', () {
      final client = createClient();
      expect(
        () => client.insertMemory(
            InsertMemoryParams(title: 't', namespace: 'ns')),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on missing namespace', () {
      final client = createClient();
      expect(
        () => client.insertMemory(
            InsertMemoryParams(title: 't', content: 'c')),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on missing documentId', () {
      final client = createClient();
      expect(
        () => client.insertMemory(
            InsertMemoryParams(title: 't', content: 'c', namespace: 'ns')),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── RecallMemory ──

  group('recallMemory', () {
    test('parses response', () async {
      final client = createClient(
        body:
            '{"success":true,"data":{"cached":true,"llmContextMessage":"ctx","counts":{"numEntities":1}}}',
      );

      final resp = await client.recallMemory(
          RecallMemoryParams(namespace: 'ns'));

      expect(resp.success, isTrue);
      expect(resp.cached, isTrue);
      expect(resp.llmContextMessage, equals('ctx'));
      expect(resp.counts, isNotNull);
    });

    test('throws on maxChunks = 0', () {
      final client = createClient();
      expect(
        () => client.recallMemory(RecallMemoryParams(maxChunks: 0)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on maxChunks = -1', () {
      final client = createClient();
      expect(
        () => client.recallMemory(RecallMemoryParams(maxChunks: -1)),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── DeleteMemory ──

  group('deleteMemory', () {
    test('parses response', () async {
      final client = createClient(
        body:
            '{"success":true,"data":{"nodesDeleted":5,"status":"deleted","message":"done"}}',
      );

      final resp = await client.deleteMemory(
          DeleteMemoryParams(namespace: 'ns'));

      expect(resp.success, isTrue);
      expect(resp.nodesDeleted, equals(5));
      expect(resp.status, equals('deleted'));
      expect(resp.message, equals('done'));
    });
  });

  // ── QueryMemory ──

  group('queryMemory', () {
    test('parses response', () async {
      final client = createClient(
        body:
            '{"success":true,"data":{"cached":false,"llmContextMessage":"answer","response":"Paris"}}',
      );

      final resp = await client.queryMemory(
          QueryMemoryParams(query: 'capital?'));

      expect(resp.success, isTrue);
      expect(resp.cached, isFalse);
      expect(resp.llmContextMessage, equals('answer'));
      expect(resp.response, equals('Paris'));
    });

    test('throws on missing query', () {
      final client = createClient();
      expect(
        () => client.queryMemory(QueryMemoryParams()),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on maxChunks = 0', () {
      final client = createClient();
      expect(
        () => client.queryMemory(
            QueryMemoryParams(query: 'q', maxChunks: 0)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on maxChunks = 201', () {
      final client = createClient();
      expect(
        () => client.queryMemory(
            QueryMemoryParams(query: 'q', maxChunks: 201)),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── RecallMemories ──

  group('recallMemories', () {
    test('parses response', () async {
      final client = createClient(
        body:
            '{"success":true,"data":{"memories":[{"id":"1","content":"hello"}]}}',
      );

      final resp = await client.recallMemories();

      expect(resp.success, isTrue);
      expect(resp.memories, hasLength(1));
      expect(resp.memories[0]['id'], equals('1'));
    });

    test('throws on topK = 0', () {
      final client = createClient();
      expect(
        () => client.recallMemories(RecallMemoriesParams(topK: 0)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on topK = -1', () {
      final client = createClient();
      expect(
        () => client.recallMemories(RecallMemoriesParams(topK: -1)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on negative minRetention', () {
      final client = createClient();
      expect(
        () => client
            .recallMemories(RecallMemoriesParams(minRetention: -0.1)),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── Chat ──

  group('chatMemory', () {
    test('sends correct request', () async {
      http.Request? captured;
      final client = createClient(
        body: '{"success":true,"data":{"response":"hi"}}',
        onRequest: (r) => captured = r,
      );

      await client.chatMemory(ChatMemoryParams(
        messages: [{'role': 'user', 'content': 'Hello'}],
        namespace: 'ns',
      ));

      expect(captured, isNotNull);
      expect(captured!.method, equals('POST'));
      expect(captured!.url.toString(), endsWith('/memory/chat'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['messages'], hasLength(1));
      expect(body['namespace'], equals('ns'));
    });

    test('throws on empty messages', () {
      final client = createClient();
      expect(
        () => client.chatMemory(ChatMemoryParams(messages: [])),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('chatMemoryContext', () {
    test('sends to /memory/conversations', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.chatMemoryContext(ChatMemoryParams(
        messages: [{'role': 'user', 'content': 'Hi'}],
      ));

      expect(captured!.url.toString(), endsWith('/memory/conversations'));
    });
  });

  // ── Interactions ──

  group('interactMemory', () {
    test('sends correct request with entityNames', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.interactMemory(InteractMemoryParams(
        namespace: 'ns',
        entityNames: ['ENTITY_A', 'ENTITY_B'],
      ));

      expect(captured, isNotNull);
      expect(captured!.method, equals('POST'));
      expect(captured!.url.toString(), endsWith('/memory/interact'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['entityNames'], equals(['ENTITY_A', 'ENTITY_B']));
      expect(body['namespace'], equals('ns'));
    });

    test('throws on empty namespace', () {
      final client = createClient();
      expect(
        () => client.interactMemory(InteractMemoryParams(
          namespace: '',
          entityNames: ['E'],
        )),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on empty entityNames', () {
      final client = createClient();
      expect(
        () => client.interactMemory(InteractMemoryParams(
          namespace: 'ns',
          entityNames: [],
        )),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('recordInteractions', () {
    test('sends to /memory/interactions', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.recordInteractions(InteractMemoryParams(
        namespace: 'ns',
        entityNames: ['E'],
      ));

      expect(captured!.url.toString(), endsWith('/memory/interactions'));
    });
  });

  // ── Advanced Recall ──

  group('recallThoughts', () {
    test('sends to /memory/memories/thoughts', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.recallThoughts(RecallThoughtsParams(namespace: 'ns'));

      expect(captured!.method, equals('POST'));
      expect(
          captured!.url.toString(), endsWith('/memory/memories/thoughts'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['namespace'], equals('ns'));
    });

    test('works with no params', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.recallThoughts();

      expect(captured!.url.toString(), endsWith('/memory/memories/thoughts'));
    });
  });

  group('queryMemoryContext', () {
    test('sends correct request', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.queryMemoryContext(QueryMemoryContextParams(
        query: 'test query',
        namespace: 'ns',
      ));

      expect(captured!.method, equals('POST'));
      expect(captured!.url.toString(), endsWith('/memory/queries'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['query'], equals('test query'));
      expect(body['namespace'], equals('ns'));
    });

    test('throws on empty query', () {
      final client = createClient();
      expect(
        () => client.queryMemoryContext(
            QueryMemoryContextParams(query: '')),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── Documents ──

  group('insertDocument', () {
    test('sends correct request', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.insertDocument(InsertDocumentParams(
        title: 'Doc Title',
        content: 'Doc content',
        namespace: 'ns',
        documentId: 'doc-1',
      ));

      expect(captured!.method, equals('POST'));
      expect(captured!.url.toString(), endsWith('/memory/documents'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['title'], equals('Doc Title'));
      expect(body['content'], equals('Doc content'));
      expect(body['namespace'], equals('ns'));
    });

    test('throws on empty title', () {
      final client = createClient();
      expect(
        () => client.insertDocument(InsertDocumentParams(
          title: '',
          content: 'c',
          namespace: 'ns',
          documentId: 'doc-1',
        )),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on empty documentId', () {
      final client = createClient();
      expect(
        () => client.insertDocument(InsertDocumentParams(
          title: 't',
          content: 'c',
          namespace: 'ns',
          documentId: '',
        )),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('insertDocumentsBatch', () {
    test('serializes documents as items', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.insertDocumentsBatch(InsertDocumentsBatchParams(
        documents: [
          InsertDocumentParams(
              title: 'D1', content: 'C1', namespace: 'ns', documentId: 'doc-1'),
          InsertDocumentParams(
              title: 'D2', content: 'C2', namespace: 'ns', documentId: 'doc-2'),
        ],
      ));

      expect(captured!.url.toString(), endsWith('/memory/documents/batch'));
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body['items'], hasLength(2));
      expect(body.containsKey('documents'), isFalse);
    });

    test('throws on empty documents', () {
      final client = createClient();
      expect(
        () => client.insertDocumentsBatch(
            InsertDocumentsBatchParams(documents: [])),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('listDocuments', () {
    test('sends GET with query params', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.listDocuments(
          ListDocumentsParams(namespace: 'ns', page: 1, limit: 10));

      expect(captured!.method, equals('GET'));
      expect(captured!.url.toString(), contains('/memory/documents'));
      expect(captured!.url.queryParameters['namespace'], equals('ns'));
      expect(captured!.url.queryParameters['page'], equals('1'));
      expect(captured!.url.queryParameters['limit'], equals('10'));
    });
  });

  group('getDocument', () {
    test('sends GET with id in path', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.getDocument(
          GetDocumentParams(id: 'doc-123', namespace: 'ns'));

      expect(captured!.method, equals('GET'));
      expect(captured!.url.toString(), contains('/memory/documents/doc-123'));
      expect(captured!.url.queryParameters['namespace'], equals('ns'));
    });

    test('throws on empty id', () {
      final client = createClient();
      expect(
        () => client.getDocument(GetDocumentParams(id: '')),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('deleteDocument', () {
    test('sends DELETE with id in path', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.deleteDocument('doc-456', 'ns');

      expect(captured!.method, equals('DELETE'));
      expect(captured!.url.toString(), contains('/memory/documents/doc-456'));
      expect(captured!.url.queryParameters['namespace'], equals('ns'));
    });

    test('throws on empty documentId', () {
      final client = createClient();
      expect(
        () => client.deleteDocument(''),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ── Admin & Utility ──

  group('getGraphSnapshot', () {
    test('sends GET with query params', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.getGraphSnapshot(
          GraphSnapshotParams(namespace: 'ns'));

      expect(captured!.method, equals('GET'));
      expect(captured!.url.toString(),
          contains('/memory/admin/graph-snapshot'));
      expect(captured!.url.queryParameters['namespace'], equals('ns'));
    });
  });

  group('getIngestionJob', () {
    test('sends GET with jobId in path', () async {
      http.Request? captured;
      final client = createClient(
        onRequest: (r) => captured = r,
      );

      await client.getIngestionJob('job-789');

      expect(captured!.method, equals('GET'));
      expect(captured!.url.toString(),
          contains('/memory/ingestion/jobs/job-789'));
    });

    test('throws on empty jobId', () {
      final client = createClient();
      expect(
        () => client.getIngestionJob(''),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('waitForIngestionJob', () {
    test('returns on completed state', () async {
      final client = createClient(
        body:
            '{"data":{"state":"completed","jobId":"j1"}}',
      );

      final result = await client.waitForIngestionJob('j1');
      expect(result['data']['state'], equals('completed'));
    });

    test('returns on failed state', () async {
      final client = createClient(
        body: '{"data":{"state":"failed","jobId":"j1"}}',
      );

      final result = await client.waitForIngestionJob('j1');
      expect(result['data']['state'], equals('failed'));
    });
  });

  // ── Error handling ──

  group('error handling', () {
    test('throws TinyHumansError on 401', () async {
      final client = createClient(
        statusCode: 401,
        body: '{"error":"Unauthorized"}',
      );

      try {
        await client.recallMemory();
        fail('should have thrown');
      } on TinyHumansError catch (e) {
        expect(e.status, equals(401));
        expect(e.message, equals('Unauthorized'));
      }
    });

    test('throws TinyHumansError on non-JSON response', () async {
      final client = createClient(
        statusCode: 502,
        body: 'not json',
      );

      try {
        await client.recallMemory();
        fail('should have thrown');
      } on TinyHumansError catch (e) {
        expect(e.status, equals(502));
        expect(e.message, contains('non-JSON'));
      }
    });

    test('throws TinyHumansError on 500', () async {
      final client = createClient(
        statusCode: 500,
        body: '{"error":"Internal Server Error"}',
      );

      try {
        await client.recallMemory();
        fail('should have thrown');
      } on TinyHumansError catch (e) {
        expect(e.status, equals(500));
      }
    });
  });
}
