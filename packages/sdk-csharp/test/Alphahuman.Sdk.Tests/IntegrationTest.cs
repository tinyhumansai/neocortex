using Xunit;

namespace Alphahuman.Sdk.Tests;

[Trait("Category", "Integration")]
public class IntegrationTest
{
    [Fact]
    public async Task InsertRecallQueryDeleteLifecycle()
    {
        var token = Environment.GetEnvironmentVariable("ALPHAHUMAN_TOKEN");
        if (string.IsNullOrEmpty(token))
        {
            // Skip: ALPHAHUMAN_TOKEN not set
            return;
        }

        var ns = $"integration-test-csharp-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        using var client = new AlphahumanMemoryClient(token);

        // ── Insert ──
        var nowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var insertResp = await client.InsertMemoryAsync(new InsertMemoryParams
        {
            Title = "test-key-1",
            Content = "The capital of France is Paris.",
            Namespace = ns,
            CreatedAt = nowSeconds,
            UpdatedAt = nowSeconds,
        });
        Assert.True(insertResp.Success, "insert should succeed");

        // Give the backend time to index
        await Task.Delay(TimeSpan.FromSeconds(2));

        // ── Recall ──
        var recallResp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = ns });
        Assert.True(recallResp.Success, "recall should succeed");

        // ── Query ──
        var queryResp = await client.QueryMemoryAsync(new QueryMemoryParams
        {
            Query = "What is the capital of France?",
            Namespace = ns,
        });
        Assert.True(queryResp.Success, "query should succeed");

        // ── Delete ──
        var deleteResp = await client.DeleteMemoryAsync(new DeleteMemoryParams { Namespace = ns });
        Assert.True(deleteResp.Success, "delete should succeed");

        // Give the backend time to process deletion
        await Task.Delay(TimeSpan.FromSeconds(1));

        // ── Verify deletion ──
        var verifyResp = await client.RecallMemoryAsync(new RecallMemoryParams { Namespace = ns });
        Assert.True(verifyResp.Success);
    }
}
