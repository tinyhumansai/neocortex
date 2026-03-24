package xyz.tinyhumans.sdk;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class InteractMemoryParams {

    private String namespace;
    private List<String> entityNames;
    private String description;
    private String interactionLevel;
    private List<String> interactionLevels;
    private Double timestamp;

    public InteractMemoryParams() {}

    public InteractMemoryParams(String namespace, List<String> entityNames) {
        this.namespace = namespace;
        this.entityNames = entityNames;
    }

    public void validate() {
        if (namespace == null || namespace.isEmpty()) {
            throw new IllegalArgumentException("namespace is required");
        }
        if (entityNames == null || entityNames.isEmpty()) {
            throw new IllegalArgumentException("entityNames is required and must be non-empty");
        }
    }

    public Map<String, Object> toMap() {
        validate();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("namespace", namespace);
        map.put("entityNames", entityNames);
        if (description != null) map.put("description", description);
        if (interactionLevel != null) map.put("interactionLevel", interactionLevel);
        if (interactionLevels != null) map.put("interactionLevels", interactionLevels);
        if (timestamp != null) map.put("timestamp", timestamp);
        return map;
    }

    public InteractMemoryParams setNamespace(String namespace) { this.namespace = namespace; return this; }
    public InteractMemoryParams setEntityNames(List<String> entityNames) { this.entityNames = entityNames; return this; }
    public InteractMemoryParams setDescription(String description) { this.description = description; return this; }
    public InteractMemoryParams setInteractionLevel(String interactionLevel) { this.interactionLevel = interactionLevel; return this; }
    public InteractMemoryParams setInteractionLevels(List<String> interactionLevels) { this.interactionLevels = interactionLevels; return this; }
    public InteractMemoryParams setTimestamp(Double timestamp) { this.timestamp = timestamp; return this; }

    public String getNamespace() { return namespace; }
    public List<String> getEntityNames() { return entityNames; }
    public String getDescription() { return description; }
    public String getInteractionLevel() { return interactionLevel; }
    public List<String> getInteractionLevels() { return interactionLevels; }
    public Double getTimestamp() { return timestamp; }
}
