# Recalling Memories

Use recall to fetch the most relevant context for a namespace.

## API Endpoint

`POST /memory/recall`

Some deployments and SDKs use a `/v1` prefix (`/v1/memory/recall`). If your deployment requires it, prepend `/v1`.

## Request Body

```json
{
  "namespace": "preferences",
  "maxChunks": 10
}
```

## Examples by Language

{% tabs %}
{% tab title="cURL" %}
```bash
curl -X POST "https://api.tinyhumans.ai/memory/recall" \
  -H "Authorization: Bearer $ALPHAHUMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "preferences",
    "maxChunks": 10
  }'
```
{% endtab %}

{% tab title="TypeScript" %}
```ts
import { AlphahumanMemoryClient } from "@alphahuman/memory-sdk";

const client = new AlphahumanMemoryClient({ token: process.env.ALPHAHUMAN_TOKEN! });

const result = await client.recallMemory({
  namespace: "preferences",
  maxChunks: 10,
});

console.log(result.data.llmContextMessage);
```
{% endtab %}

{% tab title="Python" %}
```python
import tinyhumansai as api

client = api.TinyHumanMemoryClient(token="YOUR_API_KEY")

ctx = client.recall_memory(
    namespace="preferences",
    prompt="What does the user prefer?",
    num_chunks=10,
)

print(ctx.context)
```
{% endtab %}

{% tab title="Go" %}
```go
ctx, err := client.RecallMemory(
    "preferences",
    "What does the user prefer?",
    &tinyhumans.RecallMemoryOptions{NumChunks: 10},
)
if err != nil {
    log.Fatal(err)
}

fmt.Println(ctx.Context)
```
{% endtab %}

{% tab title="Rust" %}
```rust
use tinyhumansai::{RecallMemoryParams, TinyHumanConfig, TinyHumanMemoryClient};

let client = TinyHumanMemoryClient::new(TinyHumanConfig::new("YOUR_API_KEY"))?;

let response = client
    .recall_memory(RecallMemoryParams {
        namespace: Some("preferences".into()),
        max_chunks: Some(10.0),
    })
    .await?;

println!("{:?}", response.data.llm_context_message);
```
{% endtab %}

{% tab title="Java" %}
```java
import xyz.alphahuman.sdk.*;

try (AlphahumanMemoryClient client = new AlphahumanMemoryClient(System.getenv("ALPHAHUMAN_TOKEN"))) {
    RecallMemoryResponse response = client.recallMemory(
        new RecallMemoryParams()
            .setNamespace("preferences")
            .setMaxChunks(10)
    );

    System.out.println(response.getLlmContextMessage());
}
```
{% endtab %}

{% tab title="C++" %}
```cpp
RecallMemoryParams params;
params
    .set_namespace("preferences")
    .set_max_chunks(10);

auto response = client.recall_memory(params);
if (response.llm_context_message) {
    std::cout << *response.llm_context_message << std::endl;
}
```
{% endtab %}
{% endtabs %}
