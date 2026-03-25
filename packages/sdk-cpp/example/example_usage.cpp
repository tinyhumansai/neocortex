#include "tinyhumans/tinyhumans.hpp"

#include <chrono>
#include <iostream>
#include <string>
#include <thread>

int main() {
    const char* token = std::getenv("TINYHUMANS_TOKEN");
    if (!token) {
        std::cerr << "Set TINYHUMANS_TOKEN environment variable" << std::endl;
        return 1;
    }

    using namespace tinyhumans;

    TinyHumansMemoryClient client(token);
    std::string ns = "example-cpp-" + std::to_string(
        std::chrono::system_clock::now().time_since_epoch().count());

    try {
        // 1. Insert Memory
        std::cout << "=== Insert Memory ===" << std::endl;
        InsertMemoryParams insert_params;
        insert_params.set_title("example-doc")
            .set_content("The speed of light is approximately 299,792 km/s.")
            .set_namespace(ns)
            .set_document_id("cpp-example-001")
            .set_metadata(json{{"lang", "cpp"}});
        auto insert_resp = client.insert_memory(insert_params);
        std::cout << "success=" << insert_resp.success << " status=" << insert_resp.status << std::endl;

        std::this_thread::sleep_for(std::chrono::seconds(2));

        // 2. Recall Memory (Master)
        std::cout << "\n=== Recall Memory ===" << std::endl;
        RecallMemoryParams recall_params;
        recall_params.set_namespace(ns);
        auto recall_resp = client.recall_memory(recall_params);
        std::cout << "success=" << recall_resp.success << " cached=" << recall_resp.cached << std::endl;

        // 3. Query Memory
        std::cout << "\n=== Query Memory ===" << std::endl;
        try {
            QueryMemoryParams query_params;
            query_params.set_query("What is the speed of light?").set_namespace(ns);
            auto query_resp = client.query_memory(query_params);
            std::cout << "success=" << query_resp.success << " cached=" << query_resp.cached << std::endl;
        } catch (const std::exception& e) {
            std::cout << "QueryMemory: " << e.what() << std::endl;
        }

        // 4. Query Memory Context
        std::cout << "\n=== Query Memory Context ===" << std::endl;
        try {
            QueryMemoryContextParams qmc_params;
            qmc_params.set_query("speed of light").set_namespace(ns);
            auto qmc_resp = client.query_memory_context(qmc_params);
            std::cout << "QueryMemoryContext: " << qmc_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "QueryMemoryContext: " << e.what() << std::endl;
        }

        // 5. Recall Memories (Ebbinghaus)
        std::cout << "\n=== Recall Memories ===" << std::endl;
        RecallMemoriesParams memories_params;
        memories_params.set_namespace(ns).set_top_k(5);
        auto memories_resp = client.recall_memories(memories_params);
        std::cout << "success=" << memories_resp.success
                  << " count=" << memories_resp.memories.size() << std::endl;

        // 6. Recall Thoughts
        std::cout << "\n=== Recall Thoughts ===" << std::endl;
        try {
            RecallThoughtsParams thoughts_params;
            thoughts_params.set_namespace(ns);
            auto thoughts_resp = client.recall_thoughts(thoughts_params);
            std::cout << "RecallThoughts: " << thoughts_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "RecallThoughts: " << e.what() << std::endl;
        }

        // 7. Interact Memory
        std::cout << "\n=== Interact Memory ===" << std::endl;
        try {
            InteractMemoryParams interact_params;
            interact_params.set_namespace(ns).set_entities({"CPP SDK"});
            auto interact_resp = client.interact_memory(interact_params);
            std::cout << "InteractMemory: " << interact_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "InteractMemory: " << e.what() << std::endl;
        }

        // 8. Record Interactions
        std::cout << "\n=== Record Interactions ===" << std::endl;
        try {
            InteractMemoryParams record_params;
            record_params.set_namespace(ns).set_entities({"CPP SDK"});
            auto record_resp = client.record_interactions(record_params);
            std::cout << "RecordInteractions: " << record_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "RecordInteractions: " << e.what() << std::endl;
        }

        // 9. Insert Document
        std::cout << "\n=== Insert Document ===" << std::endl;
        try {
            InsertDocumentParams doc_params;
            doc_params.set_title("CPP Guide").set_content("C++ SDK usage guide").set_namespace(ns);
            auto doc_resp = client.insert_document(doc_params);
            std::cout << "InsertDocument: " << doc_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "InsertDocument: " << e.what() << std::endl;
        }

        // 10. Insert Documents Batch
        std::cout << "\n=== Insert Documents Batch ===" << std::endl;
        try {
            InsertDocumentParams d1, d2;
            d1.set_title("Doc 1").set_content("Content 1").set_namespace(ns);
            d2.set_title("Doc 2").set_content("Content 2").set_namespace(ns);
            InsertDocumentsBatchParams batch_params;
            batch_params.set_documents({d1, d2});
            auto batch_resp = client.insert_documents_batch(batch_params);
            std::cout << "InsertDocumentsBatch: " << batch_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "InsertDocumentsBatch: " << e.what() << std::endl;
        }

        // 11. List Documents
        std::cout << "\n=== List Documents ===" << std::endl;
        try {
            ListDocumentsParams list_params;
            list_params.set_namespace(ns);
            auto list_resp = client.list_documents(list_params);
            std::cout << "ListDocuments: " << list_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "ListDocuments: " << e.what() << std::endl;
        }

        // 12. Chat Memory
        std::cout << "\n=== Chat Memory ===" << std::endl;
        try {
            ChatMemoryParams chat_params;
            chat_params.set_messages({json{{"role", "user"}, {"content", "Hello!"}}});
            auto chat_resp = client.chat_memory(chat_params);
            std::cout << "ChatMemory: " << chat_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "ChatMemory: " << e.what() << std::endl;
        }

        // 13. Chat Memory Context
        std::cout << "\n=== Chat Memory Context ===" << std::endl;
        try {
            ChatMemoryParams chat_ctx_params;
            chat_ctx_params.set_messages({json{{"role", "user"}, {"content", "Hello!"}}});
            auto chat_ctx_resp = client.chat_memory_context(chat_ctx_params);
            std::cout << "ChatMemoryContext: " << chat_ctx_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "ChatMemoryContext: " << e.what() << std::endl;
        }

        // 14. Get Graph Snapshot
        std::cout << "\n=== Get Graph Snapshot ===" << std::endl;
        try {
            GraphSnapshotParams graph_params;
            graph_params.set_namespace(ns);
            auto graph_resp = client.get_graph_snapshot(graph_params);
            std::cout << "GetGraphSnapshot: " << graph_resp.dump(2) << std::endl;
        } catch (const std::exception& e) {
            std::cout << "GetGraphSnapshot: " << e.what() << std::endl;
        }

        // 15. Delete Memory
        std::cout << "\n=== Delete Memory ===" << std::endl;
        try {
            DeleteMemoryParams delete_params;
            delete_params.set_namespace(ns);
            auto delete_resp = client.delete_memory(delete_params);
            std::cout << "success=" << delete_resp.success
                      << " nodesDeleted=" << delete_resp.nodes_deleted << std::endl;
        } catch (const std::exception& e) {
            std::cout << "DeleteMemory: " << e.what() << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
