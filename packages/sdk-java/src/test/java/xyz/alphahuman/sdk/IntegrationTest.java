package xyz.alphahuman.sdk;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "ALPHAHUMAN_TOKEN", matches = ".+")
class IntegrationTest {

    @Test
    void insertRecallQueryDeleteLifecycle() throws InterruptedException {
        String token = System.getenv("ALPHAHUMAN_TOKEN");
        String namespace = "integration-test-java-" + System.nanoTime();

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient(token)) {

            // --- Insert ---
            long now = System.currentTimeMillis() / 1000;
            InsertMemoryResponse insertResp = client.insertMemory(
                    new InsertMemoryParams("test-key-1", "The capital of France is Paris.", namespace)
                            .setMetadata(Map.of("source", "integration-test"))
                            .setCreatedAt(now)
                            .setUpdatedAt(now));
            assertTrue(insertResp.isSuccess(), "insert should succeed");
            System.out.println("Insert status: " + insertResp.getStatus());

            // Give the backend time to index
            Thread.sleep(2000);

            // --- Recall ---
            RecallMemoryResponse recallResp = client.recallMemory(
                    new RecallMemoryParams().setNamespace(namespace));
            assertTrue(recallResp.isSuccess(), "recall should succeed");
            System.out.println("Recall cached=" + recallResp.isCached()
                    + " llmContext=" + (recallResp.getLlmContextMessage() != null));

            // --- Query ---
            QueryMemoryResponse queryResp = client.queryMemory(
                    new QueryMemoryParams("What is the capital of France?").setNamespace(namespace));
            assertTrue(queryResp.isSuccess(), "query should succeed");
            System.out.println("Query cached=" + queryResp.isCached()
                    + " llmContext=" + (queryResp.getLlmContextMessage() != null));

            // --- Delete ---
            DeleteMemoryResponse deleteResp = client.deleteMemory(
                    new DeleteMemoryParams().setNamespace(namespace));
            assertTrue(deleteResp.isSuccess(), "delete should succeed");
            System.out.println("Deleted nodes: " + deleteResp.getNodesDeleted());

            // Give the backend time to process deletion
            Thread.sleep(1000);

            // --- Verify deletion ---
            RecallMemoryResponse verifyResp = client.recallMemory(
                    new RecallMemoryParams().setNamespace(namespace));
            assertTrue(verifyResp.isSuccess());
            System.out.println("After delete: context=" + verifyResp.getContext()
                    + " llmCtx=" + verifyResp.getLlmContextMessage());
        }
    }
}
