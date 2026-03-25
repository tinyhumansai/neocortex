//! Integration tests for TinyHumansMemoryClient using mockito.

use mockito::Server;
use tinyhumansai::{
    ChatMessage, DeleteMemoryParams, InsertMemoryParams, MemoryChatParams, QueryMemoryParams,
    RecallMemoriesParams, RecallMemoryParams, TinyHumanConfig, TinyHumansError,
    TinyHumansMemoryClient,
};

#[tokio::test]
async fn client_requires_token() {
    assert!(TinyHumansMemoryClient::new(TinyHumanConfig::new("")).is_err());
    assert!(TinyHumansMemoryClient::new(TinyHumanConfig::new("   ")).is_err());
}

#[tokio::test]
async fn insert_memory_validates_required() {
    let server = Server::new_async().await;
    let url = server.url();
    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(url)).unwrap();

    let empty_title = InsertMemoryParams {
        title: String::new(),
        content: "c".into(),
        namespace: "ns".into(),
        ..Default::default()
    };
    assert!(client.insert_memory(empty_title).await.is_err());

    let empty_ns = InsertMemoryParams {
        title: "t".into(),
        content: "c".into(),
        namespace: String::new(),
        ..Default::default()
    };
    assert!(client.insert_memory(empty_ns).await.is_err());

    let empty_doc_id = InsertMemoryParams {
        title: "t".into(),
        content: "c".into(),
        namespace: "ns".into(),
        document_id: String::new(),
        ..Default::default()
    };
    assert!(client.insert_memory(empty_doc_id).await.is_err());
}

#[tokio::test]
async fn insert_memory_posts_correctly() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("POST", "/memory/insert")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"success":true,"data":{"status":"ok","stats":{}}}"#)
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("test-token").with_base_url(server.url()))
            .unwrap();

    let params = InsertMemoryParams {
        title: "Doc".into(),
        content: "Content".into(),
        namespace: "default".into(),
        document_id: "doc-1".into(),
        ..Default::default()
    };
    let res = client.insert_memory(params).await.unwrap();
    assert!(res.success);
    assert_eq!(res.data.status.as_deref(), Some("ok"));
    mock.assert_async().await;
}

#[tokio::test]
async fn query_memory_validates_query() {
    let server = Server::new_async().await;
    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let params = QueryMemoryParams {
        query: String::new(),
        ..Default::default()
    };
    assert!(client.query_memory(params).await.is_err());
}

#[tokio::test]
async fn query_memory_validates_max_chunks() {
    let server = Server::new_async().await;
    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let p0 = QueryMemoryParams {
        query: "q".into(),
        max_chunks: Some(0.0),
        ..Default::default()
    };
    assert!(client.query_memory(p0).await.is_err());
    let pneg = QueryMemoryParams {
        query: "q".into(),
        max_chunks: Some(-1.0),
        ..Default::default()
    };
    assert!(client.query_memory(pneg).await.is_err());
}

#[tokio::test]
async fn delete_memory_posts_correctly() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("POST", "/memory/admin/delete")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"success":true,"data":{"status":"ok","userId":"u1","nodesDeleted":5,"message":"Done"}}"#)
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let res = client
        .delete_memory(DeleteMemoryParams {
            namespace: Some("ns".into()),
        })
        .await
        .unwrap();
    assert!(res.success);
    assert_eq!(res.data.nodes_deleted, 5);
    mock.assert_async().await;
}

#[tokio::test]
async fn recall_memory_posts_correctly() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("POST", "/memory/recall")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"success":true,"data":{"cached":false,"response":"context"}}"#)
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let res = client
        .recall_memory(RecallMemoryParams {
            namespace: Some("ns".into()),
            max_chunks: Some(10.0),
        })
        .await
        .unwrap();
    assert!(res.success);
    assert_eq!(res.data.response.as_deref(), Some("context"));
    mock.assert_async().await;
}

#[tokio::test]
async fn recall_memories_posts_correctly() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("POST", "/memory/memories/recall")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"success":true,"data":{"memories":[]}}"#)
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let res = client
        .recall_memories(RecallMemoriesParams {
            namespace: Some("ns".into()),
            top_k: Some(5.0),
            ..Default::default()
        })
        .await
        .unwrap();
    assert!(res.success);
    assert!(res.data.memories.is_empty());
    mock.assert_async().await;
}

#[tokio::test]
async fn api_error_returns_tinyhumans_error() {
    let mut server = Server::new_async().await;
    server
        .mock("POST", "/memory/insert")
        .with_status(400)
        .with_header("content-type", "application/json")
        .with_body(r#"{"success":false,"error":"Bad request"}"#)
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let params = InsertMemoryParams {
        title: "T".into(),
        content: "C".into(),
        namespace: "ns".into(),
        document_id: "doc-1".into(),
        ..Default::default()
    };
    let err = client.insert_memory(params).await.unwrap_err();
    match &err {
        TinyHumansError::Api {
            message, status, ..
        } => {
            assert_eq!(*status, 400);
            assert!(message.contains("Bad request"));
        }
        _ => panic!("expected Api error, got {:?}", err),
    }
}

#[tokio::test]
async fn memory_chat_posts_correctly() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("POST", "/memory/chat")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"success":true,"data":{"content":"hello","usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4},"model":"gpt-test"}}"#,
        )
        .create_async()
        .await;

    let client =
        TinyHumansMemoryClient::new(TinyHumanConfig::new("token").with_base_url(server.url()))
            .unwrap();
    let res = client
        .memory_chat(MemoryChatParams {
            messages: vec![ChatMessage {
                role: "user".into(),
                content: "hello".into(),
            }],
            ..Default::default()
        })
        .await
        .unwrap();

    assert!(res.success);
    assert_eq!(res.data.content.as_deref(), Some("hello"));
    mock.assert_async().await;
}
