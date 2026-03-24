package xyz.tinyhumans.sdk;

import xyz.tinyhumans.sdk.internal.Json;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Client for the TinyHuman Memory API.
 * <p>
 * Requires Java 11+. Zero runtime dependencies.
 */
public class TinyHumansMemoryClient implements AutoCloseable {

    private static final String DEFAULT_BASE_URL = "https://api.tinyhumans.ai";
    private static final String DEFAULT_MODEL_ID = "neocortex-mk1";
    private static final String TINYHUMANS_BASE_URL = "TINYHUMANS_BASE_URL";

    private final String baseUrl;
    private final String token;
    private final String modelId;
    private final HttpClient httpClient;

    public TinyHumansMemoryClient(String token) {
        this(token, (String) null);
    }

    public TinyHumansMemoryClient(String token, String baseUrl) {
        this(token, null, baseUrl);
    }

    public TinyHumansMemoryClient(String token, String modelId, String baseUrl) {
        if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("token is required");
        }
        this.token = token;
        this.modelId = (modelId != null && !modelId.isEmpty()) ? modelId : DEFAULT_MODEL_ID;

        String resolved = baseUrl;
        if (resolved == null || resolved.isEmpty()) {
            resolved = System.getenv(TINYHUMANS_BASE_URL);
        }
        if (resolved == null || resolved.isEmpty()) {
            resolved = DEFAULT_BASE_URL;
        }
        this.baseUrl = resolved.replaceAll("/+$", "");

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    /** Insert (ingest) a document into memory. POST /memory/insert */
    public InsertMemoryResponse insertMemory(InsertMemoryParams params) {
        Map<String, Object> body = params.toMap();
        Map<String, Object> response = post("/memory/insert", body);
        return InsertMemoryResponse.fromMap(response);
    }

    /** Recall context from Master node. POST /memory/recall */
    public RecallMemoryResponse recallMemory(RecallMemoryParams params) {
        Map<String, Object> body = params.toMap();
        Map<String, Object> response = post("/memory/recall", body);
        return RecallMemoryResponse.fromMap(response);
    }

    /** Delete memory (admin). POST /memory/admin/delete */
    public DeleteMemoryResponse deleteMemory(DeleteMemoryParams params) {
        Map<String, Object> body = params.toMap();
        Map<String, Object> response = post("/memory/admin/delete", body);
        return DeleteMemoryResponse.fromMap(response);
    }

    /** Query memory via RAG. POST /memory/query */
    public QueryMemoryResponse queryMemory(QueryMemoryParams params) {
        Map<String, Object> body = params.toMap();
        Map<String, Object> response = post("/memory/query", body);
        return QueryMemoryResponse.fromMap(response);
    }

    /** Recall memories from Ebbinghaus bank. POST /memory/memories/recall */
    public RecallMemoriesResponse recallMemories(RecallMemoriesParams params) {
        Map<String, Object> body = params.toMap();
        Map<String, Object> response = post("/memory/memories/recall", body);
        return RecallMemoriesResponse.fromMap(response);
    }

    /** Insert a document. POST /memory/documents */
    public Map<String, Object> insertDocument(InsertDocumentParams params) {
        return post("/memory/documents", params.toMap());
    }

    /** Insert documents in batch. POST /memory/documents/batch */
    public Map<String, Object> insertDocumentsBatch(InsertDocumentsBatchParams params) {
        return post("/memory/documents/batch", params.toMap());
    }

    /** List documents. GET /memory/documents */
    public Map<String, Object> listDocuments(ListDocumentsParams params) {
        return sendGet("/memory/documents", params != null ? params.toQueryParams() : null);
    }

    /** Get a document by ID. GET /memory/documents/{documentId} */
    public Map<String, Object> getDocument(GetDocumentParams params) {
        params.validate();
        return sendGet("/memory/documents/" + params.getDocumentId(), params.toQueryParams());
    }

    /** Delete a document. DELETE /memory/documents/{documentId} */
    public Map<String, Object> deleteDocument(String documentId, String namespace) {
        if (documentId == null || documentId.isEmpty()) {
            throw new IllegalArgumentException("documentId is required");
        }
        if (namespace == null || namespace.isEmpty()) {
            throw new IllegalArgumentException("namespace is required");
        }
        return sendDelete("/memory/documents/" + documentId, Map.of("namespace", namespace));
    }

    /** Generate reflective thoughts. POST /memory/memories/thoughts */
    public Map<String, Object> recallThoughts(RecallThoughtsParams params) {
        return post("/memory/memories/thoughts", params != null ? params.toMap() : Map.of());
    }

    /** Query memory context. POST /memory/queries */
    public Map<String, Object> queryMemoryContext(QueryMemoryContextParams params) {
        return post("/memory/queries", params.toMap());
    }

    /** Record entity interactions. POST /memory/interact */
    public Map<String, Object> interactMemory(InteractMemoryParams params) {
        return post("/memory/interact", params.toMap());
    }

    /** Record interaction signals. POST /memory/interactions */
    public Map<String, Object> recordInteractions(InteractMemoryParams params) {
        return post("/memory/interactions", params.toMap());
    }

    /** Chat with DeltaNet memory cache. POST /memory/chat */
    public Map<String, Object> chatMemory(ChatMemoryParams params) {
        return post("/memory/chat", params.toMap());
    }

    /** Chat with memory context. POST /memory/conversations */
    public Map<String, Object> chatMemoryContext(ChatMemoryParams params) {
        return post("/memory/conversations", params.toMap());
    }

    @Override
    public void close() {
        // HttpClient does not require explicit close in Java 11
    }

    // ---- Internal ----

    private Map<String, Object> post(String path, Map<String, Object> body) {
        String jsonBody = Json.serialize(body);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .header("X-Model-Id", modelId)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("HTTP request failed: " + e.getMessage(), e);
        }

        return handleResponse(response);
    }

    Map<String, Object> sendGet(String path, Map<String, String> params) {
        String url = baseUrl + path + buildQueryString(params);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("X-Model-Id", modelId)
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("HTTP request failed: " + e.getMessage(), e);
        }

        return handleResponse(response);
    }

    Map<String, Object> sendDelete(String path, Map<String, String> params) {
        String url = baseUrl + path + buildQueryString(params);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + token)
                .header("X-Model-Id", modelId)
                .DELETE()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("HTTP request failed: " + e.getMessage(), e);
        }

        return handleResponse(response);
    }

    private String buildQueryString(Map<String, String> params) {
        if (params == null || params.isEmpty()) return "";
        StringJoiner joiner = new StringJoiner("&", "?", "");
        for (Map.Entry<String, String> entry : params.entrySet()) {
            joiner.add(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                    + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return joiner.toString();
    }

    private Map<String, Object> handleResponse(HttpResponse<String> response) {
        String text = response.body();
        Map<String, Object> json;
        try {
            json = (text != null && !text.isEmpty()) ? Json.parse(text) : Map.of();
        } catch (Exception e) {
            throw new TinyHumansError(
                    "HTTP " + response.statusCode() + ": non-JSON response",
                    response.statusCode(),
                    text
            );
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = "HTTP " + response.statusCode();
            Object error = json.get("error");
            if (error instanceof String) {
                message = (String) error;
            }
            throw new TinyHumansError(message, response.statusCode(), json);
        }

        return json;
    }
}
