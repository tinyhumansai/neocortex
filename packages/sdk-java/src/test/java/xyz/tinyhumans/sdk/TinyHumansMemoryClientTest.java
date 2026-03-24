package xyz.tinyhumans.sdk;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TinyHumansMemoryClientTest {

    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        baseUrl = "http://localhost:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    // ---- Constructor tests ----

    @Test
    void constructorRejectsNullToken() {
        assertThrows(IllegalArgumentException.class, () -> new TinyHumansMemoryClient(null));
    }

    @Test
    void constructorRejectsEmptyToken() {
        assertThrows(IllegalArgumentException.class, () -> new TinyHumansMemoryClient(""));
    }

    @Test
    void constructorRejectsWhitespaceToken() {
        assertThrows(IllegalArgumentException.class, () -> new TinyHumansMemoryClient("   "));
    }

    @Test
    void constructorAcceptsValidToken() {
        TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl);
        assertNotNull(client);
        client.close();
    }

    // ---- modelId and X-Model-Id header ----

    @Test
    void defaultModelIdIsNeocortexMk1() {
        server.createContext("/memory/insert", exchange -> {
            assertEquals("neocortex-mk1", exchange.getRequestHeaders().getFirst("X-Model-Id"));
            String response = "{\"success\":true,\"data\":{\"status\":\"completed\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            client.insertMemory(new InsertMemoryParams("t", "c", "n"));
        }
    }

    @Test
    void customModelIdSentInHeader() {
        server.createContext("/memory/insert", exchange -> {
            assertEquals("custom-model", exchange.getRequestHeaders().getFirst("X-Model-Id"));
            String response = "{\"success\":true,\"data\":{\"status\":\"completed\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", "custom-model", baseUrl)) {
            client.insertMemory(new InsertMemoryParams("t", "c", "n"));
        }
    }

    @Test
    void emptyModelIdDefaultsToNeocortex() {
        server.createContext("/memory/insert", exchange -> {
            assertEquals("neocortex-mk1", exchange.getRequestHeaders().getFirst("X-Model-Id"));
            String response = "{\"success\":true,\"data\":{\"status\":\"completed\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", "", baseUrl)) {
            client.insertMemory(new InsertMemoryParams("t", "c", "n"));
        }
    }

    // ---- sendGet ----

    @Test
    void sendGetWithQueryParams() {
        server.createContext("/memory/documents", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            assertTrue(exchange.getRequestURI().getQuery().contains("namespace=ns"));
            assertTrue(exchange.getRequestURI().getQuery().contains("limit=10"));
            assertNotNull(exchange.getRequestHeaders().getFirst("X-Model-Id"));
            String response = "{\"data\":{\"documents\":[]}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("namespace", "ns");
            params.put("limit", "10");
            Map<String, Object> result = client.sendGet("/memory/documents", params);
            assertNotNull(result);
        }
    }

    @Test
    void sendGetNullParams() {
        server.createContext("/memory/test", exchange -> {
            assertNull(exchange.getRequestURI().getQuery());
            String response = "{\"data\":{}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            client.sendGet("/memory/test", null);
        }
    }

    // ---- sendDelete ----

    @Test
    void sendDeleteWithQueryParams() {
        server.createContext("/memory/documents/doc1", exchange -> {
            assertEquals("DELETE", exchange.getRequestMethod());
            assertTrue(exchange.getRequestURI().getQuery().contains("namespace=ns"));
            assertNotNull(exchange.getRequestHeaders().getFirst("X-Model-Id"));
            String response = "{\"data\":{\"deleted\":true}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("namespace", "ns");
            Map<String, Object> result = client.sendDelete("/memory/documents/doc1", params);
            assertNotNull(result);
        }
    }

    // ---- insertMemory ----

    @Test
    void insertMemorySendsCorrectRequest() {
        server.createContext("/memory/insert", exchange -> {
            // Verify headers
            assertEquals("application/json", exchange.getRequestHeaders().getFirst("Content-Type"));
            assertTrue(exchange.getRequestHeaders().getFirst("Authorization").startsWith("Bearer "));
            assertEquals("POST", exchange.getRequestMethod());

            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"title\""));
            assertTrue(body.contains("\"content\""));
            assertTrue(body.contains("\"namespace\""));

            String response = "{\"success\":true,\"data\":{\"status\":\"completed\",\"stats\":{\"chunks\":1}}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            InsertMemoryResponse resp = client.insertMemory(
                    new InsertMemoryParams("title", "content", "ns"));
            assertTrue(resp.isSuccess());
            assertEquals("completed", resp.getStatus());
        }
    }

    @Test
    void insertMemoryValidatesMissingTitle() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams(null, "content", "ns")));
        }
    }

    @Test
    void insertMemoryValidatesMissingContent() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams("title", null, "ns")));
        }
    }

    @Test
    void insertMemoryValidatesMissingNamespace() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams("title", "content", null)));
        }
    }

    // ---- recallMemory ----

    @Test
    void recallMemoryParsesResponse() {
        server.createContext("/memory/recall", exchange -> {
            String response = "{\"success\":true,\"data\":{\"cached\":false,\"llmContextMessage\":\"ctx\",\"counts\":{\"numEntities\":1}}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            RecallMemoryResponse resp = client.recallMemory(new RecallMemoryParams());
            assertTrue(resp.isSuccess());
            assertFalse(resp.isCached());
            assertEquals("ctx", resp.getLlmContextMessage());
        }
    }

    @Test
    void recallMemoryValidatesMaxChunks() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            RecallMemoryParams params = new RecallMemoryParams().setMaxChunks(0);
            assertThrows(IllegalArgumentException.class, () -> client.recallMemory(params));

            RecallMemoryParams params2 = new RecallMemoryParams().setMaxChunks(-1);
            assertThrows(IllegalArgumentException.class, () -> client.recallMemory(params2));
        }
    }

    // ---- deleteMemory ----

    @Test
    void deleteMemoryParsesResponse() {
        server.createContext("/memory/admin/delete", exchange -> {
            String response = "{\"success\":true,\"data\":{\"nodesDeleted\":5,\"status\":\"done\",\"message\":\"ok\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            DeleteMemoryResponse resp = client.deleteMemory(new DeleteMemoryParams().setNamespace("test"));
            assertTrue(resp.isSuccess());
            assertEquals(5, resp.getNodesDeleted());
            assertEquals("done", resp.getStatus());
            assertEquals("ok", resp.getMessage());
        }
    }

    // ---- queryMemory ----

    @Test
    void queryMemoryParsesResponse() {
        server.createContext("/memory/query", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"query\""));

            String response = "{\"success\":true,\"data\":{\"cached\":true,\"llmContextMessage\":\"answer\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            QueryMemoryResponse resp = client.queryMemory(new QueryMemoryParams("what?"));
            assertTrue(resp.isSuccess());
            assertTrue(resp.isCached());
            assertEquals("answer", resp.getLlmContextMessage());
        }
    }

    @Test
    void queryMemoryValidatesMissingQuery() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams()));
        }
    }

    @Test
    void queryMemoryValidatesMaxChunksRange() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams("q").setMaxChunks(0)));
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams("q").setMaxChunks(201)));
        }
    }

    // ---- recallMemories ----

    @Test
    void recallMemoriesParsesResponse() {
        server.createContext("/memory/memories/recall", exchange -> {
            String response = "{\"success\":true,\"data\":{\"memories\":[{\"id\":\"1\",\"content\":\"hi\"}]}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            RecallMemoriesResponse resp = client.recallMemories(new RecallMemoriesParams());
            assertTrue(resp.isSuccess());
            assertEquals(1, resp.getMemories().size());
            assertEquals("1", resp.getMemories().get(0).get("id"));
        }
    }

    @Test
    void recallMemoriesValidatesTopK() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setTopK(0)));
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setTopK(-1)));
        }
    }

    @Test
    void recallMemoriesValidatesMinRetention() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setMinRetention(-0.1)));
        }
    }

    // ---- insertDocument ----

    @Test
    void insertDocumentSuccess() {
        server.createContext("/memory/documents", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"title\""));
            assertTrue(body.contains("\"content\""));
            assertTrue(body.contains("\"namespace\""));
            String response = "{\"data\":{\"jobId\":\"j1\",\"state\":\"pending\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.insertDocument(
                    new InsertDocumentParams("title", "content", "ns"));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void insertDocumentRejectsMissingTitle() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertDocument(new InsertDocumentParams(null, "c", "ns")));
        }
    }

    // ---- insertDocumentsBatch ----

    @Test
    void insertDocumentsBatchSuccess() {
        server.createContext("/memory/documents/batch", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String response = "{\"data\":{\"accepted\":[{\"index\":0,\"jobId\":\"j1\"}]}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.insertDocumentsBatch(
                    new InsertDocumentsBatchParams(List.of(
                            new InsertDocumentParams("t1", "c1", "ns"))));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void insertDocumentsBatchRejectsEmpty() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertDocumentsBatch(new InsertDocumentsBatchParams(List.of())));
        }
    }

    // ---- listDocuments ----

    @Test
    void listDocumentsSuccess() {
        server.createContext("/memory/documents", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            assertTrue(exchange.getRequestURI().getQuery().contains("namespace=ns"));
            String response = "{\"data\":{\"documents\":[]}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.listDocuments(
                    new ListDocumentsParams().setNamespace("ns"));
            assertNotNull(resp);
        }
    }

    // ---- getDocument ----

    @Test
    void getDocumentSuccess() {
        server.createContext("/memory/documents/doc1", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            String response = "{\"data\":{\"title\":\"t\",\"content\":\"c\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.getDocument(new GetDocumentParams("doc1"));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void getDocumentRejectsEmptyId() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.getDocument(new GetDocumentParams("")));
        }
    }

    // ---- deleteDocument ----

    @Test
    void deleteDocumentSuccess() {
        server.createContext("/memory/documents/doc1", exchange -> {
            assertEquals("DELETE", exchange.getRequestMethod());
            assertTrue(exchange.getRequestURI().getQuery().contains("namespace=ns"));
            String response = "{\"data\":{\"deleted\":true}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.deleteDocument("doc1", "ns");
            assertNotNull(resp);
        }
    }

    @Test
    void deleteDocumentRejectsEmptyId() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.deleteDocument("", "ns"));
        }
    }

    @Test
    void deleteDocumentRejectsEmptyNamespace() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.deleteDocument("doc1", ""));
        }
    }

    // ---- recallThoughts ----

    @Test
    void recallThoughtsSuccess() {
        server.createContext("/memory/memories/thoughts", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"namespace\""));
            String response = "{\"data\":{\"thought\":\"interesting\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.recallThoughts(
                    new RecallThoughtsParams().setNamespace("ns"));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void recallThoughtsNullParams() {
        server.createContext("/memory/memories/thoughts", exchange -> {
            String response = "{\"data\":{\"thought\":\"empty\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.recallThoughts(null);
            assertNotNull(resp);
        }
    }

    // ---- queryMemoryContext ----

    @Test
    void queryMemoryContextSuccess() {
        server.createContext("/memory/queries", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"query\""));
            String response = "{\"data\":{\"response\":\"answer\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.queryMemoryContext(
                    new QueryMemoryContextParams("what?"));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void queryMemoryContextRejectsEmptyQuery() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemoryContext(new QueryMemoryContextParams()));
        }
    }

    // ---- interactMemory ----

    @Test
    void interactMemorySuccess() {
        server.createContext("/memory/interact", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"namespace\""));
            assertTrue(body.contains("\"entityNames\""));
            String response = "{\"data\":{\"status\":\"completed\",\"interactionsRecorded\":1}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.interactMemory(
                    new InteractMemoryParams("ns", List.of("entity1")));
            assertNotNull(resp.get("data"));
        }
    }

    @Test
    void interactMemoryRejectsEmptyNamespace() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.interactMemory(new InteractMemoryParams("", List.of("e1"))));
        }
    }

    @Test
    void interactMemoryRejectsEmptyEntityNames() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.interactMemory(new InteractMemoryParams("ns", List.of())));
        }
    }

    // ---- recordInteractions ----

    @Test
    void recordInteractionsUsesCorrectPath() {
        server.createContext("/memory/interactions", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String response = "{\"data\":{\"status\":\"completed\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.recordInteractions(
                    new InteractMemoryParams("ns", List.of("entity1")));
            assertNotNull(resp);
        }
    }

    // ---- chatMemory ----

    @Test
    void chatMemorySuccess() {
        server.createContext("/memory/chat", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"messages\""));
            String response = "{\"data\":{\"response\":\"hello back\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.chatMemory(new ChatMemoryParams(
                    List.of(Map.of("role", "user", "content", "hi"))));
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resp.get("data");
            assertEquals("hello back", data.get("response"));
        }
    }

    @Test
    void chatMemoryRejectsEmptyMessages() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.chatMemory(new ChatMemoryParams()));
        }
    }

    @Test
    void chatMemoryRejectsEmptyRole() {
        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.chatMemory(new ChatMemoryParams(
                            List.of(Map.of("role", "", "content", "hi")))));
        }
    }

    // ---- chatMemoryContext ----

    @Test
    void chatMemoryContextSuccess() {
        server.createContext("/memory/conversations", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            String response = "{\"data\":{\"response\":\"context reply\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) { os.write(response.getBytes(StandardCharsets.UTF_8)); }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("tok", baseUrl)) {
            Map<String, Object> resp = client.chatMemoryContext(new ChatMemoryParams(
                    List.of(Map.of("role", "user", "content", "hi"))));
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) resp.get("data");
            assertEquals("context reply", data.get("response"));
        }
    }

    // ---- Error handling ----

    @Test
    void nonOkStatusThrowsTinyHumansError() {
        server.createContext("/memory/recall", exchange -> {
            String response = "{\"error\":\"unauthorized\"}";
            exchange.sendResponseHeaders(401, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            TinyHumansError err = assertThrows(TinyHumansError.class, () ->
                    client.recallMemory(new RecallMemoryParams()));
            assertEquals(401, err.getStatus());
            assertEquals("unauthorized", err.getMessage());
        }
    }

    @Test
    void nonJsonResponseThrowsTinyHumansError() {
        server.createContext("/memory/recall", exchange -> {
            String response = "not json";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            TinyHumansError err = assertThrows(TinyHumansError.class, () ->
                    client.recallMemory(new RecallMemoryParams()));
            assertEquals(200, err.getStatus());
            assertTrue(err.getMessage().contains("non-JSON"));
        }
    }

    @Test
    void serverErrorThrowsWithHttpStatus() {
        server.createContext("/memory/insert", exchange -> {
            String response = "{\"success\":false}";
            exchange.sendResponseHeaders(500, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient("test-token", baseUrl)) {
            TinyHumansError err = assertThrows(TinyHumansError.class, () ->
                    client.insertMemory(new InsertMemoryParams("t", "c", "n")));
            assertEquals(500, err.getStatus());
            assertTrue(err.getMessage().contains("500"));
        }
    }
}
