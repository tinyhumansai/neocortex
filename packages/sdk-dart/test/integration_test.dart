import 'dart:io' show Platform;

import 'package:test/test.dart';

import 'package:tinyhumans_sdk/tinyhumans_sdk.dart';

void main() {
  test('full lifecycle', () async {
    final token = Platform.environment['TINYHUMANS_TOKEN'];
    if (token == null || token.isEmpty) {
      print('TINYHUMANS_TOKEN not set — skipping integration test');
      return;
    }

    final ns =
        'integration-test-dart-${DateTime.now().millisecondsSinceEpoch}';
    final client = TinyHumansMemoryClient(token);

    try {
      // ── Insert Memory ──
      final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final insertResp = await client.insertMemory(InsertMemoryParams(
        title: 'test-key-1',
        content: 'The capital of France is Paris.',
        namespace: ns,
        documentId: 'integration-test-doc-1',
        metadata: {'source': 'integration-test'},
        createdAt: nowSeconds,
        updatedAt: nowSeconds,
      ));
      expect(insertResp.success, isTrue, reason: 'insert should succeed');
      print('Insert: status=${insertResp.status}');

      await Future.delayed(const Duration(seconds: 2));

      // ── Recall Memory ──
      final recallResp =
          await client.recallMemory(RecallMemoryParams(namespace: ns));
      expect(recallResp.success, isTrue, reason: 'recall should succeed');
      print('Recall: cached=${recallResp.cached}');

      // ── Recall Memories (Ebbinghaus) ──
      final memoriesResp =
          await client.recallMemories(RecallMemoriesParams(namespace: ns));
      expect(memoriesResp.success, isTrue,
          reason: 'recall memories should succeed');
      print('RecallMemories: count=${memoriesResp.memories.length}');

      // ── Insert Document ──
      try {
        final docResp = await client.insertDocument(InsertDocumentParams(
          title: 'Test Doc',
          content: 'Document content for integration test',
          namespace: ns,
          documentId: 'test-doc-1',
        ));
        print('InsertDocument: $docResp');
      } catch (e) {
        print('InsertDocument: $e');
      }

      // ── Insert Documents Batch ──
      try {
        final batchResp =
            await client.insertDocumentsBatch(InsertDocumentsBatchParams(
          documents: [
            InsertDocumentParams(
                title: 'Batch 1', content: 'Content 1', namespace: ns, documentId: 'batch-doc-1'),
            InsertDocumentParams(
                title: 'Batch 2', content: 'Content 2', namespace: ns, documentId: 'batch-doc-2'),
          ],
        ));
        print('InsertDocumentsBatch: $batchResp');
      } catch (e) {
        print('InsertDocumentsBatch: $e');
      }

      // ── List Documents ──
      try {
        final listResp =
            await client.listDocuments(ListDocumentsParams(namespace: ns));
        print('ListDocuments: $listResp');
      } catch (e) {
        print('ListDocuments: $e');
      }

      // ── Interact Memory ──
      try {
        final interactResp =
            await client.interactMemory(InteractMemoryParams(
          namespace: ns,
          entityNames: ['TEST ENTITY'],
        ));
        print('InteractMemory: $interactResp');
      } catch (e) {
        print('InteractMemory: $e');
      }

      // ── Record Interactions ──
      try {
        final recordResp =
            await client.recordInteractions(InteractMemoryParams(
          namespace: ns,
          entityNames: ['TEST ENTITY'],
        ));
        print('RecordInteractions: $recordResp');
      } catch (e) {
        print('RecordInteractions: $e');
      }

      // ── Recall Thoughts ──
      try {
        final thoughtsResp = await client
            .recallThoughts(RecallThoughtsParams(namespace: ns));
        print('RecallThoughts: $thoughtsResp');
      } catch (e) {
        print('RecallThoughts: $e');
      }

      // ── Query Memory Context ──
      try {
        final qmcResp = await client.queryMemoryContext(
            QueryMemoryContextParams(
                query: 'capital of France', namespace: ns));
        print('QueryMemoryContext: $qmcResp');
      } catch (e) {
        print('QueryMemoryContext: $e');
      }

      // ── Get Graph Snapshot ──
      try {
        final graphResp = await client
            .getGraphSnapshot(GraphSnapshotParams(namespace: ns));
        print('GetGraphSnapshot: $graphResp');
      } catch (e) {
        print('GetGraphSnapshot: $e');
      }

      // ── Delete Memory ──
      try {
        final deleteResp =
            await client.deleteMemory(DeleteMemoryParams(namespace: ns));
        print('Delete: nodesDeleted=${deleteResp.nodesDeleted}');
      } catch (e) {
        print('DeleteMemory: $e');
      }
    } finally {
      client.close();
    }
  });
}
