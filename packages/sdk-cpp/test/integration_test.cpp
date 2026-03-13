#include <gtest/gtest.h>
#include "alphahuman/alphahuman.hpp"

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

using namespace alphahuman;

TEST(IntegrationTest, InsertRecallQueryDeleteLifecycle) {
    const char* token_env = std::getenv("ALPHAHUMAN_TOKEN");
    if (!token_env || token_env[0] == '\0') {
        GTEST_SKIP() << "ALPHAHUMAN_TOKEN not set, skipping integration test";
    }
    std::string token = token_env;

    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    std::string ns = "integration-test-cpp-" + std::to_string(now_ms);

    AlphahumanMemoryClient client(token);

    // --- Insert ---
    long now_s = static_cast<long>(now_ms / 1000);
    InsertMemoryParams insert_params;
    insert_params.set_title("test-key-1")
        .set_content("The capital of France is Paris.")
        .set_namespace(ns)
        .set_metadata(json{{"source", "integration-test"}})
        .set_created_at(now_s)
        .set_updated_at(now_s);
    auto insert_resp = client.insert_memory(insert_params);
    EXPECT_TRUE(insert_resp.success) << "insert should succeed";
    std::cout << "Insert status: " << insert_resp.status << std::endl;

    // Give the backend time to index
    std::this_thread::sleep_for(std::chrono::seconds(2));

    // --- Recall ---
    RecallMemoryParams recall_params;
    recall_params.set_namespace(ns);
    auto recall_resp = client.recall_memory(recall_params);
    EXPECT_TRUE(recall_resp.success) << "recall should succeed";
    std::cout << "Recall cached=" << recall_resp.cached
              << " llmContext=" << recall_resp.llm_context_message.has_value() << std::endl;

    // --- Query ---
    QueryMemoryParams query_params;
    query_params.set_query("What is the capital of France?").set_namespace(ns);
    auto query_resp = client.query_memory(query_params);
    EXPECT_TRUE(query_resp.success) << "query should succeed";
    std::cout << "Query cached=" << query_resp.cached
              << " llmContext=" << query_resp.llm_context_message.has_value() << std::endl;

    // --- Delete ---
    DeleteMemoryParams delete_params;
    delete_params.set_namespace(ns);
    auto delete_resp = client.delete_memory(delete_params);
    EXPECT_TRUE(delete_resp.success) << "delete should succeed";
    std::cout << "Deleted nodes: " << delete_resp.nodes_deleted << std::endl;

    // Give the backend time to process deletion
    std::this_thread::sleep_for(std::chrono::seconds(1));

    // --- Verify deletion ---
    RecallMemoryParams verify_params;
    verify_params.set_namespace(ns);
    auto verify_resp = client.recall_memory(verify_params);
    EXPECT_TRUE(verify_resp.success);
    std::cout << "After delete: context=" << verify_resp.context.has_value()
              << " llmCtx=" << verify_resp.llm_context_message.has_value() << std::endl;
}
