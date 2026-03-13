package xyz.alphahuman.sdk;

import java.util.Map;

public class QueryMemoryResponse {

    private final boolean success;
    private final Map<String, Object> context;
    private final String llmContextMessage;
    private final boolean cached;
    private final String response;
    private final Map<String, Object> usage;

    private QueryMemoryResponse(boolean success, Map<String, Object> context, String llmContextMessage,
                                 boolean cached, String response, Map<String, Object> usage) {
        this.success = success;
        this.context = context;
        this.llmContextMessage = llmContextMessage;
        this.cached = cached;
        this.response = response;
        this.usage = usage;
    }

    @SuppressWarnings("unchecked")
    public static QueryMemoryResponse fromMap(Map<String, Object> payload) {
        boolean success = Boolean.TRUE.equals(payload.get("success"));
        Map<String, Object> data = (Map<String, Object>) payload.getOrDefault("data", Map.of());
        Map<String, Object> context = (Map<String, Object>) data.get("context");
        String llmCtx = (String) data.get("llmContextMessage");
        boolean cached = Boolean.TRUE.equals(data.get("cached"));
        String response = (String) data.get("response");
        Map<String, Object> usage = (Map<String, Object>) data.get("usage");
        return new QueryMemoryResponse(success, context, llmCtx, cached, response, usage);
    }

    public boolean isSuccess() { return success; }
    public Map<String, Object> getContext() { return context; }
    public String getLlmContextMessage() { return llmContextMessage; }
    public boolean isCached() { return cached; }
    public String getResponse() { return response; }
    public Map<String, Object> getUsage() { return usage; }
}
