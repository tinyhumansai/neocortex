package xyz.alphahuman.sdk;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class RecallMemoriesResponse {

    private final boolean success;
    private final List<Map<String, Object>> memories;

    private RecallMemoriesResponse(boolean success, List<Map<String, Object>> memories) {
        this.success = success;
        this.memories = memories;
    }

    @SuppressWarnings("unchecked")
    public static RecallMemoriesResponse fromMap(Map<String, Object> payload) {
        boolean success = Boolean.TRUE.equals(payload.get("success"));
        Map<String, Object> data = (Map<String, Object>) payload.getOrDefault("data", Map.of());
        List<Map<String, Object>> memories = Collections.emptyList();
        Object mem = data.get("memories");
        if (mem instanceof List) {
            memories = (List<Map<String, Object>>) mem;
        }
        return new RecallMemoriesResponse(success, memories);
    }

    public boolean isSuccess() { return success; }
    public List<Map<String, Object>> getMemories() { return memories; }
}
