package xyz.alphahuman.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class RecallMemoriesParams {

    private String namespace;
    private Integer topK;
    private Double minRetention;
    private Number asOf;

    public RecallMemoriesParams() {}

    public void validate() {
        if (topK != null && topK <= 0) {
            throw new IllegalArgumentException("topK must be a positive number");
        }
        if (minRetention != null && minRetention < 0) {
            throw new IllegalArgumentException("minRetention must be a non-negative number");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        if (namespace != null) map.put("namespace", namespace);
        if (topK != null) map.put("topK", topK);
        if (minRetention != null) map.put("minRetention", minRetention);
        if (asOf != null) map.put("asOf", asOf);
        return map;
    }

    public RecallMemoriesParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public RecallMemoriesParams setTopK(Integer topK) { this.topK = topK; return this; }
    public RecallMemoriesParams setMinRetention(Double minRetention) { this.minRetention = minRetention; return this; }
    public RecallMemoriesParams setAsOf(Number asOf) { this.asOf = asOf; return this; }

    public String getNamespace() { return namespace; }
    public Integer getTopK() { return topK; }
    public Double getMinRetention() { return minRetention; }
    public Number getAsOf() { return asOf; }
}
