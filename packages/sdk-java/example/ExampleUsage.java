import xyz.alphahuman.sdk.*;

import java.util.Map;

/**
 * Standalone example showing all 5 Alphahuman Memory API operations.
 *
 * Run:
 *   export ALPHAHUMAN_TOKEN="your-token"
 *   javac -cp ../build/libs/alphahuman-sdk-java-0.1.0.jar ExampleUsage.java
 *   java -cp .:../build/libs/alphahuman-sdk-java-0.1.0.jar ExampleUsage
 */
public class ExampleUsage {

    public static void main(String[] args) throws InterruptedException {
        String token = System.getenv("ALPHAHUMAN_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("Set ALPHAHUMAN_TOKEN environment variable");
            System.exit(1);
        }

        String namespace = "example-java-" + System.currentTimeMillis();

        try (AlphahumanMemoryClient client = new AlphahumanMemoryClient(token)) {

            // 1. Insert
            System.out.println("=== Insert ===");
            InsertMemoryResponse insertResp = client.insertMemory(
                    new InsertMemoryParams("greeting", "Hello from Java SDK!", namespace)
                            .setMetadata(Map.of("lang", "java")));
            System.out.println("Success: " + insertResp.isSuccess() + ", Status: " + insertResp.getStatus());

            Thread.sleep(2000);

            // 2. Recall
            System.out.println("\n=== Recall ===");
            RecallMemoryResponse recallResp = client.recallMemory(
                    new RecallMemoryParams().setNamespace(namespace));
            System.out.println("Success: " + recallResp.isSuccess() + ", Cached: " + recallResp.isCached());

            // 3. Query
            System.out.println("\n=== Query ===");
            QueryMemoryResponse queryResp = client.queryMemory(
                    new QueryMemoryParams("greeting").setNamespace(namespace));
            System.out.println("Success: " + queryResp.isSuccess() + ", Cached: " + queryResp.isCached());

            // 4. Recall Memories (Ebbinghaus)
            System.out.println("\n=== Recall Memories ===");
            RecallMemoriesResponse memoriesResp = client.recallMemories(
                    new RecallMemoriesParams().setNamespace(namespace).setTopK(5));
            System.out.println("Success: " + memoriesResp.isSuccess()
                    + ", Count: " + memoriesResp.getMemories().size());

            // 5. Delete
            System.out.println("\n=== Delete ===");
            DeleteMemoryResponse deleteResp = client.deleteMemory(
                    new DeleteMemoryParams().setNamespace(namespace));
            System.out.println("Success: " + deleteResp.isSuccess()
                    + ", Deleted: " + deleteResp.getNodesDeleted());
        }
    }
}
