package xyz.tinyhumans.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class InsertDocumentParams {

    private String title;
    private String content;
    private String namespace;
    private String sourceType;
    private Map<String, Object> metadata;
    private String priority;
    private Number createdAt;
    private Number updatedAt;
    private String documentId;

    public InsertDocumentParams() {}

    public InsertDocumentParams(String title, String content, String namespace) {
        this.title = title;
        this.content = content;
        this.namespace = namespace;
    }

    public void validate() {
        if (title == null || title.isEmpty()) {
            throw new IllegalArgumentException("title is required");
        }
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("content is required");
        }
        if (namespace == null || namespace.isEmpty()) {
            throw new IllegalArgumentException("namespace is required");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", title);
        map.put("content", content);
        map.put("namespace", namespace);
        if (sourceType != null) map.put("sourceType", sourceType);
        if (metadata != null) map.put("metadata", metadata);
        if (priority != null) map.put("priority", priority);
        if (createdAt != null) map.put("createdAt", createdAt);
        if (updatedAt != null) map.put("updatedAt", updatedAt);
        if (documentId != null) map.put("documentId", documentId);
        return map;
    }

    public InsertDocumentParams setTitle(String title) { this.title = title; return this; }
    public InsertDocumentParams setContent(String content) { this.content = content; return this; }
    public InsertDocumentParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public InsertDocumentParams setSourceType(String sourceType) { this.sourceType = sourceType; return this; }
    public InsertDocumentParams setMetadata(Map<String, Object> metadata) { this.metadata = metadata; return this; }
    public InsertDocumentParams setPriority(String priority) { this.priority = priority; return this; }
    public InsertDocumentParams setCreatedAt(Number createdAt) { this.createdAt = createdAt; return this; }
    public InsertDocumentParams setUpdatedAt(Number updatedAt) { this.updatedAt = updatedAt; return this; }
    public InsertDocumentParams setDocumentId(String documentId) { this.documentId = documentId; return this; }

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
