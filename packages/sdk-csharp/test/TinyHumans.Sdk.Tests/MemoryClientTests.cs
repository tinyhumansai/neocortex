using System.Net;
using System.Text.Json;
using Xunit;

namespace TinyHumans.Sdk.Tests;

public class MemoryClientTests
{
    // ── Constructor ──

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_RejectsInvalidToken(string? token)
    {
        Assert.Throws<ArgumentException>(() => new TinyHumansMemoryClient(token!));
    }

    [Fact]
    public void Constructor_AcceptsValidToken()
    {
        using var client = new TinyHumansMemoryClient("valid-token");
        Assert.NotNull(client);
    }

    // ── Model ID ──

    [Fact]
    public async Task DefaultModelId_SendsNeocortexMk1Header()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""status"":""ok"",""stats"":{}}}");
        using var client = CreateClient(handler);

        await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "t", Content = "c", Namespace = "ns",
        });

        Assert.NotNull(handler.CapturedRequest);
        var modelIdValues = handler.CapturedRequest!.Headers.GetValues("X-Model-Id").ToList();
        Assert.Single(modelIdValues);
        Assert.Equal("neocortex-mk1", modelIdValues[0]);
    }

    [Fact]
    public async Task CustomModelId_PropagatesCorrectly()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""status"":""ok"",""stats"":{}}}");
        var httpClient = new HttpClient(handler);
        using var client = new TinyHumansMemoryClient("test-token", "https://test.example.com", httpClient, "custom-model");

        await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "t", Content = "c", Namespace = "ns",
        });

        Assert.NotNull(handler.CapturedRequest);
        var modelIdValues = handler.CapturedRequest!.Headers.GetValues("X-Model-Id").ToList();
        Assert.Single(modelIdValues);
        Assert.Equal("custom-model", modelIdValues[0]);
    }

    // ── InsertMemory ──

    [Fact]
    public async Task InsertMemory_SendsCorrectRequest()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""status"":""ok"",""stats"":{""chunks"":3}}}");
        using var client = CreateClient(handler);

        var resp = await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "t1",
            Content = "c1",
            Namespace = "ns1",
        });

        Assert.True(resp.Success);
        Assert.Equal("ok", resp.Status);

        Assert.NotNull(handler.CapturedRequest);
        Assert.Equal(HttpMethod.Post, handler.CapturedRequest!.Method);
        Assert.EndsWith("/memory/insert", handler.CapturedRequest.RequestUri!.ToString());
        Assert.Equal("Bearer", handler.CapturedRequest.Headers.Authorization!.Scheme);
        Assert.Equal("test-token", handler.CapturedRequest.Headers.Authorization.Parameter);

        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal("t1", body.GetProperty("title").GetString());
        Assert.Equal("c1", body.GetProperty("content").GetString());
        Assert.Equal("ns1", body.GetProperty("namespace").GetString());
        Assert.Equal("doc", body.GetProperty("sourceType").GetString());
    }

    [Fact]
    public async Task InsertMemory_ParsesUsage()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""status"":""ok"",""stats"":{},""usage"":{""llm_input_tokens"":10}}}");
        using var client = CreateClient(handler);

        var resp = await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "t", Content = "c", Namespace = "ns",
        });

        Assert.NotNull(resp.Usage);
    }

    [Fact]
    public async Task InsertMemory_ThrowsOnMissingTitle()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InsertMemoryAsync(new InsertMemoryParams { Content = "c", Namespace = "ns" }));
    }

    [Fact]
    public async Task InsertMemory_ThrowsOnMissingContent()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InsertMemoryAsync(new InsertMemoryParams { Title = "t", Namespace = "ns" }));
    }

    [Fact]
    public async Task InsertMemory_ThrowsOnMissingNamespace()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InsertMemoryAsync(new InsertMemoryParams { Title = "t", Content = "c" }));
    }

    // ── RecallMemory ──

    [Fact]
    public async Task RecallMemory_ParsesResponse()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""cached"":true,""llmContextMessage"":""ctx"",""counts"":{""numEntities"":1}}}");
        using var client = CreateClient(handler);

        var resp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = "ns" });

        Assert.True(resp.Success);
        Assert.True(resp.Cached);
        Assert.Equal("ctx", resp.LlmContextMessage);
        Assert.NotNull(resp.Counts);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RecallMemory_ThrowsOnInvalidMaxChunks(int maxChunks)
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.RecallMemoryAsync(new RecallMemoryParams { MaxChunks = maxChunks }));
    }

    // ── DeleteMemory ──

    [Fact]
    public async Task DeleteMemory_ParsesResponse()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""nodesDeleted"":5,""status"":""deleted"",""message"":""done""}}");
        using var client = CreateClient(handler);

        var resp = await client.DeleteMemoryAsync(new DeleteMemoryParams { Namespace = "ns" });

        Assert.True(resp.Success);
        Assert.Equal(5, resp.NodesDeleted);
        Assert.Equal("deleted", resp.Status);
        Assert.Equal("done", resp.Message);
    }

    // ── QueryMemory ──

    [Fact]
    public async Task QueryMemory_ParsesResponse()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""cached"":false,""llmContextMessage"":""answer"",""response"":""Paris""}}");
        using var client = CreateClient(handler);

        var resp = await client.QueryMemoryAsync(new QueryMemoryParams { Query = "capital?" });

        Assert.True(resp.Success);
        Assert.False(resp.Cached);
        Assert.Equal("answer", resp.LlmContextMessage);
        Assert.Equal("Paris", resp.Response);
    }

    [Fact]
    public async Task QueryMemory_ThrowsOnMissingQuery()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.QueryMemoryAsync(new QueryMemoryParams()));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(201)]
    public async Task QueryMemory_ThrowsOnInvalidMaxChunks(int maxChunks)
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.QueryMemoryAsync(new QueryMemoryParams { Query = "q", MaxChunks = maxChunks }));
    }

    // ── RecallMemories ──

    [Fact]
    public async Task RecallMemories_ParsesResponse()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""memories"":[{""id"":""1"",""content"":""hello""}]}}");
        using var client = CreateClient(handler);

        var resp = await client.RecallMemoriesAsync();

        Assert.True(resp.Success);
        Assert.Single(resp.Memories);
        Assert.Equal("1", resp.Memories[0].GetProperty("id").GetString());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RecallMemories_ThrowsOnInvalidTopK(int topK)
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.RecallMemoriesAsync(new RecallMemoriesParams { TopK = topK }));
    }

    [Fact]
    public async Task RecallMemories_ThrowsOnNegativeMinRetention()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.RecallMemoriesAsync(new RecallMemoriesParams { MinRetention = -0.1 }));
    }

    // ── Error handling ──

    [Fact]
    public async Task ThrowsTinyHumansError_On401()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.Unauthorized,
            @"{""error"":""Unauthorized""}");
        using var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<TinyHumansError>(() =>
            client.RecallMemoryAsync());
        Assert.Equal(401, ex.Status);
        Assert.Equal("Unauthorized", ex.Message);
    }

    [Fact]
    public async Task ThrowsTinyHumansError_OnNonJsonResponse()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.BadGateway, "not json");
        using var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<TinyHumansError>(() =>
            client.RecallMemoryAsync());
        Assert.Equal(502, ex.Status);
        Assert.Contains("non-JSON", ex.Message);
    }

    [Fact]
    public async Task ThrowsTinyHumansError_On500()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.InternalServerError,
            @"{""error"":""Internal Server Error""}");
        using var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<TinyHumansError>(() =>
            client.RecallMemoryAsync());
        Assert.Equal(500, ex.Status);
    }

    // ── RecallThoughts ──

    [Fact]
    public async Task RecallThoughts_SendsCorrectPath()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.RecallThoughtsAsync(new RecallThoughtsParams { Namespace = "ns" });

        Assert.EndsWith("/memory/memories/thoughts", handler.CapturedRequest!.RequestUri!.ToString());
        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal("ns", body.GetProperty("namespace").GetString());
    }

    [Fact]
    public async Task RecallThoughts_DefaultParams()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.RecallThoughtsAsync();

        Assert.EndsWith("/memory/memories/thoughts", handler.CapturedRequest!.RequestUri!.ToString());
    }

    // ── QueryMemoryContext ──

    [Fact]
    public async Task QueryMemoryContext_SendsCorrectRequest()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.QueryMemoryContextAsync(new QueryMemoryContextParams
        {
            Query = "test query", Namespace = "ns",
        });

        Assert.EndsWith("/memory/queries", handler.CapturedRequest!.RequestUri!.ToString());
        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal("test query", body.GetProperty("query").GetString());
    }

    [Fact]
    public async Task QueryMemoryContext_ThrowsOnMissingQuery()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.QueryMemoryContextAsync(new QueryMemoryContextParams()));
    }

    // ── ChatMemory ──

    [Fact]
    public async Task ChatMemory_SendsCorrectRequest()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""message"":""hi""}}");
        using var client = CreateClient(handler);

        await client.ChatMemoryAsync(new ChatMemoryParams
        {
            Messages = new List<Dictionary<string, string>>
            {
                new() { ["role"] = "user", ["content"] = "Hello!" }
            },
        });

        Assert.NotNull(handler.CapturedRequest);
        Assert.Equal(HttpMethod.Post, handler.CapturedRequest!.Method);
        Assert.EndsWith("/memory/chat", handler.CapturedRequest.RequestUri!.ToString());

        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.True(body.GetProperty("messages").GetArrayLength() > 0);
    }

    [Fact]
    public async Task ChatMemory_ThrowsOnEmptyMessages()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.ChatMemoryAsync(new ChatMemoryParams()));
    }

    // ── ChatMemoryContext ──

    [Fact]
    public async Task ChatMemoryContext_SendsCorrectPath()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.ChatMemoryContextAsync(new ChatMemoryParams
        {
            Messages = new List<Dictionary<string, string>>
            {
                new() { ["role"] = "user", ["content"] = "Hello!" }
            },
        });

        Assert.EndsWith("/memory/conversations", handler.CapturedRequest!.RequestUri!.ToString());
    }

    // ── InteractMemory ──

    [Fact]
    public async Task InteractMemory_SendsCorrectRequest()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.InteractMemoryAsync(new InteractMemoryParams
        {
            Namespace = "ns", EntityNames = new List<string> { "ENTITY1" },
        });

        Assert.EndsWith("/memory/interact", handler.CapturedRequest!.RequestUri!.ToString());
        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal("ns", body.GetProperty("namespace").GetString());
        Assert.True(body.TryGetProperty("entityNames", out _));
    }

    [Fact]
    public async Task InteractMemory_ThrowsOnMissingNamespace()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InteractMemoryAsync(new InteractMemoryParams
            {
                EntityNames = new List<string> { "E" },
            }));
    }

    [Fact]
    public async Task InteractMemory_ThrowsOnEmptyEntityNames()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InteractMemoryAsync(new InteractMemoryParams
            {
                Namespace = "ns",
            }));
    }

    // ── RecordInteractions ──

    [Fact]
    public async Task RecordInteractions_SendsCorrectPath()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.RecordInteractionsAsync(new InteractMemoryParams
        {
            Namespace = "ns", EntityNames = new List<string> { "E" },
        });

        Assert.EndsWith("/memory/interactions", handler.CapturedRequest!.RequestUri!.ToString());
    }

    // ── InsertDocument ──

    [Fact]
    public async Task InsertDocument_SendsCorrectRequest()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""jobId"":""j1""}}");
        using var client = CreateClient(handler);

        await client.InsertDocumentAsync(new InsertDocumentParams
        {
            Title = "Doc", Content = "Content", Namespace = "ns",
        });

        Assert.EndsWith("/memory/documents", handler.CapturedRequest!.RequestUri!.ToString());
        Assert.Equal(HttpMethod.Post, handler.CapturedRequest.Method);
        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal("Doc", body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task InsertDocument_ThrowsOnMissingTitle()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InsertDocumentAsync(new InsertDocumentParams { Content = "c", Namespace = "ns" }));
    }

    // ── InsertDocumentsBatch ──

    [Fact]
    public async Task InsertDocumentsBatch_SendsItems()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.InsertDocumentsBatchAsync(new InsertDocumentsBatchParams
        {
            Documents = new List<InsertDocumentParams>
            {
                new() { Title = "D1", Content = "C1", Namespace = "ns" },
                new() { Title = "D2", Content = "C2", Namespace = "ns" },
            },
        });

        Assert.EndsWith("/memory/documents/batch", handler.CapturedRequest!.RequestUri!.ToString());
        var body = JsonDocument.Parse(handler.CapturedRequestBody!).RootElement;
        Assert.Equal(2, body.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task InsertDocumentsBatch_ThrowsOnEmpty()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.InsertDocumentsBatchAsync(new InsertDocumentsBatchParams()));
    }

    // ── ListDocuments ──

    [Fact]
    public async Task ListDocuments_SendsGetWithQueryParams()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""documents"":[]}}");
        using var client = CreateClient(handler);

        await client.ListDocumentsAsync(new ListDocumentsParams { Namespace = "ns", Limit = 10 });

        Assert.Equal(HttpMethod.Get, handler.CapturedRequest!.Method);
        var uri = handler.CapturedRequest.RequestUri!.ToString();
        Assert.Contains("namespace=ns", uri);
        Assert.Contains("limit=10", uri);
    }

    // ── GetDocument ──

    [Fact]
    public async Task GetDocument_SendsGetWithId()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""id"":""d1""}}");
        using var client = CreateClient(handler);

        await client.GetDocumentAsync(new GetDocumentParams { Id = "d1", Namespace = "ns" });

        Assert.Equal(HttpMethod.Get, handler.CapturedRequest!.Method);
        var uri = handler.CapturedRequest.RequestUri!.ToString();
        Assert.Contains("/memory/documents/d1", uri);
        Assert.Contains("namespace=ns", uri);
    }

    [Fact]
    public async Task GetDocument_ThrowsOnMissingId()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.GetDocumentAsync(new GetDocumentParams()));
    }

    // ── DeleteDocument ──

    [Fact]
    public async Task DeleteDocument_SendsDeleteMethod()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.DeleteDocumentAsync("d1", "ns");

        Assert.Equal(HttpMethod.Delete, handler.CapturedRequest!.Method);
        var uri = handler.CapturedRequest.RequestUri!.ToString();
        Assert.Contains("/memory/documents/d1", uri);
        Assert.Contains("namespace=ns", uri);
    }

    [Fact]
    public async Task DeleteDocument_ThrowsOnEmptyId()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.DeleteDocumentAsync(""));
    }

    // ── GetGraphSnapshot ──

    [Fact]
    public async Task GetGraphSnapshot_SendsGet()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        using var client = CreateClient(handler);

        await client.GetGraphSnapshotAsync(new GraphSnapshotParams { Namespace = "ns" });

        Assert.Equal(HttpMethod.Get, handler.CapturedRequest!.Method);
        Assert.Contains("/memory/admin/graph-snapshot", handler.CapturedRequest.RequestUri!.ToString());
    }

    // ── GetIngestionJob ──

    [Fact]
    public async Task GetIngestionJob_SendsGet()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""state"":""completed""}}");
        using var client = CreateClient(handler);

        await client.GetIngestionJobAsync("job123");

        Assert.Equal(HttpMethod.Get, handler.CapturedRequest!.Method);
        Assert.Contains("/memory/ingestion/jobs/job123", handler.CapturedRequest.RequestUri!.ToString());
    }

    [Fact]
    public async Task GetIngestionJob_ThrowsOnEmptyJobId()
    {
        using var client = CreateClient();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.GetIngestionJobAsync(""));
    }

    // ── WaitForIngestionJob ──

    [Fact]
    public async Task WaitForIngestionJob_ReturnsOnCompleted()
    {
        var handler = new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{""state"":""completed""}}");
        using var client = CreateClient(handler);

        var result = await client.WaitForIngestionJobAsync("job123",
            new WaitForIngestionJobOptions { IntervalMs = 10, MaxAttempts = 3 });

        Assert.Equal("completed", result.GetProperty("data").GetProperty("state").GetString());
    }

    // ── Helpers ──

    private static TinyHumansMemoryClient CreateClient(MockHttpMessageHandler? handler = null)
    {
        handler ??= new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        var httpClient = new HttpClient(handler);
        return new TinyHumansMemoryClient("test-token", "https://test.example.com", httpClient);
    }
}
