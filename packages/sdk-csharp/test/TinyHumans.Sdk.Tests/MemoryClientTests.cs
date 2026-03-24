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

    // ── Helpers ──

    private static TinyHumansMemoryClient CreateClient(MockHttpMessageHandler? handler = null)
    {
        handler ??= new MockHttpMessageHandler(HttpStatusCode.OK,
            @"{""success"":true,""data"":{}}");
        var httpClient = new HttpClient(handler);
        return new TinyHumansMemoryClient("test-token", "https://test.example.com", httpClient);
    }
}
