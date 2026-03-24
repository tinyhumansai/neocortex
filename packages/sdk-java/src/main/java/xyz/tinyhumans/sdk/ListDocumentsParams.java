package xyz.tinyhumans.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class ListDocumentsParams {

    private String namespace;
    private Integer limit;
    private Integer offset;

    public ListDocumentsParams() {}

    public Map<String, String> toQueryParams() {
        Map<String, String> params = new LinkedHashMap<>();
        if (namespace != null) params.put("namespace", namespace);
        if (limit != null) params.put("limit", String.valueOf(limit));
        if (offset != null) params.put("offset", String.valueOf(offset));
        return params;
    }

    public ListDocumentsParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public ListDocumentsParams setLimit(Integer limit) { this.limit = limit; return this; }
    public ListDocumentsParams setOffset(Integer offset) { this.offset = offset; return this; }

    public String getNamespace() { return namespace; }
    public Integer getLimit() { return limit; }
    public Integer getOffset() { return offset; }
}
