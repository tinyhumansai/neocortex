package xyz.alphahuman.sdk;

import java.util.Map;

public class InsertMemoryResponse {

    private final boolean success;
    private final String status;
    private final Map<String, Object> stats;
    private final Map<String, Object> usage;

    private InsertMemoryResponse(boolean success, String status, Map<String, Object> stats, Map<String, Object> usage) {
        this.success = success;
        this.status = status;
        this.stats = stats;
        this.usage = usage;
    }

    @SuppressWarnings("unchecked")
    public static InsertMemoryResponse fromMap(Map<String, Object> payload) {
        boolean success = Boolean.TRUE.equals(payload.get("success"));
        Map<String, Object> data = (Map<String, Object>) payload.getOrDefault("data", Map.of());
        String status = (String) data.get("status");
        Map<String, Object> stats = (Map<String, Object>) data.get("stats");
        Map<String, Object> usage = (Map<String, Object>) data.get("usage");
        return new InsertMemoryResponse(success, status, stats, usage);
    }

    public boolean isSuccess() { return success; }
    public String getStatus() { return status; }
    public Map<String, Object> getStats() { return stats; }
    public Map<String, Object> getUsage() { return usage; }
}
