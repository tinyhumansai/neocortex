#pragma once

#include "types.hpp"
#include <map>
#include <string>

namespace tinyhumans {

class TinyHumansMemoryClient {
public:
    explicit TinyHumansMemoryClient(const std::string& token, const std::string& base_url = "");
    TinyHumansMemoryClient(const std::string& token, const std::string& model_id, const std::string& base_url);
    ~TinyHumansMemoryClient();

    // Non-copyable
    TinyHumansMemoryClient(const TinyHumansMemoryClient&) = delete;
    TinyHumansMemoryClient& operator=(const TinyHumansMemoryClient&) = delete;

    // Movable
    TinyHumansMemoryClient(TinyHumansMemoryClient&& other) noexcept;
    TinyHumansMemoryClient& operator=(TinyHumansMemoryClient&& other) noexcept;

    InsertMemoryResponse insert_memory(const InsertMemoryParams& params);
    RecallMemoryResponse recall_memory(const RecallMemoryParams& params = {});
    DeleteMemoryResponse delete_memory(const DeleteMemoryParams& params = {});
    QueryMemoryResponse query_memory(const QueryMemoryParams& params);
    RecallMemoriesResponse recall_memories(const RecallMemoriesParams& params = {});

    // Chat
    json chat_memory(const ChatMemoryParams& params);
    json chat_memory_context(const ChatMemoryParams& params);

    // Interactions
    json interact_memory(const InteractMemoryParams& params);
    json record_interactions(const InteractMemoryParams& params);

    // Advanced recall
    json recall_thoughts(const RecallThoughtsParams& params = {});
    json query_memory_context(const QueryMemoryContextParams& params);

    // Documents
    json insert_document(const InsertDocumentParams& params);
    json insert_documents_batch(const InsertDocumentsBatchParams& params);
    json list_documents(const ListDocumentsParams& params = {});
    json get_document(const GetDocumentParams& params);
    json delete_document(const std::string& document_id, const std::string& namespace_ = "");

    // Admin & utility
    json get_graph_snapshot(const GraphSnapshotParams& params = {});
    json get_ingestion_job(const std::string& job_id);
    json wait_for_ingestion_job(const std::string& job_id, const WaitForIngestionJobOptions& opts = {});

private:
    json post(const std::string& path, const json& body);
    json send_get(const std::string& path, const std::map<std::string, std::string>& query_params = {});
    json send_delete(const std::string& path, const std::map<std::string, std::string>& query_params = {});
    std::string build_query_string(const std::map<std::string, std::string>& params);
    json handle_response(long http_code, const std::string& response_body);
    static size_t write_callback(char* ptr, size_t size, size_t nmemb, void* userdata);

    std::string base_url_;
    std::string token_;
    std::string model_id_;
    void* curl_ = nullptr;
};

} // namespace tinyhumans
