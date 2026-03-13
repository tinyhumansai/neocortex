#include "alphahuman/alphahuman.hpp"

#include <chrono>
#include <iostream>
#include <string>
#include <thread>

int main() {
    const char* token = std::getenv("ALPHAHUMAN_TOKEN");
    if (!token) {
        std::cerr << "Set ALPHAHUMAN_TOKEN environment variable" << std::endl;
        return 1;
    }

    using namespace alphahuman;

    AlphahumanMemoryClient client(token);
    std::string ns = "example-cpp";

    // Insert a memory
    std::cout << "--- Insert ---" << std::endl;
    InsertMemoryParams insert_params;
    insert_params.set_title("example-doc")
        .set_content("The speed of light is approximately 299,792 km/s.")
        .set_namespace(ns);
    auto insert_resp = client.insert_memory(insert_params);
    std::cout << "success=" << insert_resp.success << " status=" << insert_resp.status << std::endl;

    std::this_thread::sleep_for(std::chrono::seconds(2));

    // Recall memory
    std::cout << "\n--- Recall ---" << std::endl;
    RecallMemoryParams recall_params;
    recall_params.set_namespace(ns);
    auto recall_resp = client.recall_memory(recall_params);
    std::cout << "success=" << recall_resp.success << " cached=" << recall_resp.cached << std::endl;
    if (recall_resp.llm_context_message) {
        std::cout << "llmContext: " << *recall_resp.llm_context_message << std::endl;
    }

    // Query memory
    std::cout << "\n--- Query ---" << std::endl;
    QueryMemoryParams query_params;
    query_params.set_query("What is the speed of light?").set_namespace(ns);
    auto query_resp = client.query_memory(query_params);
    std::cout << "success=" << query_resp.success << " cached=" << query_resp.cached << std::endl;
    if (query_resp.llm_context_message) {
        std::cout << "llmContext: " << *query_resp.llm_context_message << std::endl;
    }

    // Recall memories (Ebbinghaus)
    std::cout << "\n--- Recall Memories ---" << std::endl;
    RecallMemoriesParams memories_params;
    memories_params.set_namespace(ns);
    auto memories_resp = client.recall_memories(memories_params);
    std::cout << "success=" << memories_resp.success
              << " count=" << memories_resp.memories.size() << std::endl;

    // Delete memory
    std::cout << "\n--- Delete ---" << std::endl;
    DeleteMemoryParams delete_params;
    delete_params.set_namespace(ns);
    auto delete_resp = client.delete_memory(delete_params);
    std::cout << "success=" << delete_resp.success
              << " nodesDeleted=" << delete_resp.nodes_deleted << std::endl;

    return 0;
}
