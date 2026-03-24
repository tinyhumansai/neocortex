package xyz.tinyhumans.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class GetDocumentParams {

    private String documentId;
    private String namespace;

    public GetDocumentParams() {}

    public GetDocumentParams(String documentId) {
        this.documentId = documentId;
    }

    public void validate() {
        if (documentId == null || documentId.isEmpty()) {
            throw new IllegalArgumentException("documentId is required");
        }
    }

    public Map<String, String> toQueryParams() {
        Map<String, String> params = new LinkedHashMap<>();
        if (namespace != null) params.put("namespace", namespace);
        return params;
    }

    public GetDocumentParams setDocumentId(String documentId) { this.documentId = documentId; return this; }
    public GetDocumentParams setNamespace(String namespace) { this.namespace = namespace; return this; }

    public String getDocumentId() { return documentId; }
    public String getNamespace() { return namespace; }
}
