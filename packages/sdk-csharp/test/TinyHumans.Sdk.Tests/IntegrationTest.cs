using System.Text.Json;
using Xunit;
using Xunit.Abstractions;

namespace TinyHumans.Sdk.Tests;

[Trait("Category", "Integration")]
public class IntegrationTest
{
    private readonly ITestOutputHelper _output;

    public IntegrationTest(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task FullLifecycle()
    {
        var token = Environment.GetEnvironmentVariable("TINYHUMANS_TOKEN");
        if (string.IsNullOrEmpty(token))
        {
            _output.WriteLine("TINYHUMANS_TOKEN not set, skipping");
            return;
        }

        var ns = $"integration-test-csharp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        using var client = new TinyHumansMemoryClient(token);

        // ── Insert Memory ──
        var nowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var insertResp = await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "test-key-1",
            Content = "The capital of France is Paris.",
            Namespace = ns,
            DocumentId = "integration-test-doc-1",
            Metadata = new Dictionary<string, object?> { ["source"] = "integration-test" },
            CreatedAt = nowSeconds,
            UpdatedAt = nowSeconds,
        });
        Assert.True(insertResp.Success, "insert should succeed");
        _output.WriteLine($"Insert: status={insertResp.Status}");

        await Task.Delay(TimeSpan.FromSeconds(2));

        // ── Recall Memory ──
        var recallResp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = ns });
        Assert.True(recallResp.Success, "recall should succeed");
        _output.WriteLine($"Recall: cached={recallResp.Cached}");

        // ── Recall Memories (Ebbinghaus) ──
        var memoriesResp = await client.RecallMemoriesAsync(new RecallMemoriesParams { Namespace = ns });
        Assert.True(memoriesResp.Success, "recall memories should succeed");
        _output.WriteLine($"RecallMemories: count={memoriesResp.Memories.Count}");

        // ── Insert Document ──
        try
        {
            var docResp = await client.InsertDocumentAsync(new InsertDocumentParams
            {
                Title = "Test Doc",
                Content = "Document content for integration test",
                Namespace = ns,
            });
            _output.WriteLine($"InsertDocument: {docResp}");
        }
        catch (Exception e) { _output.WriteLine($"InsertDocument: {e.Message}"); }

        // ── Insert Documents Batch ──
        try
        {
            var batchResp = await client.InsertDocumentsBatchAsync(new InsertDocumentsBatchParams
            {
                Documents = new List<InsertDocumentParams>
                {
                    new() { Title = "Batch 1", Content = "Content 1", Namespace = ns },
                    new() { Title = "Batch 2", Content = "Content 2", Namespace = ns },
                },
            });
            _output.WriteLine($"InsertDocumentsBatch: {batchResp}");
        }
        catch (Exception e) { _output.WriteLine($"InsertDocumentsBatch: {e.Message}"); }

        // ── List Documents ──
        try
        {
            var listResp = await client.ListDocumentsAsync(new ListDocumentsParams { Namespace = ns });
            _output.WriteLine($"ListDocuments: {listResp}");
        }
        catch (Exception e) { _output.WriteLine($"ListDocuments: {e.Message}"); }

        // ── Interact Memory ──
        try
        {
            var interactResp = await client.InteractMemoryAsync(new InteractMemoryParams
            {
                Namespace = ns,
                EntityNames = new List<string> { "TEST ENTITY" },
            });
            _output.WriteLine($"InteractMemory: {interactResp}");
        }
        catch (Exception e) { _output.WriteLine($"InteractMemory: {e.Message}"); }

        // ── Record Interactions ──
        try
        {
            var recordResp = await client.RecordInteractionsAsync(new InteractMemoryParams
            {
                Namespace = ns,
                EntityNames = new List<string> { "TEST ENTITY" },
            });
            _output.WriteLine($"RecordInteractions: {recordResp}");
        }
        catch (Exception e) { _output.WriteLine($"RecordInteractions: {e.Message}"); }

        // ── Recall Thoughts ──
        try
        {
            var thoughtsResp = await client.RecallThoughtsAsync(new RecallThoughtsParams { Namespace = ns });
            _output.WriteLine($"RecallThoughts: {thoughtsResp}");
        }
        catch (Exception e) { _output.WriteLine($"RecallThoughts: {e.Message}"); }

        // ── Query Memory Context ──
        try
        {
            var qmcResp = await client.QueryMemoryContextAsync(new QueryMemoryContextParams
            {
                Query = "capital of France",
                Namespace = ns,
            });
            _output.WriteLine($"QueryMemoryContext: {qmcResp}");
        }
        catch (Exception e) { _output.WriteLine($"QueryMemoryContext: {e.Message}"); }

        // ── Get Graph Snapshot ──
        try
        {
            var graphResp = await client.GetGraphSnapshotAsync(new GraphSnapshotParams { Namespace = ns });
            _output.WriteLine($"GetGraphSnapshot: {graphResp}");
        }
        catch (Exception e) { _output.WriteLine($"GetGraphSnapshot: {e.Message}"); }

        // ── Delete Memory ──
        try
        {
            var deleteResp = await client.DeleteMemoryAsync(new DeleteMemoryParams { Namespace = ns });
            _output.WriteLine($"Delete: nodesDeleted={deleteResp.NodesDeleted}");
        }
        catch (Exception e) { _output.WriteLine($"DeleteMemory: {e.Message}"); }
    }
}
