package xyz.alphahuman.sdk;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class QueryMemoryParams {

    private String query;
    private String namespace;
    private Integer maxChunks;
    private Boolean includeReferences;
    private List<String> documentIds;
    private String llmQuery;

    public QueryMemoryParams() {}

    public QueryMemoryParams(String query) {
        this.query = query;
    }

    public void validate() {
        if (query == null || query.isEmpty()) {
            throw new IllegalArgumentException("query is required and must be a non-empty string");
        }
        if (maxChunks != null && (maxChunks < 1 || maxChunks > 200)) {
            throw new IllegalArgumentException("maxChunks must be between 1 and 200");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("query", query);
        if (namespace != null) map.put("namespace", namespace);
        if (maxChunks != null) map.put("maxChunks", maxChunks);
        if (includeReferences != null) map.put("includeReferences", includeReferences);
        if (documentIds != null) map.put("documentIds", documentIds);
        if (llmQuery != null) map.put("llmQuery", llmQuery);
        return map;
    }

    public QueryMemoryParams setQuery(String query) { this.query = query; return this; }
    public QueryMemoryParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public QueryMemoryParams setMaxChunks(Integer maxChunks) { this.maxChunks = maxChunks; return this; }
    public QueryMemoryParams setIncludeReferences(Boolean includeReferences) { this.includeReferences = includeReferences; return this; }
    public QueryMemoryParams setDocumentIds(List<String> documentIds) { this.documentIds = documentIds; return this; }
    public QueryMemoryParams setLlmQuery(String llmQuery) { this.llmQuery = llmQuery; return this; }

    public String getQuery() { return query; }
    public String getNamespace() { return namespace; }
    public Integer getMaxChunks() { return maxChunks; }
    public Boolean getIncludeReferences() { return includeReferences; }
    public List<String> getDocumentIds() { return documentIds; }
    public String getLlmQuery() { return llmQuery; }
}
