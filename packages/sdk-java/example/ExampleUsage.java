import xyz.tinyhumans.sdk.*;

import java.util.List;
import java.util.Map;

/**
 * Standalone example showing all TinyHuman Memory API operations.
 *
 * Run:
 *   export TINYHUMANS_TOKEN="your-token"
 *   javac -cp ../build/libs/tinyhumans-sdk-java-0.1.0.jar ExampleUsage.java
 *   java -cp .:../build/libs/tinyhumans-sdk-java-0.1.0.jar ExampleUsage
 */
public class ExampleUsage {

    public static void main(String[] args) throws InterruptedException {
        String token = System.getenv("TINYHUMANS_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("Set TINYHUMANS_TOKEN environment variable");
            System.exit(1);
        }

        String namespace = "example-java-" + System.currentTimeMillis();

        try (TinyHumansMemoryClient client = new TinyHumansMemoryClient(token)) {

            // 1. Insert Memory
            System.out.println("=== Insert Memory ===");
            InsertMemoryResponse insertResp = client.insertMemory(
                    new InsertMemoryParams("greeting", "Hello from Java SDK!", namespace)
                            .setDocumentId("java-greeting-001")
                            .setMetadata(Map.of("lang", "java")));
            System.out.println("Success: " + insertResp.isSuccess() + ", Status: " + insertResp.getStatus());

            Thread.sleep(2000);

            // 2. Recall Memory (Master)
            System.out.println("\n=== Recall Memory ===");
            RecallMemoryResponse recallResp = client.recallMemory(
                    new RecallMemoryParams().setNamespace(namespace));
            System.out.println("Success: " + recallResp.isSuccess() + ", Cached: " + recallResp.isCached());

            // 3. Query Memory
            System.out.println("\n=== Query Memory ===");
            QueryMemoryResponse queryResp = client.queryMemory(
                    new QueryMemoryParams("greeting").setNamespace(namespace));
            System.out.println("Success: " + queryResp.isSuccess() + ", Cached: " + queryResp.isCached());

            // 4. Query Memory Context
            System.out.println("\n=== Query Memory Context ===");
            try {
                Map<String, Object> qmcResp = client.queryMemoryContext(
                        new QueryMemoryContextParams("greeting").setNamespace(namespace));
                System.out.println("QueryMemoryContext: " + qmcResp);
            } catch (Exception e) {
                System.out.println("QueryMemoryContext: " + e.getMessage());
            }

            // 5. Recall Memories (Ebbinghaus)
            System.out.println("\n=== Recall Memories ===");
            RecallMemoriesResponse memoriesResp = client.recallMemories(
                    new RecallMemoriesParams().setNamespace(namespace).setTopK(5));
            System.out.println("Success: " + memoriesResp.isSuccess()
                    + ", Count: " + memoriesResp.getMemories().size());

            // 6. Recall Thoughts
            System.out.println("\n=== Recall Thoughts ===");
            try {
                Map<String, Object> thoughtsResp = client.recallThoughts(
                        new RecallThoughtsParams().setNamespace(namespace));
                System.out.println("RecallThoughts: " + thoughtsResp);
            } catch (Exception e) {
                System.out.println("RecallThoughts: " + e.getMessage());
            }

            // 7. Interact Memory
            System.out.println("\n=== Interact Memory ===");
            try {
                Map<String, Object> interactResp = client.interactMemory(
                        new InteractMemoryParams(namespace, List.of("JAVA SDK")));
                System.out.println("InteractMemory: " + interactResp);
            } catch (Exception e) {
                System.out.println("InteractMemory: " + e.getMessage());
            }

            // 8. Record Interactions
            System.out.println("\n=== Record Interactions ===");
            try {
                Map<String, Object> recordResp = client.recordInteractions(
                        new InteractMemoryParams(namespace, List.of("JAVA SDK")));
                System.out.println("RecordInteractions: " + recordResp);
            } catch (Exception e) {
                System.out.println("RecordInteractions: " + e.getMessage());
            }

            // 9. Insert Document
            System.out.println("\n=== Insert Document ===");
            try {
                Map<String, Object> docResp = client.insertDocument(
                        new InsertDocumentParams("Java Guide", "Java SDK usage guide", namespace).setDocumentId("java-guide-001"));
                System.out.println("InsertDocument: " + docResp);
            } catch (Exception e) {
                System.out.println("InsertDocument: " + e.getMessage());
            }

            // 10. Insert Documents Batch
            System.out.println("\n=== Insert Documents Batch ===");
            try {
                Map<String, Object> batchResp = client.insertDocumentsBatch(
                        new InsertDocumentsBatchParams(List.of(
                                new InsertDocumentParams("Doc 1", "Content 1", namespace).setDocumentId("doc-001"),
                                new InsertDocumentParams("Doc 2", "Content 2", namespace).setDocumentId("doc-002"))));
                System.out.println("InsertDocumentsBatch: " + batchResp);
            } catch (Exception e) {
                System.out.println("InsertDocumentsBatch: " + e.getMessage());
            }

            // 11. List Documents
            System.out.println("\n=== List Documents ===");
            try {
                Map<String, Object> listResp = client.listDocuments(
                        new ListDocumentsParams().setNamespace(namespace));
                System.out.println("ListDocuments: " + listResp);
            } catch (Exception e) {
                System.out.println("ListDocuments: " + e.getMessage());
            }

            // 12. Chat Memory
            System.out.println("\n=== Chat Memory ===");
            try {
                Map<String, Object> chatResp = client.chatMemory(new ChatMemoryParams(
                        List.of(Map.of("role", "user", "content", "Hello!"))));
                System.out.println("ChatMemory: " + chatResp);
            } catch (Exception e) {
                System.out.println("ChatMemory: " + e.getMessage());
            }

            // 13. Chat Memory Context
            System.out.println("\n=== Chat Memory Context ===");
            try {
                Map<String, Object> chatCtxResp = client.chatMemoryContext(new ChatMemoryParams(
                        List.of(Map.of("role", "user", "content", "Hello!"))));
                System.out.println("ChatMemoryContext: " + chatCtxResp);
            } catch (Exception e) {
                System.out.println("ChatMemoryContext: " + e.getMessage());
            }

            // 14. Get Graph Snapshot
            System.out.println("\n=== Get Graph Snapshot ===");
            try {
                Map<String, Object> graphResp = client.getGraphSnapshot(
                        new GraphSnapshotParams().setNamespace(namespace));
                System.out.println("GetGraphSnapshot: " + graphResp);
            } catch (Exception e) {
                System.out.println("GetGraphSnapshot: " + e.getMessage());
            }

            // 15. Delete Memory
            System.out.println("\n=== Delete Memory ===");
            DeleteMemoryResponse deleteResp = client.deleteMemory(
                    new DeleteMemoryParams().setNamespace(namespace));
            System.out.println("Success: " + deleteResp.isSuccess()
                    + ", Deleted: " + deleteResp.getNodesDeleted());
        }
    }
}
