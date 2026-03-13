package xyz.alphahuman.sdk;

import java.util.LinkedHashMap;
import java.util.Map;

public class DeleteMemoryParams {

    private String namespace;

    public DeleteMemoryParams() {}

    public void validate() {
        // No required fields
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        if (namespace != null) map.put("namespace", namespace);
        return map;
    }

    public DeleteMemoryParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public String getNamespace() { return namespace; }
}
