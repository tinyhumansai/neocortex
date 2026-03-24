#include "tinyhumans/memory_client.hpp"
#include "tinyhumans/error.hpp"

#include <curl/curl.h>
#include <chrono>
#include <cstdlib>
#include <mutex>
#include <thread>

namespace tinyhumans {

static const char* DEFAULT_BASE_URL = "https://api.tinyhumans.ai";
static const char* TINYHUMANS_BASE_URL = "TINYHUMANS_BASE_URL";

static void global_curl_init() {
    static std::once_flag flag;
    std::call_once(flag, [] {
        curl_global_init(CURL_GLOBAL_DEFAULT);
        std::atexit(curl_global_cleanup);
    });
}

// ---- Write callback ----

size_t TinyHumansMemoryClient::write_callback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* buf = static_cast<std::string*>(userdata);
    buf->append(ptr, size * nmemb);
    return size * nmemb;
}

// ---- Constructor / Destructor ----

TinyHumansMemoryClient::TinyHumansMemoryClient(const std::string& token, const std::string& base_url)
    : token_(token), model_id_("neocortex-mk1") {
    if (token.empty() || token.find_first_not_of(" \t\n\r") == std::string::npos) {
        throw std::invalid_argument("token is required");
    }

    // Resolve base URL
    std::string resolved = base_url;
    if (resolved.empty()) {
        const char* env = std::getenv(TINYHUMANS_BASE_URL);
        if (env && env[0] != '\0') {
            resolved = env;
        }
    }
    if (resolved.empty()) {
        resolved = DEFAULT_BASE_URL;
    }
    // Strip trailing slashes
    while (!resolved.empty() && resolved.back() == '/') {
        resolved.pop_back();
    }
    base_url_ = resolved;

    global_curl_init();
    curl_ = curl_easy_init();
    if (!curl_) {
        throw std::runtime_error("failed to initialize curl");
    }
}

TinyHumansMemoryClient::TinyHumansMemoryClient(const std::string& token, const std::string& model_id, const std::string& base_url)
    : TinyHumansMemoryClient(token, base_url) {
    model_id_ = model_id;
}

TinyHumansMemoryClient::~TinyHumansMemoryClient() {
    if (curl_) {
        curl_easy_cleanup(static_cast<CURL*>(curl_));
        curl_ = nullptr;
    }
}

TinyHumansMemoryClient::TinyHumansMemoryClient(TinyHumansMemoryClient&& other) noexcept
    : base_url_(std::move(other.base_url_)),
      token_(std::move(other.token_)),
      model_id_(std::move(other.model_id_)),
      curl_(other.curl_) {
    other.curl_ = nullptr;
}

TinyHumansMemoryClient& TinyHumansMemoryClient::operator=(TinyHumansMemoryClient&& other) noexcept {
    if (this != &other) {
        if (curl_) {
            curl_easy_cleanup(static_cast<CURL*>(curl_));
        }
        base_url_ = std::move(other.base_url_);
        token_ = std::move(other.token_);
        model_id_ = std::move(other.model_id_);
        curl_ = other.curl_;
        other.curl_ = nullptr;
    }
    return *this;
}

// ---- HTTP ----

json TinyHumansMemoryClient::post(const std::string& path, const json& body) {
    auto* handle = static_cast<CURL*>(curl_);
    std::string url = base_url_ + path;
    std::string request_body = body.dump();
    std::string response_body;

    curl_easy_reset(handle);
    curl_easy_setopt(handle, CURLOPT_URL, url.c_str());
    curl_easy_setopt(handle, CURLOPT_POST, 1L);
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, request_body.c_str());
    curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE, static_cast<long>(request_body.size()));
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(handle, CURLOPT_CONNECTTIMEOUT, 30L);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    std::string auth_header = "Authorization: Bearer " + token_;
    headers = curl_slist_append(headers, auth_header.c_str());
    std::string model_header = "X-Model-Id: " + model_id_;
    headers = curl_slist_append(headers, model_header.c_str());
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(handle);
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(res));
    }

    long http_code = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &http_code);

    return handle_response(http_code, response_body);
}

std::string TinyHumansMemoryClient::build_query_string(const std::map<std::string, std::string>& params) {
    if (params.empty()) return "";
    auto* handle = static_cast<CURL*>(curl_);
    std::string qs = "?";
    bool first = true;
    for (const auto& [key, value] : params) {
        if (!first) qs += "&";
        char* escaped = curl_easy_escape(handle, value.c_str(), static_cast<int>(value.size()));
        qs += key + "=" + std::string(escaped);
        curl_free(escaped);
        first = false;
    }
    return qs;
}

json TinyHumansMemoryClient::send_get(const std::string& path, const std::map<std::string, std::string>& query_params) {
    auto* handle = static_cast<CURL*>(curl_);
    std::string url = base_url_ + path + build_query_string(query_params);
    std::string response_body;

    curl_easy_reset(handle);
    curl_easy_setopt(handle, CURLOPT_URL, url.c_str());
    curl_easy_setopt(handle, CURLOPT_HTTPGET, 1L);
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(handle, CURLOPT_CONNECTTIMEOUT, 30L);

    struct curl_slist* headers = nullptr;
    std::string auth_header = "Authorization: Bearer " + token_;
    headers = curl_slist_append(headers, auth_header.c_str());
    std::string model_header = "X-Model-Id: " + model_id_;
    headers = curl_slist_append(headers, model_header.c_str());
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(handle);
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(res));
    }

    long http_code = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &http_code);

    return handle_response(http_code, response_body);
}

json TinyHumansMemoryClient::send_delete(const std::string& path, const std::map<std::string, std::string>& query_params) {
    auto* handle = static_cast<CURL*>(curl_);
    std::string url = base_url_ + path + build_query_string(query_params);
    std::string response_body;

    curl_easy_reset(handle);
    curl_easy_setopt(handle, CURLOPT_URL, url.c_str());
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "DELETE");
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(handle, CURLOPT_CONNECTTIMEOUT, 30L);

    struct curl_slist* headers = nullptr;
    std::string auth_header = "Authorization: Bearer " + token_;
    headers = curl_slist_append(headers, auth_header.c_str());
    std::string model_header = "X-Model-Id: " + model_id_;
    headers = curl_slist_append(headers, model_header.c_str());
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(handle);
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(res));
    }

    long http_code = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &http_code);

    return handle_response(http_code, response_body);
}

json TinyHumansMemoryClient::handle_response(long http_code, const std::string& response_body) {
    json parsed;
    try {
        parsed = response_body.empty() ? json::object() : json::parse(response_body);
    } catch (const json::parse_error&) {
        throw TinyHumansError(
            "HTTP " + std::to_string(http_code) + ": non-JSON response",
            static_cast<int>(http_code),
            response_body
        );
    }

    if (http_code < 200 || http_code >= 300) {
        std::string message = "HTTP " + std::to_string(http_code);
        if (parsed.contains("error") && parsed["error"].is_string()) {
            message = parsed["error"].get<std::string>();
        }
        throw TinyHumansError(message, static_cast<int>(http_code), response_body);
    }

    return parsed;
}

// ---- API methods ----

InsertMemoryResponse TinyHumansMemoryClient::insert_memory(const InsertMemoryParams& params) {
    json body = params.to_json();
    json resp = post("/memory/insert", body);
    return InsertMemoryResponse::from_json(resp);
}

RecallMemoryResponse TinyHumansMemoryClient::recall_memory(const RecallMemoryParams& params) {
    json body = params.to_json();
    json resp = post("/memory/recall", body);
    return RecallMemoryResponse::from_json(resp);
}

DeleteMemoryResponse TinyHumansMemoryClient::delete_memory(const DeleteMemoryParams& params) {
    json body = params.to_json();
    json resp = post("/memory/admin/delete", body);
    return DeleteMemoryResponse::from_json(resp);
}

QueryMemoryResponse TinyHumansMemoryClient::query_memory(const QueryMemoryParams& params) {
    json body = params.to_json();
    json resp = post("/memory/query", body);
    return QueryMemoryResponse::from_json(resp);
}

RecallMemoriesResponse TinyHumansMemoryClient::recall_memories(const RecallMemoriesParams& params) {
    json body = params.to_json();
    json resp = post("/memory/memories/recall", body);
    return RecallMemoriesResponse::from_json(resp);
}

// ---- Chat ----

json TinyHumansMemoryClient::chat_memory(const ChatMemoryParams& params) {
    return post("/memory/chat", params.to_json());
}

json TinyHumansMemoryClient::chat_memory_context(const ChatMemoryParams& params) {
    return post("/memory/conversations", params.to_json());
}

// ---- Interactions ----

json TinyHumansMemoryClient::interact_memory(const InteractMemoryParams& params) {
    return post("/memory/interact", params.to_json());
}

json TinyHumansMemoryClient::record_interactions(const InteractMemoryParams& params) {
    return post("/memory/interactions", params.to_json());
}

// ---- Advanced recall ----

json TinyHumansMemoryClient::recall_thoughts(const RecallThoughtsParams& params) {
    return post("/memory/memories/thoughts", params.to_json());
}

json TinyHumansMemoryClient::query_memory_context(const QueryMemoryContextParams& params) {
    return post("/memory/queries", params.to_json());
}

// ---- Documents ----

json TinyHumansMemoryClient::insert_document(const InsertDocumentParams& params) {
    return post("/memory/documents", params.to_json());
}

json TinyHumansMemoryClient::insert_documents_batch(const InsertDocumentsBatchParams& params) {
    return post("/memory/documents/batch", params.to_json());
}

json TinyHumansMemoryClient::list_documents(const ListDocumentsParams& params) {
    return send_get("/memory/documents", params.to_query_params());
}

json TinyHumansMemoryClient::get_document(const GetDocumentParams& params) {
    params.validate();
    return send_get("/memory/documents/" + params.id, params.to_query_params());
}

json TinyHumansMemoryClient::delete_document(const std::string& document_id, const std::string& namespace_) {
    std::map<std::string, std::string> query_params;
    if (!namespace_.empty()) query_params["namespace"] = namespace_;
    return send_delete("/memory/documents/" + document_id, query_params);
}

// ---- Admin & utility ----

json TinyHumansMemoryClient::get_graph_snapshot(const GraphSnapshotParams& params) {
    return send_get("/memory/admin/graph-snapshot", params.to_query_params());
}

json TinyHumansMemoryClient::get_ingestion_job(const std::string& job_id) {
    return send_get("/memory/ingestion/jobs/" + job_id);
}

json TinyHumansMemoryClient::wait_for_ingestion_job(const std::string& job_id, const WaitForIngestionJobOptions& opts) {
    for (int i = 0; i < opts.max_attempts; ++i) {
        json result = get_ingestion_job(job_id);
        auto data = result.value("data", json::object());
        std::string status = data.value("status", "");
        if (status == "completed" || status == "failed") {
            return result;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(opts.interval_ms));
    }
    throw std::runtime_error("ingestion job timed out after " + std::to_string(opts.max_attempts) + " attempts");
}

} // namespace tinyhumans
