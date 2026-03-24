package xyz.tinyhumans.sdk;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "TINYHUMANS_TOKEN", matches = ".+")
class IntegrationTest {

    @Test
    void insertRecallDeleteLifecycle() throws InterruptedException {
        String token = System.getenv("TINYHUMANS_TOKEN");
        String namespace = "integration-test-java-" + System.nanoTime();

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient(token)) {

            // --- Insert ---
            long now = System.currentTimeMillis() / 1000;
            InsertMemoryResponse insertResp = client.insertMemory(
                    new InsertMemoryParams("test-key-1", "The capital of France is Paris.", namespace)
                            .setMetadata(Map.of("source", "integration-test"))
                            .setCreatedAt(now)
                            .setUpdatedAt(now));
            System.out.println("Insert: status=" + insertResp.getStatus());

            Thread.sleep(2000);

            // --- Recall ---
            RecallMemoryResponse recallResp = client.recallMemory(
                    new RecallMemoryParams().setNamespace(namespace));
            System.out.println("Recall: cached=" + recallResp.isCached());

            // --- Recall Memories (Ebbinghaus) ---
            RecallMemoriesResponse memoriesResp = client.recallMemories(
                    new RecallMemoriesParams().setNamespace(namespace));
            System.out.println("RecallMemories: count=" + memoriesResp.getMemories().size());

            // --- Insert Document ---
            Map<String, Object> docResp = client.insertDocument(
                    new InsertDocumentParams("Test Doc", "Document content", namespace));
            System.out.println("InsertDocument: " + docResp);

            // --- Insert Documents Batch ---
            Map<String, Object> batchResp = client.insertDocumentsBatch(
                    new InsertDocumentsBatchParams(List.of(
                            new InsertDocumentParams("Batch 1", "Content 1", namespace),
                            new InsertDocumentParams("Batch 2", "Content 2", namespace))));
            System.out.println("InsertDocumentsBatch: " + batchResp);

            // --- List Documents ---
            Map<String, Object> listResp = client.listDocuments(
                    new ListDocumentsParams().setNamespace(namespace));
            System.out.println("ListDocuments: " + listResp);

            // --- Interact Memory ---
            Map<String, Object> interactResp = client.interactMemory(
                    new InteractMemoryParams(namespace, List.of("TEST ENTITY")));
            System.out.println("InteractMemory: " + interactResp);

            // --- Record Interactions ---
            Map<String, Object> recordResp = client.recordInteractions(
                    new InteractMemoryParams(namespace, List.of("TEST ENTITY")));
            System.out.println("RecordInteractions: " + recordResp);

            // --- Recall Thoughts ---
            try {
                Map<String, Object> thoughtsResp = client.recallThoughts(
                        new RecallThoughtsParams().setNamespace(namespace));
                System.out.println("RecallThoughts: " + thoughtsResp);
            } catch (TinyHumansError e) {
                System.out.println("RecallThoughts (expected server-side): " + e.getMessage());
            }

            // --- Query Memory Context ---
            try {
                Map<String, Object> qmcResp = client.queryMemoryContext(
                        new QueryMemoryContextParams("capital of France").setNamespace(namespace));
                System.out.println("QueryMemoryContext: " + qmcResp);
            } catch (TinyHumansError e) {
                System.out.println("QueryMemoryContext: " + e.getMessage());
            }

            // --- Delete ---
            try {
                DeleteMemoryResponse deleteResp = client.deleteMemory(
                        new DeleteMemoryParams().setNamespace(namespace));
                System.out.println("Deleted nodes: " + deleteResp.getNodesDeleted());
            } catch (TinyHumansError e) {
                System.out.println("DeleteMemory (server-side): " + e.getMessage());
            }
        }
    }
}
