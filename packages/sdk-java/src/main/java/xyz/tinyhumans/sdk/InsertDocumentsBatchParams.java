package xyz.tinyhumans.sdk;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class InsertDocumentsBatchParams {

    private List<InsertDocumentParams> items;

    public InsertDocumentsBatchParams() {}

    public InsertDocumentsBatchParams(List<InsertDocumentParams> items) {
        this.items = items;
    }

    public void validate() {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("items is required and must be non-empty");
        }
        for (InsertDocumentParams item : items) {
            item.validate();
        }
    }

    public Map<String, Object> toMap() {
        validate();
        List<Map<String, Object>> itemMaps = new ArrayList<>();
        for (InsertDocumentParams item : items) {
            itemMaps.add(item.toMap());
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("items", itemMaps);
        return map;
    }

    public InsertDocumentsBatchParams setItems(List<InsertDocumentParams> items) { this.items = items; return this; }
    public List<InsertDocumentParams> getItems() { return items; }
}
