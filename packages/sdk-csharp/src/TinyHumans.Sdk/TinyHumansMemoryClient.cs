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
