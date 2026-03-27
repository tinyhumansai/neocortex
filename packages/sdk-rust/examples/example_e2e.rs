use std::time::{SystemTime, UNIX_EPOCH};
use tinyhumansai::{
    InsertMemoryParams, ListDocumentsParams, QueryMemoryParams, RecallMemoryParams,
    TinyHumanConfig, TinyHumansError, TinyHumansMemoryClient,
};

const TINYHUMANS_BASE_URL: &str = "https://staging-api.alphahuman.xyz";
const TINYHUMANS_TOKEN: &str = ""; // Add you api key here

fn log_step(title: &str) {
    println!("\n{}", "=".repeat(72));
    println!("[run] {title}");
    println!("{}", "=".repeat(72));
}

fn log_ok(title: &str) {
    println!("[ok] {title}\n");
}

fn require_token() -> Result<String, TinyHumansError> {
    Ok(TINYHUMANS_TOKEN.to_string())
}

async fn step1_insert_memory(
    client: &TinyHumansMemoryClient,
    namespace: &str,
    document_id: &str,
) -> Result<String, TinyHumansError> {
    log_step("step1: insertMemory");
    let insert_memory_res = client
        .insert_memory(InsertMemoryParams {
            title: "Sprint Dataset - Team Velocity".to_string(),
            content: "Sprint snapshot: Team Atlas completed 42 story points with 3 blockers, \
Team Beacon completed 35 story points with 1 blocker, Team Comet completed 48 story points \
with 5 blockers, and Team Delta completed 39 story points with 2 blockers. The highest \
velocity team is Team Comet and the fewest blockers team is Team Beacon."
                .to_string(),
            namespace: namespace.to_string(),
            metadata: Some(serde_json::json!({ "source": "example_e2e.rs" })),
            document_id: document_id.to_string(),
            ..Default::default()
        })
        .await?;

    log_ok("insertMemory");
    println!("insertMemoryRes {insert_memory_res:#?}");

    match insert_memory_res.data.job_id {
        Some(job_id) => Ok(job_id),
        None => Err(TinyHumansError::Api {
            message: "insertMemory response did not include jobId".to_string(),
            status: 500,
            body: None,
        }),
    }
}

async fn step2_check_ingestion_job(
    client: &TinyHumansMemoryClient,
    insert_job_id: &str,
) -> Result<(), TinyHumansError> {
    log_step("step2: getIngestionJob");
    let get_ingestion_job_res = client.get_ingestion_job(insert_job_id).await?;
    log_ok("getIngestionJob");
    println!("getIngestionJobRes {get_ingestion_job_res:#?}");

    let state = get_ingestion_job_res
        .data
        .state
        .unwrap_or_default()
        .to_lowercase();
    if state == "completed" || state == "done" || state == "success" || state == "succeeded" {
        println!("[skip] waitForIngestionJob: job is already completed");
        return Ok(());
    }

    log_step("step2b: waitForIngestionJob");
    let wait_for_ingestion_job_res = client
        .wait_for_ingestion_job(insert_job_id, Some(30_000), Some(1_000))
        .await?;
    log_ok("waitForIngestionJob");
    println!("waitForIngestionJobRes {wait_for_ingestion_job_res:#?}");
    Ok(())
}

async fn step3_list_documents(
    client: &TinyHumansMemoryClient,
    namespace: &str,
) -> Result<(), TinyHumansError> {
    log_step("step3: listDocuments");
    let list_documents_res = client
        .list_documents(ListDocumentsParams {
            namespace: Some(namespace.to_string()),
            limit: Some(10.0),
            offset: Some(0.0),
        })
        .await?;
    log_ok("listDocuments");
    println!("listDocumentsRes {list_documents_res:#?}");
    Ok(())
}

async fn step4_get_document(
    client: &TinyHumansMemoryClient,
    namespace: &str,
    document_id: &str,
) -> Result<(), TinyHumansError> {
    log_step("step4: getDocument");
    let get_document_res = client.get_document(document_id, Some(namespace)).await?;
    log_ok("getDocument");
    println!("getDocumentRes {get_document_res:#?}");
    Ok(())
}

// This route may require additional permissions depending on environment.
async fn step5_query_memory(
    client: &TinyHumansMemoryClient,
    namespace: &str,
) -> Result<(), TinyHumansError> {
    log_step("step5: queryMemory");
    let query_memory_res = client
        .query_memory(QueryMemoryParams {
            query: "Which team has the highest velocity and which team has the fewest blockers?"
                .to_string(),
            namespace: Some(namespace.to_string()),
            include_references: Some(true),
            max_chunks: Some(5.0),
            ..Default::default()
        })
        .await?;
    log_ok("queryMemory");
    println!("queryMemoryRes {query_memory_res:#?}");
    Ok(())
}

async fn step6_recall_memory_context(
    client: &TinyHumansMemoryClient,
    namespace: &str,
) -> Result<(), TinyHumansError> {
    log_step("step6: recallMemoryContext");
    let recall_memory_context_res = client
        .recall_memory(RecallMemoryParams {
            namespace: Some(namespace.to_string()),
            max_chunks: Some(5.0),
        })
        .await?;
    log_ok("recallMemoryContext");
    println!("recallMemoryContextRes {recall_memory_context_res:#?}");
    Ok(())
}

#[tokio::main]
async fn main() {
    let token = match require_token() {
        Ok(token) => token,
        Err(err) => {
            eprintln!("E2E Rust SDK example failed.");
            eprintln!("{err}");
            std::process::exit(1);
        }
    };

    let mut config = TinyHumanConfig::new(token);

    config = config.with_base_url(TINYHUMANS_BASE_URL.to_string());

    let client = match TinyHumansMemoryClient::new(config) {
        Ok(client) => client,
        Err(err) => {
            eprintln!("E2E Rust SDK example failed.");
            eprintln!("{err}");
            std::process::exit(1);
        }
    };

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let namespace = "sdk-rust-e2e".to_string();
    let single_doc_id = format!("sdk-rust-e2e-doc-single-{ts}");

    let result = async {
        let insert_job_id = step1_insert_memory(&client, &namespace, &single_doc_id).await?;
        step2_check_ingestion_job(&client, &insert_job_id).await?;
        step3_list_documents(&client, &namespace).await?;
        step4_get_document(&client, &namespace, &single_doc_id).await?;

        if let Err(err) = step5_query_memory(&client, &namespace).await {
            eprintln!("[warn] step5 queryMemory skipped: {err}");
        }
        step6_recall_memory_context(&client, &namespace).await?;

        println!("\nE2E Rust SDK example completed.");
        Ok::<(), TinyHumansError>(())
    }
    .await;

    if let Err(err) = result {
        eprintln!("\nE2E Rust SDK example failed.");
        eprintln!("{err}");
        std::process::exit(1);
    }
}
