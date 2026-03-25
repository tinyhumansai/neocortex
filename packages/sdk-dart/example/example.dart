import 'dart:io' show Platform;

import 'package:tinyhumans_sdk/tinyhumans_sdk.dart';

Future<void> main() async {
  final token = Platform.environment['TINYHUMANS_TOKEN'];
  if (token == null || token.isEmpty) {
    print('Set TINYHUMANS_TOKEN environment variable to run this example.');
    return;
  }

  final client = TinyHumansMemoryClient(token);
  final ns = 'example-dart-${DateTime.now().millisecondsSinceEpoch}';

  try {
    // 1. Insert Memory
    print('=== Insert Memory ===');
    final insertResp = await client.insertMemory(InsertMemoryParams(
      title: 'example-doc',
      content: 'Dart was created by Google and first appeared in 2011.',
      namespace: ns,
    ));
    print('Success=${insertResp.success} Status=${insertResp.status}');

    await Future.delayed(const Duration(seconds: 2));

    // 2. Recall Memory (Master)
    print('\n=== Recall Memory ===');
    final recallResp =
        await client.recallMemory(RecallMemoryParams(namespace: ns));
    print('Success=${recallResp.success} Cached=${recallResp.cached}');

    // 3. Query Memory
    print('\n=== Query Memory ===');
    try {
      final queryResp = await client.queryMemory(QueryMemoryParams(
        query: 'When was Dart created?',
        namespace: ns,
      ));
      print('Success=${queryResp.success} Cached=${queryResp.cached}');
    } catch (e) {
      print('QueryMemory: $e');
    }

    // 4. Query Memory Context
    print('\n=== Query Memory Context ===');
    try {
      final qmcResp = await client.queryMemoryContext(
          QueryMemoryContextParams(query: 'Dart creation', namespace: ns));
      print('QueryMemoryContext: $qmcResp');
    } catch (e) {
      print('QueryMemoryContext: $e');
    }

    // 5. Recall Memories (Ebbinghaus)
    print('\n=== Recall Memories ===');
    final memoriesResp =
        await client.recallMemories(RecallMemoriesParams(namespace: ns));
    print(
        'Success=${memoriesResp.success} Count=${memoriesResp.memories.length}');

    // 6. Recall Thoughts
    print('\n=== Recall Thoughts ===');
    try {
      final thoughtsResp =
          await client.recallThoughts(RecallThoughtsParams(namespace: ns));
      print('RecallThoughts: $thoughtsResp');
    } catch (e) {
      print('RecallThoughts: $e');
    }

    // 7. Interact Memory
    print('\n=== Interact Memory ===');
    try {
      final interactResp = await client.interactMemory(InteractMemoryParams(
        namespace: ns,
        entityNames: ['DART SDK'],
      ));
      print('InteractMemory: $interactResp');
    } catch (e) {
      print('InteractMemory: $e');
    }

    // 8. Record Interactions
    print('\n=== Record Interactions ===');
    try {
      final recordResp =
          await client.recordInteractions(InteractMemoryParams(
        namespace: ns,
        entityNames: ['DART SDK'],
      ));
      print('RecordInteractions: $recordResp');
    } catch (e) {
      print('RecordInteractions: $e');
    }

    // 9. Insert Document
    print('\n=== Insert Document ===');
    try {
      final docResp = await client.insertDocument(InsertDocumentParams(
        title: 'Dart Guide',
        content: 'Dart SDK usage guide',
        namespace: ns,
      ));
      print('InsertDocument: $docResp');
    } catch (e) {
      print('InsertDocument: $e');
    }

    // 10. Insert Documents Batch
    print('\n=== Insert Documents Batch ===');
    try {
      final batchResp =
          await client.insertDocumentsBatch(InsertDocumentsBatchParams(
        documents: [
          InsertDocumentParams(
              title: 'Doc 1', content: 'Content 1', namespace: ns),
          InsertDocumentParams(
              title: 'Doc 2', content: 'Content 2', namespace: ns),
        ],
      ));
      print('InsertDocumentsBatch: $batchResp');
    } catch (e) {
      print('InsertDocumentsBatch: $e');
    }

    // 11. List Documents
    print('\n=== List Documents ===');
    try {
      final listResp =
          await client.listDocuments(ListDocumentsParams(namespace: ns));
      print('ListDocuments: $listResp');
    } catch (e) {
      print('ListDocuments: $e');
    }

    // 12. Chat Memory
    print('\n=== Chat Memory ===');
    try {
      final chatResp = await client.chatMemory(ChatMemoryParams(
        messages: [
          {'role': 'user', 'content': 'Hello!'}
        ],
      ));
      print('ChatMemory: $chatResp');
    } catch (e) {
      print('ChatMemory: $e');
    }

    // 13. Chat Memory Context
    print('\n=== Chat Memory Context ===');
    try {
      final chatCtxResp = await client.chatMemoryContext(ChatMemoryParams(
        messages: [
          {'role': 'user', 'content': 'Hello!'}
        ],
      ));
      print('ChatMemoryContext: $chatCtxResp');
    } catch (e) {
      print('ChatMemoryContext: $e');
    }

    // 14. Get Graph Snapshot
    print('\n=== Get Graph Snapshot ===');
    try {
      final graphResp = await client
          .getGraphSnapshot(GraphSnapshotParams(namespace: ns));
      print('GetGraphSnapshot: $graphResp');
    } catch (e) {
      print('GetGraphSnapshot: $e');
    }

    // 15. Delete Memory
    print('\n=== Delete Memory ===');
    try {
      final deleteResp =
          await client.deleteMemory(DeleteMemoryParams(namespace: ns));
      print(
          'Success=${deleteResp.success} Deleted=${deleteResp.nodesDeleted}');
    } catch (e) {
      print('DeleteMemory: $e');
    }
  } finally {
    client.close();
  }
}
