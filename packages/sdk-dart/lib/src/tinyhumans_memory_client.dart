import 'dart:convert';
import 'dart:io' show Platform;

import 'package:http/http.dart' as http;

import 'tinyhumans_error.dart';
import 'types.dart';

class TinyHumansMemoryClient {
  static const _defaultBaseUrl = 'https://api.tinyhumans.ai';
  static const _defaultModelId = 'neocortex-mk1';

  final String _token;
  final String _baseUrl;
  final String _modelId;
  final http.Client _httpClient;
  final bool _ownsClient;

  TinyHumansMemoryClient(
    String token, {
    String? modelId,
    String? baseUrl,
    http.Client? httpClient,
  })  : _token = token,
        _modelId = (modelId != null && modelId.trim().isNotEmpty)
            ? modelId
            : _defaultModelId,
        _baseUrl = (baseUrl ??
                Platform.environment['TINYHUMANS_BASE_URL'] ??
                _defaultBaseUrl)
            .replaceAll(RegExp(r'/+$'), ''),
        _httpClient = httpClient ?? http.Client(),
        _ownsClient = httpClient == null {
    if (token.trim().isEmpty) {
      throw ArgumentError('token is required');
    }
  }

  Future<InsertMemoryResponse> insertMemory(InsertMemoryParams params) async {
    params.validate();
    final result = await _post('/memory/insert', params.toJson());
    return InsertMemoryResponse.fromJson(result);
  }

  Future<RecallMemoryResponse> recallMemory([RecallMemoryParams? params]) async {
    params ??= RecallMemoryParams();
    params.validate();
    final result = await _post('/memory/recall', params.toJson());
    return RecallMemoryResponse.fromJson(result);
  }

  Future<DeleteMemoryResponse> deleteMemory([DeleteMemoryParams? params]) async {
    params ??= DeleteMemoryParams();
    params.validate();
    final result = await _post('/memory/admin/delete', params.toJson());
    return DeleteMemoryResponse.fromJson(result);
  }

  Future<QueryMemoryResponse> queryMemory(QueryMemoryParams params) async {
    params.validate();
    final result = await _post('/memory/query', params.toJson());
    return QueryMemoryResponse.fromJson(result);
  }

  Future<RecallMemoriesResponse> recallMemories(
      [RecallMemoriesParams? params]) async {
    params ??= RecallMemoriesParams();
    params.validate();
    final result = await _post('/memory/memories/recall', params.toJson());
    return RecallMemoriesResponse.fromJson(result);
  }

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    final url = Uri.parse('$_baseUrl$path');
    final response = await _httpClient.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_token',
        'X-Model-Id': _modelId,
      },
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> _get(String path,
      [Map<String, String>? queryParams]) async {
    var uri = Uri.parse('$_baseUrl$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final response = await _httpClient.get(
      uri,
      headers: {
        'Authorization': 'Bearer $_token',
        'X-Model-Id': _modelId,
      },
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> _delete(String path,
      [Map<String, String>? queryParams]) async {
    var uri = Uri.parse('$_baseUrl$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final response = await _httpClient.delete(
      uri,
      headers: {
        'Authorization': 'Bearer $_token',
        'X-Model-Id': _modelId,
      },
    );
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    Map<String, dynamic> json;
    try {
      json = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
    } catch (_) {
      throw TinyHumansError(
        'HTTP ${response.statusCode}: non-JSON response',
        response.statusCode,
        response.body,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message =
          json['error'] as String? ?? 'HTTP ${response.statusCode}';
      throw TinyHumansError(message, response.statusCode, response.body);
    }

    return json;
  }

  void close() {
    if (_ownsClient) {
      _httpClient.close();
    }
  }
}
