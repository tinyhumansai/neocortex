using System.Text.Json;

namespace TinyHumans.Sdk;

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
        if (string.IsNullOrWhiteSpace(DocumentId))
            throw new ArgumentException("documentId is required and must be a non-empty string");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["title"] = Title,
            ["content"] = Content,
            ["namespace"] = Namespace,
            ["sourceType"] = SourceType,
            ["documentId"] = DocumentId,
        };
        if (Metadata != null) dict["metadata"] = Metadata;
        if (Priority != null) dict["priority"] = Priority;
        if (CreatedAt.HasValue) dict["createdAt"] = CreatedAt.Value;
        if (UpdatedAt.HasValue) dict["updatedAt"] = UpdatedAt.Value;
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

// ── Chat ──

public class ChatMemoryParams
{
    public List<Dictionary<string, string>>? Messages { get; set; }
    public string? Namespace { get; set; }
    public double? Temperature { get; set; }
    public int? MaxTokens { get; set; }
    public string? Model { get; set; }

    public void Validate()
    {
        if (Messages == null || Messages.Count == 0)
            throw new ArgumentException("messages is required and must be a non-empty list");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["messages"] = Messages,
        };
        if (Namespace != null) dict["namespace"] = Namespace;
        if (Temperature.HasValue) dict["temperature"] = Temperature.Value;
        if (MaxTokens.HasValue) dict["maxTokens"] = MaxTokens.Value;
        if (Model != null) dict["model"] = Model;
        return dict;
    }
}

// ── Interactions ──

public class InteractMemoryParams
{
    public string? Namespace { get; set; }
    public List<string>? EntityNames { get; set; }
    public string? Description { get; set; }
    public string? InteractionLevel { get; set; }
    public List<string>? InteractionLevels { get; set; }
    public double? Timestamp { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Namespace))
            throw new ArgumentException("namespace is required");
        if (EntityNames == null || EntityNames.Count == 0)
            throw new ArgumentException("entityNames is required and must be a non-empty list");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["namespace"] = Namespace,
            ["entityNames"] = EntityNames,
        };
        if (Description != null) dict["description"] = Description;
        if (InteractionLevel != null) dict["interactionLevel"] = InteractionLevel;
        if (InteractionLevels != null) dict["interactionLevels"] = InteractionLevels;
        if (Timestamp.HasValue) dict["timestamp"] = Timestamp.Value;
        return dict;
    }
}

// ── Recall Thoughts ──

public class RecallThoughtsParams
{
    public string? Namespace { get; set; }
    public int? MaxChunks { get; set; }
    public double? Temperature { get; set; }
    public int? RandomnessSeed { get; set; }
    public bool? Persist { get; set; }
    public bool? EnablePredictionCheck { get; set; }
    public string? ThoughtPrompt { get; set; }

    public void Validate() { }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>();
        if (Namespace != null) dict["namespace"] = Namespace;
        if (MaxChunks.HasValue) dict["maxChunks"] = MaxChunks.Value;
        if (Temperature.HasValue) dict["temperature"] = Temperature.Value;
        if (RandomnessSeed.HasValue) dict["randomnessSeed"] = RandomnessSeed.Value;
        if (Persist.HasValue) dict["persist"] = Persist.Value;
        if (EnablePredictionCheck.HasValue) dict["enablePredictionCheck"] = EnablePredictionCheck.Value;
        if (ThoughtPrompt != null) dict["thoughtPrompt"] = ThoughtPrompt;
        return dict;
    }
}

// ── Query Memory Context ──

public class QueryMemoryContextParams
{
    public string? Query { get; set; }
    public string? Namespace { get; set; }
    public int? MaxChunks { get; set; }
    public bool? IncludeReferences { get; set; }
    public List<string>? DocumentIds { get; set; }
    public bool? RecallOnly { get; set; }
    public string? LlmQuery { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Query))
            throw new ArgumentException("query is required and must be a string");
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
        if (RecallOnly.HasValue) dict["recallOnly"] = RecallOnly.Value;
        if (LlmQuery != null) dict["llmQuery"] = LlmQuery;
        return dict;
    }
}

// ── Documents ──

public class InsertDocumentParams
{
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? Namespace { get; set; }
    public Dictionary<string, object?>? Metadata { get; set; }
    public string? SourceType { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Title))
            throw new ArgumentException("title is required");
        if (string.IsNullOrWhiteSpace(Content))
            throw new ArgumentException("content is required");
        if (string.IsNullOrWhiteSpace(Namespace))
            throw new ArgumentException("namespace is required");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var dict = new Dictionary<string, object?>
        {
            ["title"] = Title,
            ["content"] = Content,
            ["namespace"] = Namespace,
        };
        if (Metadata != null) dict["metadata"] = Metadata;
        if (SourceType != null) dict["sourceType"] = SourceType;
        return dict;
    }
}

public class InsertDocumentsBatchParams
{
    public List<InsertDocumentParams>? Documents { get; set; }

    public void Validate()
    {
        if (Documents == null || Documents.Count == 0)
            throw new ArgumentException("documents is required and must be a non-empty list");
    }

    public Dictionary<string, object?> ToJsonObject()
    {
        var items = new List<Dictionary<string, object?>>();
        foreach (var doc in Documents!)
        {
            doc.Validate();
            items.Add(doc.ToJsonObject());
        }
        return new Dictionary<string, object?>
        {
            ["items"] = items,
        };
    }
}

public class ListDocumentsParams
{
    public string? Namespace { get; set; }
    public int? Page { get; set; }
    public int? Limit { get; set; }

    public Dictionary<string, string> ToQueryParams()
    {
        var p = new Dictionary<string, string>();
        if (Namespace != null) p["namespace"] = Namespace;
        if (Page.HasValue) p["page"] = Page.Value.ToString();
        if (Limit.HasValue) p["limit"] = Limit.Value.ToString();
        return p;
    }
}

public class GetDocumentParams
{
    public string? Id { get; set; }
    public string? Namespace { get; set; }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Id))
            throw new ArgumentException("id is required");
    }

    public Dictionary<string, string> ToQueryParams()
    {
        var p = new Dictionary<string, string>();
        if (Namespace != null) p["namespace"] = Namespace;
        return p;
    }
}

// ── Admin ──

public class GraphSnapshotParams
{
    public string? Namespace { get; set; }
    public string? Mode { get; set; }
    public int? Limit { get; set; }
    public int? SeedLimit { get; set; }

    public Dictionary<string, string> ToQueryParams()
    {
        var p = new Dictionary<string, string>();
        if (Namespace != null) p["namespace"] = Namespace;
        if (Mode != null) p["mode"] = Mode;
        if (Limit.HasValue) p["limit"] = Limit.Value.ToString();
        if (SeedLimit.HasValue) p["seedLimit"] = SeedLimit.Value.ToString();
        return p;
    }
}

public class WaitForIngestionJobOptions
{
    public int IntervalMs { get; set; } = 2000;
    public int MaxAttempts { get; set; } = 30;
}
