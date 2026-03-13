package xyz.alphahuman.sdk;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AlphahumanMemoryClientTest {

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
        assertThrows(IllegalArgumentException.class, () -> new AlphahumanMemoryClient(null));
    }

    @Test
    void constructorRejectsEmptyToken() {
        assertThrows(IllegalArgumentException.class, () -> new AlphahumanMemoryClient(""));
    }

    @Test
    void constructorRejectsWhitespaceToken() {
        assertThrows(IllegalArgumentException.class, () -> new AlphahumanMemoryClient("   "));
    }

    @Test
    void constructorAcceptsValidToken() {
        AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl);
        assertNotNull(client);
        client.close();
    }

    // ---- insertMemory ----

    @Test
    void insertMemorySendsCorrectRequest() {
        server.createContext("/v1/memory/insert", exchange -> {
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

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            InsertMemoryResponse resp = client.insertMemory(
                    new InsertMemoryParams("title", "content", "ns"));
            assertTrue(resp.isSuccess());
            assertEquals("completed", resp.getStatus());
        }
    }

    @Test
    void insertMemoryValidatesMissingTitle() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams(null, "content", "ns")));
        }
    }

    @Test
    void insertMemoryValidatesMissingContent() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams("title", null, "ns")));
        }
    }

    @Test
    void insertMemoryValidatesMissingNamespace() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.insertMemory(new InsertMemoryParams("title", "content", null)));
        }
    }

    // ---- recallMemory ----

    @Test
    void recallMemoryParsesResponse() {
        server.createContext("/v1/memory/recall", exchange -> {
            String response = "{\"success\":true,\"data\":{\"cached\":false,\"llmContextMessage\":\"ctx\",\"counts\":{\"numEntities\":1}}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            RecallMemoryResponse resp = client.recallMemory(new RecallMemoryParams());
            assertTrue(resp.isSuccess());
            assertFalse(resp.isCached());
            assertEquals("ctx", resp.getLlmContextMessage());
        }
    }

    @Test
    void recallMemoryValidatesMaxChunks() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            RecallMemoryParams params = new RecallMemoryParams().setMaxChunks(0);
            assertThrows(IllegalArgumentException.class, () -> client.recallMemory(params));

            RecallMemoryParams params2 = new RecallMemoryParams().setMaxChunks(-1);
            assertThrows(IllegalArgumentException.class, () -> client.recallMemory(params2));
        }
    }

    // ---- deleteMemory ----

    @Test
    void deleteMemoryParsesResponse() {
        server.createContext("/v1/memory/admin/delete", exchange -> {
            String response = "{\"success\":true,\"data\":{\"nodesDeleted\":5,\"status\":\"done\",\"message\":\"ok\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
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
        server.createContext("/v1/memory/query", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            assertTrue(body.contains("\"query\""));

            String response = "{\"success\":true,\"data\":{\"cached\":true,\"llmContextMessage\":\"answer\"}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            QueryMemoryResponse resp = client.queryMemory(new QueryMemoryParams("what?"));
            assertTrue(resp.isSuccess());
            assertTrue(resp.isCached());
            assertEquals("answer", resp.getLlmContextMessage());
        }
    }

    @Test
    void queryMemoryValidatesMissingQuery() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams()));
        }
    }

    @Test
    void queryMemoryValidatesMaxChunksRange() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams("q").setMaxChunks(0)));
            assertThrows(IllegalArgumentException.class, () ->
                    client.queryMemory(new QueryMemoryParams("q").setMaxChunks(201)));
        }
    }

    // ---- recallMemories ----

    @Test
    void recallMemoriesParsesResponse() {
        server.createContext("/v1/memory/memories/recall", exchange -> {
            String response = "{\"success\":true,\"data\":{\"memories\":[{\"id\":\"1\",\"content\":\"hi\"}]}}";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            RecallMemoriesResponse resp = client.recallMemories(new RecallMemoriesParams());
            assertTrue(resp.isSuccess());
            assertEquals(1, resp.getMemories().size());
            assertEquals("1", resp.getMemories().get(0).get("id"));
        }
    }

    @Test
    void recallMemoriesValidatesTopK() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setTopK(0)));
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setTopK(-1)));
        }
    }

    @Test
    void recallMemoriesValidatesMinRetention() {
        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            assertThrows(IllegalArgumentException.class, () ->
                    client.recallMemories(new RecallMemoriesParams().setMinRetention(-0.1)));
        }
    }

    // ---- Error handling ----

    @Test
    void nonOkStatusThrowsAlphahumanError() {
        server.createContext("/v1/memory/recall", exchange -> {
            String response = "{\"error\":\"unauthorized\"}";
            exchange.sendResponseHeaders(401, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            AlphahumanError err = assertThrows(AlphahumanError.class, () ->
                    client.recallMemory(new RecallMemoryParams()));
            assertEquals(401, err.getStatus());
            assertEquals("unauthorized", err.getMessage());
        }
    }

    @Test
    void nonJsonResponseThrowsAlphahumanError() {
        server.createContext("/v1/memory/recall", exchange -> {
            String response = "not json";
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            AlphahumanError err = assertThrows(AlphahumanError.class, () ->
                    client.recallMemory(new RecallMemoryParams()));
            assertEquals(200, err.getStatus());
            assertTrue(err.getMessage().contains("non-JSON"));
        }
    }

    @Test
    void serverErrorThrowsWithHttpStatus() {
        server.createContext("/v1/memory/insert", exchange -> {
            String response = "{\"success\":false}";
            exchange.sendResponseHeaders(500, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient("test-token", baseUrl)) {
            AlphahumanError err = assertThrows(AlphahumanError.class, () ->
                    client.insertMemory(new InsertMemoryParams("t", "c", "n")));
            assertEquals(500, err.getStatus());
            assertTrue(err.getMessage().contains("500"));
        }
    }
}
