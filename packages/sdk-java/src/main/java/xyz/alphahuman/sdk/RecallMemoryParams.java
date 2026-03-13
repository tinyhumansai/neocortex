package xyz.alphahuman.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class RecallMemoryParams {

    private String namespace;
    private Integer maxChunks;

    public RecallMemoryParams() {}

    public void validate() {
        if (maxChunks != null && maxChunks <= 0) {
            throw new IllegalArgumentException("maxChunks must be a positive integer");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        if (namespace != null) map.put("namespace", namespace);
        if (maxChunks != null) map.put("maxChunks", maxChunks);
        return map;
    }

    public RecallMemoryParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public RecallMemoryParams setMaxChunks(Integer maxChunks) { this.maxChunks = maxChunks; return this; }

    public String getNamespace() { return namespace; }
    public Integer getMaxChunks() { return maxChunks; }
}
