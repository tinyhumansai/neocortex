using System.Text.Json;
using TinyHumans.Sdk;

var token = Environment.GetEnvironmentVariable("TINYHUMANS_TOKEN")
    ?? throw new InvalidOperationException("Set TINYHUMANS_TOKEN environment variable");

using var client = new TinyHumansMemoryClient(token);
var ns = $"example-csharp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

try
{
    // 1. Insert Memory
    Console.WriteLine("=== Insert Memory ===");
    var insertResp = await client.InsertMemoryAsync(new InsertMemoryParams
    {
        Title = "example-doc",
        Content = "The speed of light is approximately 299,792 km/s.",
        Namespace = ns,
        Metadata = new Dictionary<string, object?> { ["lang"] = "csharp" },
    });
    Console.WriteLine($"Success={insertResp.Success} Status={insertResp.Status}");

    await Task.Delay(TimeSpan.FromSeconds(2));

    // 2. Recall Memory (Master)
    Console.WriteLine("\n=== Recall Memory ===");
    var recallResp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = ns });
    Console.WriteLine($"Success={recallResp.Success} Cached={recallResp.Cached}");

    // 3. Query Memory
    Console.WriteLine("\n=== Query Memory ===");
    try
    {
        var queryResp = await client.QueryMemoryAsync(new QueryMemoryParams
        {
            Query = "What is the speed of light?",
            Namespace = ns,
        });
        Console.WriteLine($"Success={queryResp.Success} Cached={queryResp.Cached}");
    }
    catch (Exception e) { Console.WriteLine($"QueryMemory: {e.Message}"); }

    // 4. Query Memory Context
    Console.WriteLine("\n=== Query Memory Context ===");
    try
    {
        var qmcResp = await client.QueryMemoryContextAsync(new QueryMemoryContextParams
        {
            Query = "speed of light",
            Namespace = ns,
        });
        Console.WriteLine($"QueryMemoryContext: {qmcResp}");
    }
    catch (Exception e) { Console.WriteLine($"QueryMemoryContext: {e.Message}"); }

    // 5. Recall Memories (Ebbinghaus)
    Console.WriteLine("\n=== Recall Memories ===");
    var memoriesResp = await client.RecallMemoriesAsync(new RecallMemoriesParams
    {
        Namespace = ns,
        TopK = 5,
    });
    Console.WriteLine($"Success={memoriesResp.Success} Count={memoriesResp.Memories.Count}");

    // 6. Recall Thoughts
    Console.WriteLine("\n=== Recall Thoughts ===");
    try
    {
        var thoughtsResp = await client.RecallThoughtsAsync(new RecallThoughtsParams { Namespace = ns });
        Console.WriteLine($"RecallThoughts: {thoughtsResp}");
    }
    catch (Exception e) { Console.WriteLine($"RecallThoughts: {e.Message}"); }

    // 7. Interact Memory
    Console.WriteLine("\n=== Interact Memory ===");
    try
    {
        var interactResp = await client.InteractMemoryAsync(new InteractMemoryParams
        {
            Namespace = ns,
            EntityNames = new List<string> { "CSHARP SDK" },
        });
        Console.WriteLine($"InteractMemory: {interactResp}");
    }
    catch (Exception e) { Console.WriteLine($"InteractMemory: {e.Message}"); }

    // 8. Record Interactions
    Console.WriteLine("\n=== Record Interactions ===");
    try
    {
        var recordResp = await client.RecordInteractionsAsync(new InteractMemoryParams
        {
            Namespace = ns,
            EntityNames = new List<string> { "CSHARP SDK" },
        });
        Console.WriteLine($"RecordInteractions: {recordResp}");
    }
    catch (Exception e) { Console.WriteLine($"RecordInteractions: {e.Message}"); }

    // 9. Insert Document
    Console.WriteLine("\n=== Insert Document ===");
    try
    {
        var docResp = await client.InsertDocumentAsync(new InsertDocumentParams
        {
            Title = "CSharp Guide",
            Content = "C# SDK usage guide",
            Namespace = ns,
        });
        Console.WriteLine($"InsertDocument: {docResp}");
    }
    catch (Exception e) { Console.WriteLine($"InsertDocument: {e.Message}"); }

    // 10. Insert Documents Batch
    Console.WriteLine("\n=== Insert Documents Batch ===");
    try
    {
        var batchResp = await client.InsertDocumentsBatchAsync(new InsertDocumentsBatchParams
        {
            Documents = new List<InsertDocumentParams>
            {
                new() { Title = "Doc 1", Content = "Content 1", Namespace = ns },
                new() { Title = "Doc 2", Content = "Content 2", Namespace = ns },
            },
        });
        Console.WriteLine($"InsertDocumentsBatch: {batchResp}");
    }
    catch (Exception e) { Console.WriteLine($"InsertDocumentsBatch: {e.Message}"); }

    // 11. List Documents
    Console.WriteLine("\n=== List Documents ===");
    try
    {
        var listResp = await client.ListDocumentsAsync(new ListDocumentsParams { Namespace = ns });
        Console.WriteLine($"ListDocuments: {listResp}");
    }
    catch (Exception e) { Console.WriteLine($"ListDocuments: {e.Message}"); }

    // 12. Chat Memory
    Console.WriteLine("\n=== Chat Memory ===");
    try
    {
        var chatResp = await client.ChatMemoryAsync(new ChatMemoryParams
        {
            Messages = new List<Dictionary<string, string>>
            {
                new() { ["role"] = "user", ["content"] = "Hello!" },
            },
        });
        Console.WriteLine($"ChatMemory: {chatResp}");
    }
    catch (Exception e) { Console.WriteLine($"ChatMemory: {e.Message}"); }

    // 13. Chat Memory Context
    Console.WriteLine("\n=== Chat Memory Context ===");
    try
    {
        var chatCtxResp = await client.ChatMemoryContextAsync(new ChatMemoryParams
        {
            Messages = new List<Dictionary<string, string>>
            {
                new() { ["role"] = "user", ["content"] = "Hello!" },
            },
        });
        Console.WriteLine($"ChatMemoryContext: {chatCtxResp}");
    }
    catch (Exception e) { Console.WriteLine($"ChatMemoryContext: {e.Message}"); }

    // 14. Get Graph Snapshot
    Console.WriteLine("\n=== Get Graph Snapshot ===");
    try
    {
        var graphResp = await client.GetGraphSnapshotAsync(new GraphSnapshotParams { Namespace = ns });
        Console.WriteLine($"GetGraphSnapshot: {graphResp}");
    }
    catch (Exception e) { Console.WriteLine($"GetGraphSnapshot: {e.Message}"); }

    // 15. Delete Memory
    Console.WriteLine("\n=== Delete Memory ===");
    try
    {
        var deleteResp = await client.DeleteMemoryAsync(new DeleteMemoryParams { Namespace = ns });
        Console.WriteLine($"Success={deleteResp.Success} Deleted={deleteResp.NodesDeleted}");
    }
    catch (Exception e) { Console.WriteLine($"DeleteMemory: {e.Message}"); }
}
catch (Exception e)
{
    Console.Error.WriteLine($"Error: {e.Message}");
    return 1;
}

return 0;
