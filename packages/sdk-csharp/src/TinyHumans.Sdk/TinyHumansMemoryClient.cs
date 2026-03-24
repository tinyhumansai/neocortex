using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyHumans.Sdk;

public sealed class TinyHumansMemoryClient : IDisposable
{
    private const string DefaultBaseUrl = "https://api.tinyhumans.ai";

    private const string DefaultModelId = "neocortex-mk1";

    private readonly string _token;
    private readonly string _baseUrl;
    private readonly string _modelId;
    private readonly HttpClient _httpClient;
    private bool _disposed;

    public TinyHumansMemoryClient(string token, string? baseUrl = null)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("token is required");

        _token = token;
        _modelId = DefaultModelId;
        _baseUrl = (baseUrl
            ?? Environment.GetEnvironmentVariable("TINYHUMANS_BASE_URL")
            ?? DefaultBaseUrl).TrimEnd('/');

        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    public TinyHumansMemoryClient(string token, string modelId, string? baseUrl = null)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("token is required");

        _token = token;
        _modelId = string.IsNullOrWhiteSpace(modelId) ? DefaultModelId : modelId;
        _baseUrl = (baseUrl
            ?? Environment.GetEnvironmentVariable("TINYHUMANS_BASE_URL")
            ?? DefaultBaseUrl).TrimEnd('/');

        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    internal TinyHumansMemoryClient(string token, string baseUrl, HttpClient httpClient, string? modelId = null)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("token is required");

        _token = token;
        _modelId = modelId ?? DefaultModelId;
        _baseUrl = baseUrl.TrimEnd('/');
        _httpClient = httpClient;
    }

    public async Task<InsertMemoryResponse> InsertMemoryAsync(InsertMemoryParams p)
    {
        p.Validate();
        var result = await PostAsync("/memory/insert", p.ToJsonObject());
        return InsertMemoryResponse.FromJson(result);
    }

    public async Task<RecallMemoryResponse> RecallMemoryAsync(RecallMemoryParams? p = null)
    {
        p ??= new RecallMemoryParams();
        p.Validate();
        var result = await PostAsync("/memory/recall", p.ToJsonObject());
        return RecallMemoryResponse.FromJson(result);
    }

    public async Task<DeleteMemoryResponse> DeleteMemoryAsync(DeleteMemoryParams? p = null)
    {
        p ??= new DeleteMemoryParams();
        p.Validate();
        var result = await PostAsync("/memory/admin/delete", p.ToJsonObject());
        return DeleteMemoryResponse.FromJson(result);
    }

    public async Task<QueryMemoryResponse> QueryMemoryAsync(QueryMemoryParams p)
    {
        p.Validate();
        var result = await PostAsync("/memory/query", p.ToJsonObject());
        return QueryMemoryResponse.FromJson(result);
    }

    public async Task<RecallMemoriesResponse> RecallMemoriesAsync(RecallMemoriesParams? p = null)
    {
        p ??= new RecallMemoriesParams();
        p.Validate();
        var result = await PostAsync("/memory/memories/recall", p.ToJsonObject());
        return RecallMemoriesResponse.FromJson(result);
    }

    // ── Chat ──

    public async Task<JsonElement> ChatMemoryAsync(ChatMemoryParams p)
    {
        p.Validate();
        return await PostAsync("/memory/chat", p.ToJsonObject());
    }

    public async Task<JsonElement> ChatMemoryContextAsync(ChatMemoryParams p)
    {
        p.Validate();
        return await PostAsync("/memory/conversations", p.ToJsonObject());
    }

    // ── Interactions ──

    // ── Advanced Recall ──

    public async Task<JsonElement> RecallThoughtsAsync(RecallThoughtsParams? p = null)
    {
        p ??= new RecallThoughtsParams();
        p.Validate();
        return await PostAsync("/memory/memories/thoughts", p.ToJsonObject());
    }

    public async Task<JsonElement> QueryMemoryContextAsync(QueryMemoryContextParams p)
    {
        p.Validate();
        return await PostAsync("/memory/queries", p.ToJsonObject());
    }

    // ── Interactions ──

    public async Task<JsonElement> InteractMemoryAsync(InteractMemoryParams p)
    {
        p.Validate();
        return await PostAsync("/memory/interact", p.ToJsonObject());
    }

    public async Task<JsonElement> RecordInteractionsAsync(InteractMemoryParams p)
    {
        p.Validate();
        return await PostAsync("/memory/interactions", p.ToJsonObject());
    }

    // ── Documents ──

    public async Task<JsonElement> InsertDocumentAsync(InsertDocumentParams p)
    {
        p.Validate();
        return await PostAsync("/memory/documents", p.ToJsonObject());
    }

    public async Task<JsonElement> InsertDocumentsBatchAsync(InsertDocumentsBatchParams p)
    {
        p.Validate();
        return await PostAsync("/memory/documents/batch", p.ToJsonObject());
    }

    public async Task<JsonElement> ListDocumentsAsync(ListDocumentsParams? p = null)
    {
        p ??= new ListDocumentsParams();
        return await GetAsync("/memory/documents", p.ToQueryParams());
    }

    public async Task<JsonElement> GetDocumentAsync(GetDocumentParams p)
    {
        p.Validate();
        return await GetAsync($"/memory/documents/{Uri.EscapeDataString(p.Id!)}", p.ToQueryParams());
    }

    public async Task<JsonElement> DeleteDocumentAsync(string documentId, string? ns = null)
    {
        if (string.IsNullOrWhiteSpace(documentId))
            throw new ArgumentException("documentId is required");

        var queryParams = new Dictionary<string, string>();
        if (ns != null) queryParams["namespace"] = ns;
        return await DeleteAsync($"/memory/documents/{Uri.EscapeDataString(documentId)}", queryParams);
    }

    // ── Admin & Utility ──

    public async Task<JsonElement> GetGraphSnapshotAsync(GraphSnapshotParams? p = null)
    {
        p ??= new GraphSnapshotParams();
        return await GetAsync("/memory/admin/graph-snapshot", p.ToQueryParams());
    }

    public async Task<JsonElement> GetIngestionJobAsync(string jobId)
    {
        if (string.IsNullOrWhiteSpace(jobId))
            throw new ArgumentException("jobId is required");
        return await GetAsync($"/memory/ingestion/jobs/{Uri.EscapeDataString(jobId)}");
    }

    public async Task<JsonElement> WaitForIngestionJobAsync(string jobId, WaitForIngestionJobOptions? opts = null)
    {
        opts ??= new WaitForIngestionJobOptions();
        for (int i = 0; i < opts.MaxAttempts; i++)
        {
            var result = await GetIngestionJobAsync(jobId);
            if (result.TryGetProperty("data", out var data) &&
                data.TryGetProperty("state", out var state))
            {
                var s = state.GetString();
                if (s == "completed" || s == "failed")
                    return result;
            }
            await Task.Delay(opts.IntervalMs);
        }
        throw new TimeoutException($"Ingestion job {jobId} did not complete within {opts.MaxAttempts} attempts");
    }

    private async Task<JsonElement> PostAsync(string path, Dictionary<string, object?> body)
    {
        var json = JsonSerializer.Serialize(body, new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        });

        var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}{path}")
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        request.Headers.Add("X-Model-Id", _modelId);

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        return HandleResponse((int)response.StatusCode, responseBody);
    }

    private async Task<JsonElement> GetAsync(string path, Dictionary<string, string>? queryParams = null)
    {
        var url = $"{_baseUrl}{path}";
        if (queryParams != null && queryParams.Count > 0)
            url += "?" + BuildQueryString(queryParams);

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        request.Headers.Add("X-Model-Id", _modelId);

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        return HandleResponse((int)response.StatusCode, responseBody);
    }

    private async Task<JsonElement> DeleteAsync(string path, Dictionary<string, string>? queryParams = null)
    {
        var url = $"{_baseUrl}{path}";
        if (queryParams != null && queryParams.Count > 0)
            url += "?" + BuildQueryString(queryParams);

        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        request.Headers.Add("X-Model-Id", _modelId);

        var response = await _httpClient.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();
        return HandleResponse((int)response.StatusCode, responseBody);
    }

    private static string BuildQueryString(Dictionary<string, string> queryParams)
    {
        var parts = new List<string>();
        foreach (var kvp in queryParams)
            parts.Add($"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}");
        return string.Join("&", parts);
    }

    private static JsonElement HandleResponse(int statusCode, string body)
    {
        JsonElement root;
        try
        {
            using var doc = JsonDocument.Parse(body);
            root = doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            throw new TinyHumansError($"HTTP {statusCode}: non-JSON response", statusCode, body);
        }

        if (statusCode < 200 || statusCode >= 300)
        {
            var message = root.TryGetProperty("error", out var err)
                ? err.GetString() ?? $"HTTP {statusCode}"
                : $"HTTP {statusCode}";
            throw new TinyHumansError(message, statusCode, body);
        }

        return root;
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _httpClient.Dispose();
            _disposed = true;
        }
    }
}
