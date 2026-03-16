import 'dart:io' show Platform;

import 'package:alphahuman_sdk/alphahuman_sdk.dart';

Future<void> main() async {
  final token = Platform.environment['ALPHAHUMAN_TOKEN'];
  if (token == null || token.isEmpty) {
    print('Set ALPHAHUMAN_TOKEN environment variable to run this example.');
    return;
  }

  final client = AlphahumanMemoryClient(token);

  try {
    // Insert a memory
    final insertResp = await client.insertMemory(InsertMemoryParams(
      title: 'example-doc',
      content: 'Dart was created by Google and first appeared in 2011.',
      namespace: 'example-ns',
    ));
    print('Insert: success=${insertResp.success}, status=${insertResp.status}');

    // Recall context
    final recallResp = await client.recallMemory(
        RecallMemoryParams(namespace: 'example-ns'));
    print('Recall: success=${recallResp.success}, cached=${recallResp.cached}');

    // Query memory
    final queryResp = await client.queryMemory(QueryMemoryParams(
      query: 'When was Dart created?',
      namespace: 'example-ns',
    ));
    print('Query: success=${queryResp.success}, response=${queryResp.response}');

    // Recall memories (Ebbinghaus)
    final memoriesResp = await client.recallMemories(
        RecallMemoriesParams(namespace: 'example-ns'));
    print('Memories: success=${memoriesResp.success}, '
        'count=${memoriesResp.memories.length}');

    // Delete memory
    final deleteResp = await client.deleteMemory(
        DeleteMemoryParams(namespace: 'example-ns'));
    print('Delete: success=${deleteResp.success}, '
        'nodesDeleted=${deleteResp.nodesDeleted}');
  } finally {
    client.close();
  }
}
