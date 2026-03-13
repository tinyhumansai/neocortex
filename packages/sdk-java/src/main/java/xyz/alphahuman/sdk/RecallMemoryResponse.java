package xyz.alphahuman.sdk;

import java.util.Map;

public class RecallMemoryResponse {

    private final boolean success;
    private final Map<String, Object> context;
    private final String llmContextMessage;
    private final boolean cached;
    private final Map<String, Object> counts;
    private final Map<String, Object> usage;

    private RecallMemoryResponse(boolean success, Map<String, Object> context, String llmContextMessage,
                                  boolean cached, Map<String, Object> counts, Map<String, Object> usage) {
        this.success = success;
        this.context = context;
        this.llmContextMessage = llmContextMessage;
        this.cached = cached;
        this.counts = counts;
        this.usage = usage;
    }

    @SuppressWarnings("unchecked")
    public static RecallMemoryResponse fromMap(Map<String, Object> payload) {
        boolean success = Boolean.TRUE.equals(payload.get("success"));
        Map<String, Object> data = (Map<String, Object>) payload.getOrDefault("data", Map.of());
        Map<String, Object> context = (Map<String, Object>) data.get("context");
        String llmCtx = (String) data.get("llmContextMessage");
        boolean cached = Boolean.TRUE.equals(data.get("cached"));
        Map<String, Object> counts = (Map<String, Object>) data.get("counts");
        Map<String, Object> usage = (Map<String, Object>) data.get("usage");
        return new RecallMemoryResponse(success, context, llmCtx, cached, counts, usage);
    }

    public boolean isSuccess() { return success; }
    public Map<String, Object> getContext() { return context; }
    public String getLlmContextMessage() { return llmContextMessage; }
    public boolean isCached() { return cached; }
    public Map<String, Object> getCounts() { return counts; }
    public Map<String, Object> getUsage() { return usage; }
}
