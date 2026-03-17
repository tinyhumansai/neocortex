using Alphahuman.Sdk;

var token = Environment.GetEnvironmentVariable("ALPHAHUMAN_TOKEN")
    ?? throw new InvalidOperationException("Set ALPHAHUMAN_TOKEN environment variable");

using var client = new AlphahumanMemoryClient(token);
var ns = $"example-csharp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

// Insert a memory
Console.WriteLine("── Insert ──");
var insertResp = await client.InsertMemoryAsync(new InsertMemoryParams
{
    Title = "example-doc",
    Content = "The Eiffel Tower is located in Paris, France.",
    Namespace = ns,
});
Console.WriteLine($"Success: {insertResp.Success}, Status: {insertResp.Status}");

// Wait for indexing
await Task.Delay(TimeSpan.FromSeconds(2));

// Recall context
Console.WriteLine("\n── Recall ──");
var recallResp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = ns });
Console.WriteLine($"Success: {recallResp.Success}, Cached: {recallResp.Cached}");

// Query
Console.WriteLine("\n── Query ──");
var queryResp = await client.QueryMemoryAsync(new QueryMemoryParams
{
    Query = "Where is the Eiffel Tower?",
    Namespace = ns,
});
Console.WriteLine($"Success: {queryResp.Success}, Response: {queryResp.Response}");

// Recall memories (Ebbinghaus)
Console.WriteLine("\n── Recall Memories ──");
var memoriesResp = await client.RecallMemoriesAsync(new RecallMemoriesParams { Namespace = ns });
Console.WriteLine($"Success: {memoriesResp.Success}, Count: {memoriesResp.Memories.Count}");

// Delete
Console.WriteLine("\n── Delete ──");
var deleteResp = await client.DeleteMemoryAsync(new DeleteMemoryParams { Namespace = ns });
Console.WriteLine($"Success: {deleteResp.Success}, Deleted: {deleteResp.NodesDeleted}");
