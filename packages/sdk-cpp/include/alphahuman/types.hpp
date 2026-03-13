#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace alphahuman {

using json = nlohmann::json;

// ---- Request parameter structs ----

struct InsertMemoryParams {
    std::string title;
    std::string content;
    std::string namespace_;
    std::string source_type = "doc";
    std::optional<json> metadata;
    std::optional<std::string> priority;
    std::optional<long> created_at;
    std::optional<long> updated_at;
    std::optional<std::string> document_id;

    InsertMemoryParams& set_title(const std::string& v) { title = v; return *this; }
    InsertMemoryParams& set_content(const std::string& v) { content = v; return *this; }
    InsertMemoryParams& set_namespace(const std::string& v) { namespace_ = v; return *this; }
    InsertMemoryParams& set_source_type(const std::string& v) { source_type = v; return *this; }
    InsertMemoryParams& set_metadata(const json& v) { metadata = v; return *this; }
    InsertMemoryParams& set_priority(const std::string& v) { priority = v; return *this; }
    InsertMemoryParams& set_created_at(long v) { created_at = v; return *this; }
    InsertMemoryParams& set_updated_at(long v) { updated_at = v; return *this; }
    InsertMemoryParams& set_document_id(const std::string& v) { document_id = v; return *this; }

    void validate() const {
        if (title.empty()) throw std::invalid_argument("title is required");
        if (content.empty()) throw std::invalid_argument("content is required");
        if (namespace_.empty()) throw std::invalid_argument("namespace is required");
    }

    json to_json() const {
        validate();
        json j;
        j["title"] = title;
        j["content"] = content;
        j["namespace"] = namespace_;
        j["sourceType"] = source_type;
        if (metadata) j["metadata"] = *metadata;
        if (priority) j["priority"] = *priority;
        if (created_at) j["createdAt"] = *created_at;
        if (updated_at) j["updatedAt"] = *updated_at;
        if (document_id) j["documentId"] = *document_id;
        return j;
    }
};

struct RecallMemoryParams {
    std::optional<std::string> namespace_;
    std::optional<int> max_chunks;

    RecallMemoryParams& set_namespace(const std::string& v) { namespace_ = v; return *this; }
    RecallMemoryParams& set_max_chunks(int v) { max_chunks = v; return *this; }

    void validate() const {
        if (max_chunks && *max_chunks <= 0)
            throw std::invalid_argument("maxChunks must be a positive integer");
    }

    json to_json() const {
        validate();
        json j = json::object();
        if (namespace_) j["namespace"] = *namespace_;
        if (max_chunks) j["maxChunks"] = *max_chunks;
        return j;
    }
};

struct DeleteMemoryParams {
    std::optional<std::string> namespace_;

    DeleteMemoryParams& set_namespace(const std::string& v) { namespace_ = v; return *this; }

    void validate() const {}

    json to_json() const {
        validate();
        json j = json::object();
        if (namespace_) j["namespace"] = *namespace_;
        return j;
    }
};

struct QueryMemoryParams {
    std::string query;
    std::optional<std::string> namespace_;
    std::optional<int> max_chunks;
    std::optional<bool> include_references;
    std::optional<std::vector<std::string>> document_ids;
    std::optional<std::string> llm_query;

    QueryMemoryParams& set_query(const std::string& v) { query = v; return *this; }
    QueryMemoryParams& set_namespace(const std::string& v) { namespace_ = v; return *this; }
    QueryMemoryParams& set_max_chunks(int v) { max_chunks = v; return *this; }
    QueryMemoryParams& set_include_references(bool v) { include_references = v; return *this; }
    QueryMemoryParams& set_document_ids(const std::vector<std::string>& v) { document_ids = v; return *this; }
    QueryMemoryParams& set_llm_query(const std::string& v) { llm_query = v; return *this; }

    void validate() const {
        if (query.empty()) throw std::invalid_argument("query is required");
        if (max_chunks && (*max_chunks < 1 || *max_chunks > 200))
            throw std::invalid_argument("maxChunks must be between 1 and 200");
    }

    json to_json() const {
        validate();
        json j;
        j["query"] = query;
        if (namespace_) j["namespace"] = *namespace_;
        if (max_chunks) j["maxChunks"] = *max_chunks;
        if (include_references) j["includeReferences"] = *include_references;
        if (document_ids) j["documentIds"] = *document_ids;
        if (llm_query) j["llmQuery"] = *llm_query;
        return j;
    }
};

struct RecallMemoriesParams {
    std::optional<std::string> namespace_;
    std::optional<int> top_k;
    std::optional<double> min_retention;
    std::optional<long> as_of;

    RecallMemoriesParams& set_namespace(const std::string& v) { namespace_ = v; return *this; }
    RecallMemoriesParams& set_top_k(int v) { top_k = v; return *this; }
    RecallMemoriesParams& set_min_retention(double v) { min_retention = v; return *this; }
    RecallMemoriesParams& set_as_of(long v) { as_of = v; return *this; }

    void validate() const {
        if (top_k && *top_k <= 0)
            throw std::invalid_argument("topK must be a positive number");
        if (min_retention && *min_retention < 0)
            throw std::invalid_argument("minRetention must be a non-negative number");
    }

    json to_json() const {
        validate();
        json j = json::object();
        if (namespace_) j["namespace"] = *namespace_;
        if (top_k) j["topK"] = *top_k;
        if (min_retention) j["minRetention"] = *min_retention;
        if (as_of) j["asOf"] = *as_of;
        return j;
    }
};

// ---- Response structs ----

struct InsertMemoryResponse {
    bool success = false;
    std::string status;
    json stats;
    std::optional<json> usage;

    static InsertMemoryResponse from_json(const json& j) {
        InsertMemoryResponse r;
        r.success = j.value("success", false);
        auto data = j.value("data", json::object());
        r.status = data.value("status", "");
        r.stats = data.value("stats", json::object());
        if (data.contains("usage")) r.usage = data["usage"];
        return r;
    }
};

struct RecallMemoryResponse {
    bool success = false;
    std::optional<json> context;
    std::optional<std::string> llm_context_message;
    bool cached = false;
    std::optional<json> counts;
    std::optional<json> usage;

    static RecallMemoryResponse from_json(const json& j) {
        RecallMemoryResponse r;
        r.success = j.value("success", false);
        auto data = j.value("data", json::object());
        if (data.contains("context")) r.context = data["context"];
        if (data.contains("llmContextMessage") && !data["llmContextMessage"].is_null())
            r.llm_context_message = data["llmContextMessage"].get<std::string>();
        r.cached = data.value("cached", false);
        if (data.contains("counts")) r.counts = data["counts"];
        if (data.contains("usage")) r.usage = data["usage"];
        return r;
    }
};

struct DeleteMemoryResponse {
    bool success = false;
    int nodes_deleted = 0;
    std::string status;
    std::string message;

    static DeleteMemoryResponse from_json(const json& j) {
        DeleteMemoryResponse r;
        r.success = j.value("success", false);
        auto data = j.value("data", json::object());
        r.nodes_deleted = data.value("nodesDeleted", 0);
        r.status = data.value("status", "");
        r.message = data.value("message", "");
        return r;
    }
};

struct QueryMemoryResponse {
    bool success = false;
    std::optional<json> context;
    std::optional<std::string> llm_context_message;
    bool cached = false;
    std::optional<std::string> response;
    std::optional<json> usage;

    static QueryMemoryResponse from_json(const json& j) {
        QueryMemoryResponse r;
        r.success = j.value("success", false);
        auto data = j.value("data", json::object());
        if (data.contains("context")) r.context = data["context"];
        if (data.contains("llmContextMessage") && !data["llmContextMessage"].is_null())
            r.llm_context_message = data["llmContextMessage"].get<std::string>();
        r.cached = data.value("cached", false);
        if (data.contains("response") && !data["response"].is_null())
            r.response = data["response"].get<std::string>();
        if (data.contains("usage")) r.usage = data["usage"];
        return r;
    }
};

struct RecallMemoriesResponse {
    bool success = false;
    std::vector<json> memories;

    static RecallMemoriesResponse from_json(const json& j) {
        RecallMemoriesResponse r;
        r.success = j.value("success", false);
        auto data = j.value("data", json::object());
        if (data.contains("memories") && data["memories"].is_array()) {
            for (const auto& m : data["memories"]) {
                r.memories.push_back(m);
            }
        }
        return r;
    }
};

} // namespace alphahuman
