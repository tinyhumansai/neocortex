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
