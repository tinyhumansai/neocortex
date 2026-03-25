use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use tinyhumansai::{
    BatchDocumentItem, BatchIngestDocumentsParams, ChatMessage, DeleteMemoryParams,
    IngestDocumentParams, InsertMemoryParams, InteractionLevel, MemoryChatParams,
    MemoryConversationParams, MemoryInteractionsParams, MemoryThoughtsParams, QueryMemoriesParams,
    QueryMemoryParams, RecallMemoriesContextParams, RecallMemoriesParams, RecallMemoryParams,
    SourceType, TinyHumanConfig, TinyHumansError, TinyHumansMemoryClient,
};

type CheckResults = Vec<(String, bool, String)>;

fn load_env_file(path: &Path) {
    if !path.exists() {
        return;
    }
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') || !line.contains('=') {
            continue;
        }
        let mut parts = line.splitn(2, '=');
        let key = parts.next().unwrap_or("").trim();
        let mut value = parts.next().unwrap_or("").trim().to_string();
        if (value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\''))
        {
            value = value[1..value.len().saturating_sub(1)].to_string();
        }
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, value);
        }
    }
}

fn env_any(keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| std::env::var(k).ok().filter(|v| !v.is_empty()))
}

fn push_result<T>(
    results: &mut CheckResults,
    name: &str,
    res: Result<T, TinyHumansError>,
    optional: bool,
) -> Option<T> {
    match res {
        Ok(data) => {
            results.push((name.to_string(), true, "ok".to_string()));
            Some(data)
        }
        Err(err) => {
            if optional {
                results.push((name.to_string(), true, format!("optional-skip: {err}")));
                None
            } else {
                results.push((name.to_string(), false, err.to_string()));
                None
            }
        }
    }
}

fn extract_job_id(payload: &serde_json::Value) -> Option<String> {
    if let Some(id) = payload
        .get("data")
        .and_then(|d| d.get("jobId"))
        .and_then(|v| v.as_str())
    {
        return Some(id.to_string());
    }

    payload
        .get("data")
        .and_then(|d| d.get("accepted"))
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|row| {
                row.get("jobId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
        })
}

async fn wait_for_job(
    client: &TinyHumansMemoryClient,
    job_id: &str,
    timeout_secs: u64,
) -> Result<(), TinyHumansError> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        let job = client.ingestion_job_status(job_id).await?;
        let state = job
            .data
            .state
            .as_deref()
            .unwrap_or_default()
            .trim()
            .to_lowercase();

        match state.as_str() {
            "completed" | "done" | "succeeded" | "success" => return Ok(()),
            "failed" | "error" | "cancelled" | "canceled" => {
                return Err(TinyHumansError::Api {
                    message: format!("ingestion job {job_id} failed (state={state})"),
                    status: 500,
                    body: None,
                });
            }
            _ => {}
        }

        if std::time::Instant::now() >= deadline {
            return Err(TinyHumansError::Api {
                message: format!("ingestion job {job_id} timed out"),
                status: 408,
                body: None,
            });
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}

#[tokio::main]
async fn main() {
    let env_file = std::env::var("ENV_FILE").unwrap_or_else(|_| ".env".to_string());
    load_env_file(Path::new(&env_file));

    let token = match env_any(&["TINYHUMANS_TOKEN", "NEOCORTEX_TOKEN"]) {
        Some(v) => v,
        None => {
            eprintln!("Missing token. Set TINYHUMANS_TOKEN or NEOCORTEX_TOKEN.");
            std::process::exit(2);
        }
    };

    let mut cfg = TinyHumanConfig::new(token);
    if let Some(base_url) = env_any(&["TINYHUMANS_BASE_URL", "NEOCORTEX_BASE_URL"]) {
        cfg = cfg.with_base_url(base_url);
    }

    let client = match TinyHumansMemoryClient::new(cfg) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to initialize client: {e}");
            std::process::exit(2);
        }
    };

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let namespace = format!("sdk-rust-routes-{ts}");
    let doc_single = format!("rs-doc-single-{ts}");
    let doc_batch_1 = format!("rs-doc-batch-1-{ts}");
    let doc_batch_2 = format!("rs-doc-batch-2-{ts}");

    let workspace_id = env_any(&["TINYHUMANS_WORKSPACE_ID"]);
    let agent_id = env_any(&["TINYHUMANS_AGENT_ID"]);

    let mut results: CheckResults = Vec::new();
    let mut maybe_job_id: Option<String> = None;

    let insert_memory_res = client
        .insert_memory(InsertMemoryParams {
            title: "Rust Route Test Memory".to_string(),
            content: "rust route test memory".to_string(),
            namespace: namespace.clone(),
            source_type: Some(SourceType::Doc),
            metadata: Some(serde_json::json!({"source": "sdk-rust-route-test"})),
            priority: None,
            created_at: None,
            updated_at: None,
            document_id: format!("{doc_single}-memory"),
        })
        .await;
    let insert_memory_data = push_result(&mut results, "insert_memory", insert_memory_res, false);
    if let Some(data) = insert_memory_data {
        if let Some(job_id) = data.data.job_id {
            maybe_job_id = Some(job_id.clone());
            let _ = push_result(
                &mut results,
                "insert_memory_job_poll",
                wait_for_job(&client, &job_id, 30).await,
                false,
            );
        } else {
            let _ = push_result::<()>(
                &mut results,
                "insert_memory_job_poll",
                Err(TinyHumansError::Api {
                    message: "insert_memory did not return jobId".to_string(),
                    status: 500,
                    body: None,
                }),
                false,
            );
        }
    }

    push_result(
        &mut results,
        "query_memory",
        client
            .query_memory(QueryMemoryParams {
                query: "what memory was stored".to_string(),
                include_references: Some(true),
                namespace: Some(namespace.clone()),
                max_chunks: Some(5.0),
                document_ids: None,
                llm_query: None,
            })
            .await,
        false,
    );

    let single_res = push_result(
        &mut results,
        "ingest_document",
        client
            .ingest_document(IngestDocumentParams {
                title: "Rust Route Test Single".to_string(),
                content: "Single document for route test".to_string(),
                namespace: namespace.clone(),
                source_type: Some(SourceType::Doc),
                metadata: Some(
                    serde_json::json!({"source": "sdk-rust-route-test", "kind": "single"}),
                ),
                priority: None,
                created_at: None,
                updated_at: None,
                document_id: doc_single.clone(),
            })
            .await,
        false,
    );

    if let Some(v) = single_res.as_ref().and_then(extract_job_id) {
        if maybe_job_id.is_none() {
            maybe_job_id = Some(v.clone());
        }
        let _ = push_result(
            &mut results,
            "ingest_document_job_poll",
            wait_for_job(&client, &v, 30).await,
            false,
        );
    }

    let batch_res = push_result(
        &mut results,
        "ingest_documents_batch",
        client
            .ingest_documents_batch(BatchIngestDocumentsParams {
                items: vec![
                    BatchDocumentItem {
                        title: "Rust Route Test Batch 1".to_string(),
                        content: format!("Batch document 1 id={doc_batch_1}"),
                        namespace: namespace.clone(),
                        document_id: doc_batch_1.clone(),
                    },
                    BatchDocumentItem {
                        title: "Rust Route Test Batch 2".to_string(),
                        content: format!("Batch document 2 id={doc_batch_2}"),
                        namespace: namespace.clone(),
                        document_id: doc_batch_2.clone(),
                    },
                ],
            })
            .await,
        false,
    );

    if let Some(v) = batch_res.as_ref().and_then(extract_job_id) {
        if maybe_job_id.is_none() {
            maybe_job_id = Some(v.clone());
        }
        let _ = push_result(
            &mut results,
            "ingest_documents_batch_job_poll",
            wait_for_job(&client, &v, 30).await,
            false,
        );
    }

    push_result(
        &mut results,
        "list_documents",
        client.list_documents().await,
        false,
    );

    let mut get_ok = None;
    for _ in 0..5 {
        let res = client.get_document(&doc_single, Some(&namespace)).await;
        match res {
            Ok(v) => {
                get_ok = Some(v);
                break;
            }
            Err(TinyHumansError::Api { message, .. })
                if message.to_lowercase().contains("not found") =>
            {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
            Err(e) => {
                let _: Option<serde_json::Value> =
                    push_result(&mut results, "get_document", Err(e), false);
                get_ok = None;
                break;
            }
        }
    }
    if let Some(v) = get_ok {
        let _ = push_result(&mut results, "get_document", Ok(v), false);
    } else if !results.iter().any(|(n, _, _)| n == "get_document") {
        let _ = push_result::<serde_json::Value>(
            &mut results,
            "get_document",
            Err(TinyHumansError::Api {
                message: "document not found after retries".to_string(),
                status: 404,
                body: None,
            }),
            false,
        );
    }

    push_result(
        &mut results,
        "query_memories",
        client
            .query_memories(QueryMemoriesParams {
                query: "summarize route test docs".to_string(),
                include_references: Some(true),
                include_references_snake: None,
                namespace: Some(namespace.clone()),
                max_chunks: Some(5.0),
                max_chunks_snake: None,
                document_ids: Some(vec![doc_single.clone()]),
                document_ids_snake: None,
                recall_only: None,
                recall_only_snake: None,
                llm_query: None,
                llm_query_snake: None,
            })
            .await,
        false,
    );

    push_result(
        &mut results,
        "memory_conversation",
        client
            .memory_conversation(MemoryConversationParams {
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Summarize what the route test inserted.".to_string(),
                }],
                temperature: Some(0.0),
                max_tokens: Some(128.0),
                max_tokens_snake: None,
            })
            .await,
        true,
    );

    let interaction = MemoryInteractionsParams {
        namespace: namespace.clone(),
        entity_names: vec!["RS-ROUTE-TEST-A".to_string(), "RS-ROUTE-TEST-B".to_string()],
        entity_names_snake: None,
        description: Some("rust route test interactions".to_string()),
        interaction_level: Some(InteractionLevel::Engage),
        interaction_level_snake: None,
        interaction_levels: None,
        interaction_levels_snake: None,
        timestamp: Some(ts as f64),
    };

    push_result(
        &mut results,
        "record_interactions",
        client.record_interactions(interaction.clone()).await,
        false,
    );

    push_result(
        &mut results,
        "interact_memory",
        client.interact_memory(interaction).await,
        false,
    );

    push_result(
        &mut results,
        "memory_thoughts",
        client
            .memory_thoughts(MemoryThoughtsParams {
                namespace: Some(namespace.clone()),
                max_chunks: Some(5),
                max_chunks_snake: None,
                temperature: Some(0.0),
                randomness_seed: None,
                randomness_seed_snake: None,
                persist: None,
                enable_prediction_check: None,
                enable_prediction_check_snake: None,
                thought_prompt: Some("Reflect on stored docs".to_string()),
                thought_prompt_snake: None,
            })
            .await,
        false,
    );

    push_result(
        &mut results,
        "recall_memory",
        client
            .recall_memory(RecallMemoryParams {
                namespace: Some(namespace.clone()),
                max_chunks: Some(5.0),
            })
            .await,
        false,
    );

    push_result(
        &mut results,
        "recall_memories",
        client
            .recall_memories(RecallMemoriesParams {
                namespace: Some(namespace.clone()),
                top_k: Some(5.0),
                min_retention: Some(0.0),
                as_of: None,
            })
            .await,
        false,
    );

    push_result(
        &mut results,
        "recall_memories_context",
        client
            .recall_memories_context(RecallMemoriesContextParams {
                namespace: Some(namespace.clone()),
                max_chunks: Some(5.0),
                max_chunks_snake: None,
            })
            .await,
        false,
    );

    push_result(
        &mut results,
        "memory_chat",
        client
            .memory_chat(MemoryChatParams {
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Reply with ok".to_string(),
                }],
                temperature: Some(0.0),
                max_tokens: Some(64.0),
            })
            .await,
        true,
    );

    if let Some(job_id) = maybe_job_id.clone() {
        push_result(
            &mut results,
            "ingestion_job_status",
            client.ingestion_job_status(&job_id).await,
            false,
        );
    } else {
        results.push((
            "ingestion_job_status".to_string(),
            true,
            "optional-skip: no jobId returned by ingest routes".to_string(),
        ));
    }

    push_result(
        &mut results,
        "memory_health",
        client.memory_health().await,
        true,
    );

    if let (Some(workspace_id), Some(agent_id)) = (workspace_id, agent_id) {
        push_result(
            &mut results,
            "sync_memory",
            client
                .sync_memory(tinyhumansai::SyncMemoryParams {
                    workspace_id,
                    agent_id,
                    source: Some(tinyhumansai::SyncSource::Startup),
                    files: vec![tinyhumansai::SyncFile {
                        file_path: "route-test.txt".to_string(),
                        content: "rust route test sync".to_string(),
                        timestamp: ts.to_string(),
                        hash: format!("hash-{ts}"),
                    }],
                })
                .await,
            true,
        );
    } else {
        results.push((
            "sync_memory".to_string(),
            true,
            "optional-skip: set TINYHUMANS_WORKSPACE_ID and TINYHUMANS_AGENT_ID".to_string(),
        ));
    }

    push_result(
        &mut results,
        "delete_document(single)",
        client.delete_document(&doc_single, &namespace).await,
        true,
    );

    push_result(
        &mut results,
        "delete_document(batch1)",
        client.delete_document(&doc_batch_1, &namespace).await,
        true,
    );

    push_result(
        &mut results,
        "delete_document(batch2)",
        client.delete_document(&doc_batch_2, &namespace).await,
        true,
    );

    push_result(
        &mut results,
        "delete_memory(namespace)",
        client
            .delete_memory(DeleteMemoryParams {
                namespace: Some(namespace),
            })
            .await,
        true,
    );

    println!("\nRoute smoke test results (sdk-rust):");
    let mut failed = 0usize;
    for (name, ok, msg) in &results {
        let status = if *ok { "PASS" } else { "FAIL" };
        println!("- {status:4} {name}: {msg}");
        if !ok {
            failed += 1;
        }
    }

    if failed > 0 {
        eprintln!("\nFailed checks: {failed}");
        std::process::exit(1);
    }

    println!("\nAll required checks passed: {}", results.len());
}
