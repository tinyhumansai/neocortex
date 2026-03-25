#include <gtest/gtest.h>
#include "tinyhumans/tinyhumans.hpp"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstring>
#include <future>
#include <sstream>
#include <string>

using namespace tinyhumans;

// ---- MockHttpServer ----
// Minimal single-connection HTTP server for unit testing.
// Binds to port 0 (OS-assigned), accepts one connection per handle_request_async() call.

class MockHttpServer {
public:
    MockHttpServer() {
        server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        EXPECT_NE(server_fd_, -1);

        int opt = 1;
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = 0;

        EXPECT_EQ(bind(server_fd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)), 0);
        EXPECT_EQ(listen(server_fd_, 1), 0);

        socklen_t len = sizeof(addr);
        getsockname(server_fd_, reinterpret_cast<sockaddr*>(&addr), &len);
        port_ = ntohs(addr.sin_port);
    }

    ~MockHttpServer() {
        if (server_fd_ >= 0) close(server_fd_);
    }

    int port() const { return port_; }
    std::string base_url() const { return "http://127.0.0.1:" + std::to_string(port_); }

    void set_response(int status, const std::string& body) {
        response_status_ = status;
        response_body_ = body;
    }

    // Accept one connection in background, return future with the request body received.
    std::future<std::string> handle_request_async() {
        return std::async(std::launch::async, [this]() -> std::string {
            int client_fd = accept(server_fd_, nullptr, nullptr);
            if (client_fd < 0) return "";

            // Read full request
            std::string request;
            char buf[4096];
            while (true) {
                ssize_t n = read(client_fd, buf, sizeof(buf));
                if (n <= 0) break;
                request.append(buf, n);
                // Check if we've received the full request (headers + body)
                auto header_end = request.find("\r\n\r\n");
                if (header_end != std::string::npos) {
                    // Find Content-Length
                    std::string lower_req = request;
                    for (auto& c : lower_req) c = std::tolower(c);
                    auto cl_pos = lower_req.find("content-length:");
                    if (cl_pos != std::string::npos) {
                        int content_length = std::stoi(request.substr(cl_pos + 15));
                        size_t body_start = header_end + 4;
                        if (request.size() >= body_start + content_length) break;
                    } else {
                        break;
                    }
                }
            }

            // Extract request body
            std::string body;
            auto header_end = request.find("\r\n\r\n");
            if (header_end != std::string::npos) {
                body = request.substr(header_end + 4);
            }

            // Store full request for header checks
            last_request_ = request;

            // Send response
            std::ostringstream resp;
            resp << "HTTP/1.1 " << response_status_ << " OK\r\n"
                 << "Content-Type: application/json\r\n"
                 << "Content-Length: " << response_body_.size() << "\r\n"
                 << "\r\n"
                 << response_body_;
            std::string resp_str = resp.str();
            write(client_fd, resp_str.c_str(), resp_str.size());
            close(client_fd);

            return body;
        });
    }

    const std::string& last_request() const { return last_request_; }

    std::string last_method() const {
        auto end = last_request_.find(' ');
        if (end == std::string::npos) return "";
        return last_request_.substr(0, end);
    }

    std::string last_path() const {
        auto start = last_request_.find(' ');
        if (start == std::string::npos) return "";
        start++;
        auto end = last_request_.find(' ', start);
        if (end == std::string::npos) return "";
        return last_request_.substr(start, end - start);
    }

private:
    int server_fd_ = -1;
    int port_ = 0;
    int response_status_ = 200;
    std::string response_body_;
    std::string last_request_;
};

// ---- Constructor tests ----

TEST(MemoryClientTest, ConstructorRejectsEmptyToken) {
    EXPECT_THROW(TinyHumansMemoryClient(""), std::invalid_argument);
}

TEST(MemoryClientTest, ConstructorRejectsWhitespaceToken) {
    EXPECT_THROW(TinyHumansMemoryClient("   "), std::invalid_argument);
}

TEST(MemoryClientTest, ConstructorAcceptsValidToken) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    // No throw = success
}

// ---- MockHttpServer helpers ----

TEST(MemoryClientTest, MockServerParsesMethodAndPath) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"status":"completed","stats":{"chunks":1}}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_title("t").set_content("c").set_namespace("n").set_document_id("doc-1");
    client.insert_memory(params);
    future.get();

    EXPECT_EQ(server.last_method(), "POST");
    EXPECT_EQ(server.last_path(), "/memory/insert");
}

// ---- Model ID ----

TEST(MemoryClientTest, DefaultModelIdSendsHeader) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"cached":false}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    client.recall_memory();
    future.get();

    const auto& req = server.last_request();
    EXPECT_TRUE(req.find("X-Model-Id: neocortex-mk1") != std::string::npos);
}

TEST(MemoryClientTest, CustomModelIdSendsHeader) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"cached":false}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", "custom-model", server.base_url());
    client.recall_memory();
    future.get();

    const auto& req = server.last_request();
    EXPECT_TRUE(req.find("X-Model-Id: custom-model") != std::string::npos);
}

// ---- insertMemory ----

TEST(MemoryClientTest, InsertMemorySendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"status":"completed","stats":{"chunks":1}}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_title("title").set_content("content").set_namespace("ns").set_document_id("doc-1");
    auto resp = client.insert_memory(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"title\"") != std::string::npos);
    EXPECT_TRUE(body.find("\"content\"") != std::string::npos);
    EXPECT_TRUE(body.find("\"namespace\"") != std::string::npos);

    // Check headers
    const auto& req = server.last_request();
    EXPECT_TRUE(req.find("POST") != std::string::npos);
    EXPECT_TRUE(req.find("Content-Type: application/json") != std::string::npos);
    EXPECT_TRUE(req.find("Authorization: Bearer test-token") != std::string::npos);
    EXPECT_TRUE(req.find("/memory/insert") != std::string::npos);

    EXPECT_TRUE(resp.success);
    EXPECT_EQ(resp.status, "completed");
}

TEST(MemoryClientTest, InsertMemoryValidatesMissingTitle) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_content("content").set_namespace("ns");
    EXPECT_THROW(client.insert_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, InsertMemoryValidatesMissingContent) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_title("title").set_namespace("ns");
    EXPECT_THROW(client.insert_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, InsertMemoryValidatesMissingNamespace) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_title("title").set_content("content");
    EXPECT_THROW(client.insert_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, InsertMemoryValidatesMissingDocumentId) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertMemoryParams params;
    params.set_title("title").set_content("content").set_namespace("ns");
    EXPECT_THROW(client.insert_memory(params), std::invalid_argument);
}

// ---- recallMemory ----

TEST(MemoryClientTest, RecallMemoryParsesResponse) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"cached":false,"llmContextMessage":"ctx","counts":{"numEntities":1}}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    auto resp = client.recall_memory();
    future.get();

    EXPECT_TRUE(resp.success);
    EXPECT_FALSE(resp.cached);
    EXPECT_EQ(resp.llm_context_message.value(), "ctx");
}

TEST(MemoryClientTest, RecallMemoryValidatesMaxChunks) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());

    RecallMemoryParams params;
    params.set_max_chunks(0);
    EXPECT_THROW(client.recall_memory(params), std::invalid_argument);

    RecallMemoryParams params2;
    params2.set_max_chunks(-1);
    EXPECT_THROW(client.recall_memory(params2), std::invalid_argument);
}

// ---- deleteMemory ----

TEST(MemoryClientTest, DeleteMemoryParsesResponse) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"nodesDeleted":5,"status":"done","message":"ok"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    DeleteMemoryParams params;
    params.set_namespace("test");
    auto resp = client.delete_memory(params);
    future.get();

    EXPECT_TRUE(resp.success);
    EXPECT_EQ(resp.nodes_deleted, 5);
    EXPECT_EQ(resp.status, "done");
    EXPECT_EQ(resp.message, "ok");
}

// ---- queryMemory ----

TEST(MemoryClientTest, QueryMemoryParsesResponse) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"cached":true,"llmContextMessage":"answer"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    QueryMemoryParams params;
    params.set_query("what?");
    auto resp = client.query_memory(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"query\"") != std::string::npos);

    EXPECT_TRUE(resp.success);
    EXPECT_TRUE(resp.cached);
    EXPECT_EQ(resp.llm_context_message.value(), "answer");
}

TEST(MemoryClientTest, QueryMemoryValidatesMissingQuery) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    QueryMemoryParams params;
    EXPECT_THROW(client.query_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, QueryMemoryValidatesMaxChunksRange) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());

    QueryMemoryParams p1;
    p1.set_query("q").set_max_chunks(0);
    EXPECT_THROW(client.query_memory(p1), std::invalid_argument);

    QueryMemoryParams p2;
    p2.set_query("q").set_max_chunks(201);
    EXPECT_THROW(client.query_memory(p2), std::invalid_argument);
}

// ---- recallMemories ----

TEST(MemoryClientTest, RecallMemoriesParsesResponse) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"memories":[{"id":"1","content":"hi"}]}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    auto resp = client.recall_memories();
    future.get();

    EXPECT_TRUE(resp.success);
    EXPECT_EQ(resp.memories.size(), 1u);
    EXPECT_EQ(resp.memories[0]["id"], "1");
}

TEST(MemoryClientTest, RecallMemoriesValidatesTopK) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());

    RecallMemoriesParams p1;
    p1.set_top_k(0);
    EXPECT_THROW(client.recall_memories(p1), std::invalid_argument);

    RecallMemoriesParams p2;
    p2.set_top_k(-1);
    EXPECT_THROW(client.recall_memories(p2), std::invalid_argument);
}

TEST(MemoryClientTest, RecallMemoriesValidatesMinRetention) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());

    RecallMemoriesParams p;
    p.set_min_retention(-0.1);
    EXPECT_THROW(client.recall_memories(p), std::invalid_argument);
}

// ---- chatMemory ----

TEST(MemoryClientTest, ChatMemorySendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"response":"hello"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    ChatMemoryParams params;
    params.set_messages({json{{"role", "user"}, {"content", "Hi"}}});
    auto resp = client.chat_memory(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"messages\"") != std::string::npos);
    EXPECT_EQ(server.last_method(), "POST");
    EXPECT_EQ(server.last_path(), "/memory/chat");
}

TEST(MemoryClientTest, ChatMemoryValidatesEmptyMessages) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    ChatMemoryParams params;
    EXPECT_THROW(client.chat_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, ChatMemoryContextSendsCorrectPath) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    ChatMemoryParams params;
    params.set_messages({json{{"role", "user"}, {"content", "Hi"}}});
    client.chat_memory_context(params);
    future.get();

    EXPECT_EQ(server.last_path(), "/memory/conversations");
}

// ---- interactMemory ----

TEST(MemoryClientTest, InteractMemorySendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InteractMemoryParams params;
    params.set_namespace("ns").set_entities({"ENTITY1", "ENTITY2"});
    client.interact_memory(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"entityNames\"") != std::string::npos);
    EXPECT_EQ(server.last_path(), "/memory/interact");
}

TEST(MemoryClientTest, InteractMemoryValidatesMissingNamespace) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InteractMemoryParams params;
    params.set_entities({"E"});
    EXPECT_THROW(client.interact_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, InteractMemoryValidatesMissingEntities) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InteractMemoryParams params;
    params.set_namespace("ns");
    EXPECT_THROW(client.interact_memory(params), std::invalid_argument);
}

TEST(MemoryClientTest, RecordInteractionsSendsCorrectPath) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InteractMemoryParams params;
    params.set_namespace("ns").set_entities({"E"});
    client.record_interactions(params);
    future.get();

    EXPECT_EQ(server.last_path(), "/memory/interactions");
}

// ---- recallThoughts ----

TEST(MemoryClientTest, RecallThoughtsSendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"thoughts":[]}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    RecallThoughtsParams params;
    params.set_namespace("ns");
    client.recall_thoughts(params);
    future.get();

    EXPECT_EQ(server.last_path(), "/memory/memories/thoughts");
}

// ---- queryMemoryContext ----

TEST(MemoryClientTest, QueryMemoryContextSendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    QueryMemoryContextParams params;
    params.set_query("test query").set_namespace("ns");
    client.query_memory_context(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"query\"") != std::string::npos);
    EXPECT_EQ(server.last_path(), "/memory/queries");
}

TEST(MemoryClientTest, QueryMemoryContextValidatesMissingQuery) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    QueryMemoryContextParams params;
    EXPECT_THROW(client.query_memory_context(params), std::invalid_argument);
}

// ---- insertDocument ----

TEST(MemoryClientTest, InsertDocumentSendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"id":"doc-1"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertDocumentParams params;
    params.set_title("Doc").set_content("Content").set_namespace("ns");
    client.insert_document(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"title\"") != std::string::npos);
    EXPECT_EQ(server.last_path(), "/memory/documents");
    EXPECT_EQ(server.last_method(), "POST");
}

TEST(MemoryClientTest, InsertDocumentValidates) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertDocumentParams params;
    EXPECT_THROW(client.insert_document(params), std::invalid_argument);
}

// ---- insertDocumentsBatch ----

TEST(MemoryClientTest, InsertDocumentsBatchSendsCorrectRequest) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    InsertDocumentParams doc1;
    doc1.set_title("D1").set_content("C1").set_namespace("ns");
    InsertDocumentParams doc2;
    doc2.set_title("D2").set_content("C2").set_namespace("ns");
    InsertDocumentsBatchParams params;
    params.set_documents({doc1, doc2});
    client.insert_documents_batch(params);

    std::string body = future.get();
    EXPECT_TRUE(body.find("\"items\"") != std::string::npos);
    EXPECT_EQ(server.last_path(), "/memory/documents/batch");
}

// ---- listDocuments ----

TEST(MemoryClientTest, ListDocumentsSendsGetWithQueryParams) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"documents":[]}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    ListDocumentsParams params;
    params.set_namespace("ns");
    client.list_documents(params);
    future.get();

    EXPECT_EQ(server.last_method(), "GET");
    EXPECT_TRUE(server.last_path().find("/memory/documents") != std::string::npos);
    EXPECT_TRUE(server.last_path().find("namespace=ns") != std::string::npos);
}

// ---- getDocument ----

TEST(MemoryClientTest, GetDocumentSendsGetWithId) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"id":"doc-1"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    GetDocumentParams params;
    params.set_id("doc-1").set_namespace("ns");
    client.get_document(params);
    future.get();

    EXPECT_EQ(server.last_method(), "GET");
    EXPECT_TRUE(server.last_path().find("/memory/documents/doc-1") != std::string::npos);
}

TEST(MemoryClientTest, GetDocumentValidatesMissingId) {
    MockHttpServer server;
    TinyHumansMemoryClient client("test-token", server.base_url());
    GetDocumentParams params;
    EXPECT_THROW(client.get_document(params), std::invalid_argument);
}

// ---- deleteDocument ----

TEST(MemoryClientTest, DeleteDocumentSendsDeleteMethod) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    client.delete_document("doc-1", "ns");
    future.get();

    EXPECT_EQ(server.last_method(), "DELETE");
    EXPECT_TRUE(server.last_path().find("/memory/documents/doc-1") != std::string::npos);
}

// ---- getGraphSnapshot ----

TEST(MemoryClientTest, GetGraphSnapshotSendsGet) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    GraphSnapshotParams params;
    params.set_namespace("ns");
    client.get_graph_snapshot(params);
    future.get();

    EXPECT_EQ(server.last_method(), "GET");
    EXPECT_TRUE(server.last_path().find("/memory/admin/graph-snapshot") != std::string::npos);
}

// ---- getIngestionJob ----

TEST(MemoryClientTest, GetIngestionJobSendsGet) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"status":"completed"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    client.get_ingestion_job("job-123");
    future.get();

    EXPECT_EQ(server.last_method(), "GET");
    EXPECT_TRUE(server.last_path().find("/memory/ingestion/jobs/job-123") != std::string::npos);
}

// ---- waitForIngestionJob ----

TEST(MemoryClientTest, WaitForIngestionJobReturnsOnCompleted) {
    MockHttpServer server;
    server.set_response(200, R"({"success":true,"data":{"status":"completed"}})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    WaitForIngestionJobOptions opts;
    opts.set_interval_ms(10).set_max_attempts(1);
    auto result = client.wait_for_ingestion_job("job-123", opts);
    future.get();

    EXPECT_TRUE(result.contains("success"));
}

// ---- Error handling ----

TEST(MemoryClientTest, NonOkStatusThrowsTinyHumansError) {
    MockHttpServer server;
    server.set_response(401, R"({"error":"unauthorized"})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    try {
        client.recall_memory();
        FAIL() << "Expected TinyHumansError";
    } catch (const TinyHumansError& err) {
        EXPECT_EQ(err.status(), 401);
        EXPECT_EQ(std::string(err.what()), "unauthorized");
    }
    future.get();
}

TEST(MemoryClientTest, NonJsonResponseThrowsTinyHumansError) {
    MockHttpServer server;
    server.set_response(200, "not json");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    try {
        client.recall_memory();
        FAIL() << "Expected TinyHumansError";
    } catch (const TinyHumansError& err) {
        EXPECT_EQ(err.status(), 200);
        EXPECT_TRUE(std::string(err.what()).find("non-JSON") != std::string::npos);
    }
    future.get();
}

TEST(MemoryClientTest, ServerErrorThrowsWithHttpStatus) {
    MockHttpServer server;
    server.set_response(500, R"({"success":false})");
    auto future = server.handle_request_async();

    TinyHumansMemoryClient client("test-token", server.base_url());
    try {
        InsertMemoryParams params;
        params.set_title("t").set_content("c").set_namespace("n").set_document_id("doc-1");
        client.insert_memory(params);
        FAIL() << "Expected TinyHumansError";
    } catch (const TinyHumansError& err) {
        EXPECT_EQ(err.status(), 500);
        EXPECT_TRUE(std::string(err.what()).find("500") != std::string::npos);
    }
    future.get();
}
