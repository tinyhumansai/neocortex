// ── Insert ──

class InsertMemoryParams {
  final String? title;
  final String? content;
  final String? namespace;
  final String sourceType;
  final Map<String, dynamic>? metadata;
  final String? priority;
  final int? createdAt;
  final int? updatedAt;
  final String? documentId;

  InsertMemoryParams({
    this.title,
    this.content,
    this.namespace,
    this.sourceType = 'doc',
    this.metadata,
    this.priority,
    this.createdAt,
    this.updatedAt,
    this.documentId,
  });

  void validate() {
    if (title == null || title!.trim().isEmpty) {
      throw ArgumentError('title is required and must be a string');
    }
    if (content == null || content!.trim().isEmpty) {
      throw ArgumentError('content is required and must be a string');
    }
    if (namespace == null || namespace!.trim().isEmpty) {
      throw ArgumentError('namespace is required and must be a string');
    }
    if (documentId == null || documentId!.trim().isEmpty) {
      throw ArgumentError('documentId is required and must be a non-empty string');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'title': title,
      'content': content,
      'namespace': namespace,
      'sourceType': sourceType,
      'documentId': documentId,
    };
    if (metadata != null) map['metadata'] = metadata;
    if (priority != null) map['priority'] = priority;
    if (createdAt != null) map['createdAt'] = createdAt;
    if (updatedAt != null) map['updatedAt'] = updatedAt;
    return map;
  }
}

class InsertMemoryResponse {
  final bool success;
  final String status;
  final Map<String, dynamic>? stats;
  final Map<String, dynamic>? usage;

  InsertMemoryResponse({
    required this.success,
    required this.status,
    this.stats,
    this.usage,
  });

  factory InsertMemoryResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return InsertMemoryResponse(
      success: json['success'] as bool? ?? false,
      status: data['status'] as String? ?? '',
      stats: data['stats'] as Map<String, dynamic>?,
      usage: data['usage'] as Map<String, dynamic>?,
    );
  }
}

// ── Recall ──

class RecallMemoryParams {
  final String? namespace;
  final int? maxChunks;

  RecallMemoryParams({this.namespace, this.maxChunks});

  void validate() {
    if (maxChunks != null && maxChunks! <= 0) {
      throw ArgumentError('maxChunks must be a positive integer');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (namespace != null) map['namespace'] = namespace;
    if (maxChunks != null) map['maxChunks'] = maxChunks;
    return map;
  }
}

class RecallMemoryResponse {
  final bool success;
  final Map<String, dynamic>? context;
  final String? llmContextMessage;
  final bool cached;
  final Map<String, dynamic>? counts;
  final Map<String, dynamic>? usage;

  RecallMemoryResponse({
    required this.success,
    this.context,
    this.llmContextMessage,
    required this.cached,
    this.counts,
    this.usage,
  });

  factory RecallMemoryResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return RecallMemoryResponse(
      success: json['success'] as bool? ?? false,
      context: data['context'] as Map<String, dynamic>?,
      llmContextMessage: data['llmContextMessage'] as String?,
      cached: data['cached'] as bool? ?? false,
      counts: data['counts'] as Map<String, dynamic>?,
      usage: data['usage'] as Map<String, dynamic>?,
    );
  }
}

// ── Delete ──

class DeleteMemoryParams {
  final String? namespace;

  DeleteMemoryParams({this.namespace});

  void validate() {}

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (namespace != null) map['namespace'] = namespace;
    return map;
  }
}

class DeleteMemoryResponse {
  final bool success;
  final int nodesDeleted;
  final String status;
  final String message;

  DeleteMemoryResponse({
    required this.success,
    required this.nodesDeleted,
    required this.status,
    required this.message,
  });

  factory DeleteMemoryResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return DeleteMemoryResponse(
      success: json['success'] as bool? ?? false,
      nodesDeleted: data['nodesDeleted'] as int? ?? 0,
      status: data['status'] as String? ?? '',
      message: data['message'] as String? ?? '',
    );
  }
}

// ── Query ──

class QueryMemoryParams {
  final String? query;
  final String? namespace;
  final int? maxChunks;
  final bool? includeReferences;
  final List<String>? documentIds;
  final String? llmQuery;

  QueryMemoryParams({
    this.query,
    this.namespace,
    this.maxChunks,
    this.includeReferences,
    this.documentIds,
    this.llmQuery,
  });

  void validate() {
    if (query == null || query!.trim().isEmpty) {
      throw ArgumentError('query is required and must be a string');
    }
    if (maxChunks != null && (maxChunks! < 1 || maxChunks! > 200)) {
      throw ArgumentError('maxChunks must be between 1 and 200');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'query': query,
    };
    if (namespace != null) map['namespace'] = namespace;
    if (maxChunks != null) map['maxChunks'] = maxChunks;
    if (includeReferences != null) {
      map['includeReferences'] = includeReferences;
    }
    if (documentIds != null) map['documentIds'] = documentIds;
    if (llmQuery != null) map['llmQuery'] = llmQuery;
    return map;
  }
}

class QueryMemoryResponse {
  final bool success;
  final Map<String, dynamic>? context;
  final String? llmContextMessage;
  final bool cached;
  final String? response;
  final Map<String, dynamic>? usage;

  QueryMemoryResponse({
    required this.success,
    this.context,
    this.llmContextMessage,
    required this.cached,
    this.response,
    this.usage,
  });

  factory QueryMemoryResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return QueryMemoryResponse(
      success: json['success'] as bool? ?? false,
      context: data['context'] as Map<String, dynamic>?,
      llmContextMessage: data['llmContextMessage'] as String?,
      cached: data['cached'] as bool? ?? false,
      response: data['response'] as String?,
      usage: data['usage'] as Map<String, dynamic>?,
    );
  }
}

// ── Recall Memories (Ebbinghaus) ──

class RecallMemoriesParams {
  final String? namespace;
  final int? topK;
  final double? minRetention;
  final int? asOf;

  RecallMemoriesParams({
    this.namespace,
    this.topK,
    this.minRetention,
    this.asOf,
  });

  void validate() {
    if (topK != null && topK! <= 0) {
      throw ArgumentError('topK must be a positive number');
    }
    if (minRetention != null && minRetention! < 0) {
      throw ArgumentError('minRetention must be a non-negative number');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (namespace != null) map['namespace'] = namespace;
    if (topK != null) map['topK'] = topK;
    if (minRetention != null) map['minRetention'] = minRetention;
    if (asOf != null) map['asOf'] = asOf;
    return map;
  }
}

class RecallMemoriesResponse {
  final bool success;
  final List<Map<String, dynamic>> memories;

  RecallMemoriesResponse({
    required this.success,
    required this.memories,
  });

  factory RecallMemoriesResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final memoriesRaw = data['memories'] as List<dynamic>? ?? [];
    return RecallMemoriesResponse(
      success: json['success'] as bool? ?? false,
      memories: memoriesRaw
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
    );
  }
}

// ── Chat ──

class ChatMemoryParams {
  final List<Map<String, String>> messages;
  final String? namespace;
  final double? temperature;
  final int? maxTokens;
  final String? model;

  ChatMemoryParams({
    required this.messages,
    this.namespace,
    this.temperature,
    this.maxTokens,
    this.model,
  });

  void validate() {
    if (messages.isEmpty) {
      throw ArgumentError('messages must not be empty');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'messages': messages,
    };
    if (namespace != null) map['namespace'] = namespace;
    if (temperature != null) map['temperature'] = temperature;
    if (maxTokens != null) map['maxTokens'] = maxTokens;
    if (model != null) map['model'] = model;
    return map;
  }
}

// ── Interactions ──

class InteractMemoryParams {
  final String namespace;
  final List<String> entityNames;
  final String? description;
  final String? interactionLevel;
  final List<String>? interactionLevels;
  final int? timestamp;

  InteractMemoryParams({
    required this.namespace,
    required this.entityNames,
    this.description,
    this.interactionLevel,
    this.interactionLevels,
    this.timestamp,
  });

  void validate() {
    if (namespace.trim().isEmpty) {
      throw ArgumentError('namespace is required');
    }
    if (entityNames.isEmpty) {
      throw ArgumentError('entityNames must not be empty');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'namespace': namespace,
      'entityNames': entityNames,
    };
    if (description != null) map['description'] = description;
    if (interactionLevel != null) {
      map['interactionLevel'] = interactionLevel;
    }
    if (interactionLevels != null) {
      map['interactionLevels'] = interactionLevels;
    }
    if (timestamp != null) map['timestamp'] = timestamp;
    return map;
  }
}

// ── Advanced Recall ──

class RecallThoughtsParams {
  final String? namespace;
  final int? maxChunks;
  final double? temperature;
  final int? randomnessSeed;
  final bool? persist;
  final bool? enablePredictionCheck;
  final String? thoughtPrompt;

  RecallThoughtsParams({
    this.namespace,
    this.maxChunks,
    this.temperature,
    this.randomnessSeed,
    this.persist,
    this.enablePredictionCheck,
    this.thoughtPrompt,
  });

  void validate() {}

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (namespace != null) map['namespace'] = namespace;
    if (maxChunks != null) map['maxChunks'] = maxChunks;
    if (temperature != null) map['temperature'] = temperature;
    if (randomnessSeed != null) map['randomnessSeed'] = randomnessSeed;
    if (persist != null) map['persist'] = persist;
    if (enablePredictionCheck != null) {
      map['enablePredictionCheck'] = enablePredictionCheck;
    }
    if (thoughtPrompt != null) map['thoughtPrompt'] = thoughtPrompt;
    return map;
  }
}

class QueryMemoryContextParams {
  final String query;
  final String? namespace;
  final int? maxChunks;
  final bool? includeReferences;
  final List<String>? documentIds;
  final bool? recallOnly;
  final String? llmQuery;

  QueryMemoryContextParams({
    required this.query,
    this.namespace,
    this.maxChunks,
    this.includeReferences,
    this.documentIds,
    this.recallOnly,
    this.llmQuery,
  });

  void validate() {
    if (query.trim().isEmpty) {
      throw ArgumentError('query is required');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'query': query,
    };
    if (namespace != null) map['namespace'] = namespace;
    if (maxChunks != null) map['maxChunks'] = maxChunks;
    if (includeReferences != null) {
      map['includeReferences'] = includeReferences;
    }
    if (documentIds != null) map['documentIds'] = documentIds;
    if (recallOnly != null) map['recallOnly'] = recallOnly;
    if (llmQuery != null) map['llmQuery'] = llmQuery;
    return map;
  }
}

// ── Documents ──

class InsertDocumentParams {
  final String title;
  final String content;
  final String namespace;
  final String documentId;
  final Map<String, dynamic>? metadata;
  final String? sourceType;

  InsertDocumentParams({
    required this.title,
    required this.content,
    required this.namespace,
    required this.documentId,
    this.metadata,
    this.sourceType,
  });

  void validate() {
    if (title.trim().isEmpty) {
      throw ArgumentError('title is required');
    }
    if (content.trim().isEmpty) {
      throw ArgumentError('content is required');
    }
    if (namespace.trim().isEmpty) {
      throw ArgumentError('namespace is required');
    }
    if (documentId.trim().isEmpty) {
      throw ArgumentError('documentId is required');
    }
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'title': title,
      'content': content,
      'namespace': namespace,
      'documentId': documentId,
    };
    if (metadata != null) map['metadata'] = metadata;
    if (sourceType != null) map['sourceType'] = sourceType;
    return map;
  }
}

class InsertDocumentsBatchParams {
  final List<InsertDocumentParams> documents;

  InsertDocumentsBatchParams({required this.documents});

  void validate() {
    if (documents.isEmpty) {
      throw ArgumentError('documents must not be empty');
    }
    for (final doc in documents) {
      doc.validate();
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'items': documents.map((d) => d.toJson()).toList(),
    };
  }
}

class ListDocumentsParams {
  final String? namespace;
  final int? page;
  final int? limit;

  ListDocumentsParams({this.namespace, this.page, this.limit});

  Map<String, String> toQueryParams() {
    final map = <String, String>{};
    if (namespace != null) map['namespace'] = namespace!;
    if (page != null) map['page'] = page.toString();
    if (limit != null) map['limit'] = limit.toString();
    return map;
  }
}

class GetDocumentParams {
  final String id;
  final String? namespace;

  GetDocumentParams({required this.id, this.namespace});

  void validate() {
    if (id.trim().isEmpty) {
      throw ArgumentError('id is required');
    }
  }

  Map<String, String> toQueryParams() {
    final map = <String, String>{};
    if (namespace != null) map['namespace'] = namespace!;
    return map;
  }
}

// ── Admin & Utility ──

class GraphSnapshotParams {
  final String? namespace;
  final String? mode;
  final int? limit;
  final int? seedLimit;

  GraphSnapshotParams({
    this.namespace,
    this.mode,
    this.limit,
    this.seedLimit,
  });

  Map<String, String> toQueryParams() {
    final map = <String, String>{};
    if (namespace != null) map['namespace'] = namespace!;
    if (mode != null) map['mode'] = mode!;
    if (limit != null) map['limit'] = limit.toString();
    if (seedLimit != null) map['seedLimit'] = seedLimit.toString();
    return map;
  }
}

class WaitForIngestionJobOptions {
  final int intervalMs;
  final int maxAttempts;

  WaitForIngestionJobOptions({
    this.intervalMs = 2000,
    this.maxAttempts = 30,
  });
}
