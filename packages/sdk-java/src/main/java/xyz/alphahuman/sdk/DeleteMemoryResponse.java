package xyz.alphahuman.sdk;

import java.util.Map;

public class DeleteMemoryResponse {

    private final boolean success;
    private final int nodesDeleted;
    private final String status;
    private final String message;

    private DeleteMemoryResponse(boolean success, int nodesDeleted, String status, String message) {
        this.success = success;
        this.nodesDeleted = nodesDeleted;
        this.status = status;
        this.message = message;
    }

    @SuppressWarnings("unchecked")
    public static DeleteMemoryResponse fromMap(Map<String, Object> payload) {
        boolean success = Boolean.TRUE.equals(payload.get("success"));
        Map<String, Object> data = (Map<String, Object>) payload.getOrDefault("data", Map.of());
        int nodesDeleted = 0;
        Object nd = data.get("nodesDeleted");
        if (nd instanceof Number) nodesDeleted = ((Number) nd).intValue();
        String status = (String) data.get("status");
        String message = (String) data.get("message");
        return new DeleteMemoryResponse(success, nodesDeleted, status, message);
    }

    public boolean isSuccess() { return success; }
    public int getNodesDeleted() { return nodesDeleted; }
    public String getStatus() { return status; }
    public String getMessage() { return message; }
}
