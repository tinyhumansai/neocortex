#include <gtest/gtest.h>
#include "tinyhumans/tinyhumans.hpp"

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

using namespace tinyhumans;

TEST(IntegrationTest, FullLifecycle) {
    const char* token_env = std::getenv("TINYHUMANS_TOKEN");
    if (!token_env || token_env[0] == '\0') {
        GTEST_SKIP() << "TINYHUMANS_TOKEN not set, skipping integration test";
    }
    std::string token = token_env;

    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    std::string ns = "integration-test-cpp-" + std::to_string(now_ms);

    TinyHumansMemoryClient client(token);

    // --- Insert ---
    long now_s = static_cast<long>(now_ms / 1000);
    InsertMemoryParams insert_params;
    insert_params.set_title("test-key-1")
        .set_content("The capital of France is Paris.")
        .set_namespace(ns)
        .set_document_id("integration-test-doc-1")
        .set_metadata(json{{"source", "integration-test"}})
        .set_created_at(now_s)
        .set_updated_at(now_s);
    auto insert_resp = client.insert_memory(insert_params);
    std::cout << "Insert: status=" << insert_resp.status << std::endl;

    std::this_thread::sleep_for(std::chrono::seconds(2));

    // --- Recall ---
    RecallMemoryParams recall_params;
    recall_params.set_namespace(ns);
    auto recall_resp = client.recall_memory(recall_params);
    std::cout << "Recall: cached=" << recall_resp.cached << std::endl;

    // --- Recall Memories (Ebbinghaus) ---
    RecallMemoriesParams memories_params;
    memories_params.set_namespace(ns);
    auto memories_resp = client.recall_memories(memories_params);
    std::cout << "RecallMemories: count=" << memories_resp.memories.size() << std::endl;

    // --- Insert Document ---
    try {
        InsertDocumentParams doc_params;
        doc_params.set_title("Test Doc").set_content("Document content").set_namespace(ns);
        auto doc_resp = client.insert_document(doc_params);
        std::cout << "InsertDocument: " << doc_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "InsertDocument: " << e.what() << std::endl;
    }

    // --- Insert Documents Batch ---
    try {
        InsertDocumentParams d1, d2;
        d1.set_title("Batch 1").set_content("Content 1").set_namespace(ns);
        d2.set_title("Batch 2").set_content("Content 2").set_namespace(ns);
        InsertDocumentsBatchParams batch_params;
        batch_params.set_documents({d1, d2});
        auto batch_resp = client.insert_documents_batch(batch_params);
        std::cout << "InsertDocumentsBatch: " << batch_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "InsertDocumentsBatch: " << e.what() << std::endl;
    }

    // --- List Documents ---
    try {
        ListDocumentsParams list_params;
        list_params.set_namespace(ns);
        auto list_resp = client.list_documents(list_params);
        std::cout << "ListDocuments: " << list_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "ListDocuments: " << e.what() << std::endl;
    }

    // --- Interact Memory ---
    try {
        InteractMemoryParams interact_params;
        interact_params.set_namespace(ns).set_entities({"TEST ENTITY"});
        auto interact_resp = client.interact_memory(interact_params);
        std::cout << "InteractMemory: " << interact_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "InteractMemory: " << e.what() << std::endl;
    }

    // --- Record Interactions ---
    try {
        InteractMemoryParams record_params;
        record_params.set_namespace(ns).set_entities({"TEST ENTITY"});
        auto record_resp = client.record_interactions(record_params);
        std::cout << "RecordInteractions: " << record_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "RecordInteractions: " << e.what() << std::endl;
    }

    // --- Recall Thoughts ---
    try {
        RecallThoughtsParams thoughts_params;
        thoughts_params.set_namespace(ns);
        auto thoughts_resp = client.recall_thoughts(thoughts_params);
        std::cout << "RecallThoughts: " << thoughts_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "RecallThoughts (expected): " << e.what() << std::endl;
    }

    // --- Query Memory Context ---
    try {
        QueryMemoryContextParams qmc_params;
        qmc_params.set_query("capital of France").set_namespace(ns);
        auto qmc_resp = client.query_memory_context(qmc_params);
        std::cout << "QueryMemoryContext: " << qmc_resp.dump() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "QueryMemoryContext: " << e.what() << std::endl;
    }

    // --- Delete ---
    try {
        DeleteMemoryParams delete_params;
        delete_params.set_namespace(ns);
        auto delete_resp = client.delete_memory(delete_params);
        std::cout << "Deleted nodes: " << delete_resp.nodes_deleted << std::endl;
    } catch (const std::exception& e) {
        std::cout << "DeleteMemory: " << e.what() << std::endl;
    }
}
