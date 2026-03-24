package xyz.tinyhumans.sdk;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ChatMemoryParams {

    private List<Map<String, String>> messages;
    private Double temperature;
    private Integer maxTokens;

    public ChatMemoryParams() {}

    public ChatMemoryParams(List<Map<String, String>> messages) {
        this.messages = messages;
    }

    public void validate() {
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("messages is required and must be non-empty");
        }
        for (Map<String, String> msg : messages) {
            if (msg.get("role") == null || msg.get("role").isEmpty()) {
                throw new IllegalArgumentException("each message must have a non-empty role");
            }
            if (msg.get("content") == null || msg.get("content").isEmpty()) {
                throw new IllegalArgumentException("each message must have non-empty content");
            }
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("messages", messages);
        if (temperature != null) map.put("temperature", temperature);
        if (maxTokens != null) map.put("maxTokens", maxTokens);
        return map;
    }

    public ChatMemoryParams setMessages(List<Map<String, String>> messages) { this.messages = messages; return this; }
    public ChatMemoryParams setTemperature(Double temperature) { this.temperature = temperature; return this; }
    public ChatMemoryParams setMaxTokens(Integer maxTokens) { this.maxTokens = maxTokens; return this; }

    public List<Map<String, String>> getMessages() { return messages; }
    public Double getTemperature() { return temperature; }
    public Integer getMaxTokens() { return maxTokens; }
}
