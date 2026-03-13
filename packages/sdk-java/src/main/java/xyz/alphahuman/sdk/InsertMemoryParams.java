package xyz.alphahuman.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class InsertMemoryParams {

    private String title;
    private String content;
    private String namespace;
    private String sourceType = "doc";
    private Map<String, Object> metadata;
    private String priority;
    private Number createdAt;
    private Number updatedAt;
    private String documentId;

    public InsertMemoryParams() {}

    public InsertMemoryParams(String title, String content, String namespace) {
        this.title = title;
        this.content = content;
        this.namespace = namespace;
    }

    public void validate() {
        if (title == null || title.isEmpty()) {
            throw new IllegalArgumentException("title is required and must be a non-empty string");
        }
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("content is required and must be a non-empty string");
        }
        if (namespace == null || namespace.isEmpty()) {
            throw new IllegalArgumentException("namespace is required and must be a non-empty string");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", title);
        map.put("content", content);
        map.put("namespace", namespace);
        map.put("sourceType", sourceType);
        if (metadata != null) map.put("metadata", metadata);
        if (priority != null) map.put("priority", priority);
        if (createdAt != null) map.put("createdAt", createdAt);
        if (updatedAt != null) map.put("updatedAt", updatedAt);
        if (documentId != null) map.put("documentId", documentId);
        return map;
    }

    // Setters (builder-style)

    public InsertMemoryParams setTitle(String title) { this.title = title; return this; }
    public InsertMemoryParams setContent(String content) { this.content = content; return this; }
    public InsertMemoryParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public InsertMemoryParams setSourceType(String sourceType) { this.sourceType = sourceType; return this; }
    public InsertMemoryParams setMetadata(Map<String, Object> metadata) { this.metadata = metadata; return this; }
    public InsertMemoryParams setPriority(String priority) { this.priority = priority; return this; }
    public InsertMemoryParams setCreatedAt(Number createdAt) { this.createdAt = createdAt; return this; }
    public InsertMemoryParams setUpdatedAt(Number updatedAt) { this.updatedAt = updatedAt; return this; }
    public InsertMemoryParams setDocumentId(String documentId) { this.documentId = documentId; return this; }

    // Getters

    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getNamespace() { return namespace; }
    public String getSourceType() { return sourceType; }
    public Map<String, Object> getMetadata() { return metadata; }
    public String getPriority() { return priority; }
    public Number getCreatedAt() { return createdAt; }
    public Number getUpdatedAt() { return updatedAt; }
    public String getDocumentId() { return documentId; }
}
