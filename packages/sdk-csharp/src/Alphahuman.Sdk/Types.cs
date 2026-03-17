using System.Text.Json;

namespace Alphahuman.Sdk;

// ── Insert ──

public class InsertMemoryParams
{
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? Namespace { get; set; }
    public string SourceType { get; set; } = "doc";
    public Dictionary<string, object?>? Metadata { get; set; }
    public string? Priority { get; set; }
    public long? CreatedAt { get; set; }
    public long? UpdatedAt { get; set; }
    public string? DocumentId { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Title))
            throw new ArgumentException("title is required and must be a string");
        if (string.IsNullOrWhiteSpace(Content))
            throw new ArgumentException("content is required and must be a string");
        if (string.IsNullOrWhiteSpace(Namespace))
            throw new ArgumentException("namespace is required and must be a string");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["title"] = Title,
            ["content"] = Content,
            ["namespace"] = Namespace,
            ["sourceType"] = SourceType,
        };
        if (Metadata != null) dict["metadata"] = Metadata;
        if (Priority != null) dict["priority"] = Priority;
        if (CreatedAt.HasValue) dict["createdAt"] = CreatedAt.Value;
        if (UpdatedAt.HasValue) dict["updatedAt"] = UpdatedAt.Value;
        if (DocumentId != null) dict["documentId"] = DocumentId;
        return dict;
    }
}

public class InsertMemoryResponse
{
    public bool Success { get; set; }
    public string Status { get; set; } = "";
    public JsonElement Stats { get; set; }
    public JsonElement? Usage { get; set; }

    public static InsertMemoryResponse FromJson(JsonElement root)
    {
        var data = root.GetProperty("data");
        var resp = new InsertMemoryResponse
        {
            Success = root.GetProperty("success").GetBoolean(),
            Status = data.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "",
            Stats = data.TryGetProperty("stats", out var st) ? st.Clone() : default,
        };
        if (data.TryGetProperty("usage", out var u))
            resp.Usage = u.Clone();
        return resp;
    }
}

// ── Recall ──

public class RecallMemoryParams
{
    public string? Namespace { get; set; }
    public int? MaxChunks { get; set; }

    public void Validate()
    {
        if (MaxChunks.HasValue && MaxChunks.Value <= 0)
            throw new ArgumentException("maxChunks must be a positive integer");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>();
        if (Namespace != null) dict["namespace"] = Namespace;
        if (MaxChunks.HasValue) dict["maxChunks"] = MaxChunks.Value;
        return dict;
    }
}

public class RecallMemoryResponse
{
    public bool Success { get; set; }
    public JsonElement? Context { get; set; }
    public string? LlmContextMessage { get; set; }
    public bool Cached { get; set; }
    public JsonElement? Counts { get; set; }
    public JsonElement? Usage { get; set; }

    public static RecallMemoryResponse FromJson(JsonElement root)
    {
        var data = root.GetProperty("data");
        var resp = new RecallMemoryResponse
        {
            Success = root.GetProperty("success").GetBoolean(),
            Cached = data.TryGetProperty("cached", out var c) && c.GetBoolean(),
        };
        if (data.TryGetProperty("context", out var ctx))
            resp.Context = ctx.Clone();
        if (data.TryGetProperty("llmContextMessage", out var lm))
            resp.LlmContextMessage = lm.GetString();
        if (data.TryGetProperty("counts", out var cnt))
            resp.Counts = cnt.Clone();
        if (data.TryGetProperty("usage", out var u))
            resp.Usage = u.Clone();
        return resp;
    }
}

// ── Delete ──

public class DeleteMemoryParams
{
    public string? Namespace { get; set; }

    public void Validate() { }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>();
        if (Namespace != null) dict["namespace"] = Namespace;
        return dict;
    }
}

public class DeleteMemoryResponse
{
    public bool Success { get; set; }
    public int NodesDeleted { get; set; }
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";

    public static DeleteMemoryResponse FromJson(JsonElement root)
    {
        var data = root.GetProperty("data");
        return new DeleteMemoryResponse
        {
            Success = root.GetProperty("success").GetBoolean(),
            NodesDeleted = data.TryGetProperty("nodesDeleted", out var nd) ? nd.GetInt32() : 0,
            Status = data.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "",
            Message = data.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "",
        };
    }
}

// ── Query ──

public class QueryMemoryParams
{
    public string? Query { get; set; }
    public string? Namespace { get; set; }
    public int? MaxChunks { get; set; }
    public bool? IncludeReferences { get; set; }
    public List<string>? DocumentIds { get; set; }
    public string? LlmQuery { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Query))
            throw new ArgumentException("query is required and must be a string");
        if (MaxChunks.HasValue && (MaxChunks.Value < 1 || MaxChunks.Value > 200))
            throw new ArgumentException("maxChunks must be between 1 and 200");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["query"] = Query,
        };
        if (Namespace != null) dict["namespace"] = Namespace;
        if (MaxChunks.HasValue) dict["maxChunks"] = MaxChunks.Value;
        if (IncludeReferences.HasValue) dict["includeReferences"] = IncludeReferences.Value;
        if (DocumentIds != null) dict["documentIds"] = DocumentIds;
        if (LlmQuery != null) dict["llmQuery"] = LlmQuery;
        return dict;
    }
}

public class QueryMemoryResponse
{
    public bool Success { get; set; }
    public JsonElement? Context { get; set; }
    public string? LlmContextMessage { get; set; }
    public bool Cached { get; set; }
    public string? Response { get; set; }
    public JsonElement? Usage { get; set; }

    public static QueryMemoryResponse FromJson(JsonElement root)
    {
        var data = root.GetProperty("data");
        var resp = new QueryMemoryResponse
        {
            Success = root.GetProperty("success").GetBoolean(),
            Cached = data.TryGetProperty("cached", out var c) && c.GetBoolean(),
        };
        if (data.TryGetProperty("context", out var ctx))
            resp.Context = ctx.Clone();
        if (data.TryGetProperty("llmContextMessage", out var lm))
            resp.LlmContextMessage = lm.GetString();
        if (data.TryGetProperty("response", out var r))
            resp.Response = r.GetString();
        if (data.TryGetProperty("usage", out var u))
            resp.Usage = u.Clone();
        return resp;
    }
}

// ── Recall Memories (Ebbinghaus) ──

public class RecallMemoriesParams
{
    public string? Namespace { get; set; }
    public int? TopK { get; set; }
    public double? MinRetention { get; set; }
    public long? AsOf { get; set; }

    public void Validate()
    {
        if (TopK.HasValue && TopK.Value <= 0)
            throw new ArgumentException("topK must be a positive number");
        if (MinRetention.HasValue && MinRetention.Value < 0)
            throw new ArgumentException("minRetention must be a non-negative number");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>();
        if (Namespace != null) dict["namespace"] = Namespace;
        if (TopK.HasValue) dict["topK"] = TopK.Value;
        if (MinRetention.HasValue) dict["minRetention"] = MinRetention.Value;
        if (AsOf.HasValue) dict["asOf"] = AsOf.Value;
        return dict;
    }
}

public class RecallMemoriesResponse
{
    public bool Success { get; set; }
    public List<JsonElement> Memories { get; set; } = new();

    public static RecallMemoriesResponse FromJson(JsonElement root)
    {
        var resp = new RecallMemoriesResponse
        {
            Success = root.GetProperty("success").GetBoolean(),
        };
        var data = root.GetProperty("data");
        if (data.TryGetProperty("memories", out var mem) && mem.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in mem.EnumerateArray())
                resp.Memories.Add(item.Clone());
        }
        return resp;
    }
}
