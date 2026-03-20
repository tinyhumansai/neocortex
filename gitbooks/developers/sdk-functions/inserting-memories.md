# Inserting Memories

Use this operation to upsert memory into a namespace.

## API Endpoint

`POST /memory/insert`

Some deployments and SDKs use a `/v1` prefix (`/v1/memory/insert`). If your deployment requires it, prepend `/v1`.

## Request Body

```json
{
  "title": "user-preference-theme",
  "content": "User prefers dark mode",
  "namespace": "preferences",
  "sourceType": "doc",
  "metadata": {"source": "onboarding"}
}
```

## Examples by Language

{% tabs %}
{% tab title="cURL" %}
```bash
curl -X POST "https://api.tinyhumans.ai/memory/insert" \
  -H "Authorization: Bearer $ALPHAHUMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "user-preference-theme",
    "content": "User prefers dark mode",
    "namespace": "preferences",
    "sourceType": "doc",
    "metadata": {"source": "onboarding"}
  }'
```
{% endtab %}

{% tab title="TypeScript" %}
```ts
import { AlphahumanMemoryClient } from "@alphahuman/memory-sdk";

const client = new AlphahumanMemoryClient({ token: process.env.ALPHAHUMAN_TOKEN! });

const result = await client.insertMemory({
  title: "user-preference-theme",
  content: "User prefers dark mode",
  namespace: "preferences",
  sourceType: "doc",
  metadata: { source: "onboarding" },
});

console.log(result.data.status);
```
{% endtab %}

{% tab title="Python" %}
```python
import tinyhumansai as api

client = api.TinyHumanMemoryClient(token="YOUR_API_KEY")

result = client.ingest_memory(
    item={
        "key": "user-preference-theme",
        "content": "User prefers dark mode",
        "namespace": "preferences",
        "metadata": {"source": "onboarding"},
    }
)

print(result.ingested, result.updated, result.errors)
```
{% endtab %}

{% tab title="Go" %}
```go
client, err := tinyhumans.NewClient(os.Getenv("ALPHAHUMAN_TOKEN"))
if err != nil {
    log.Fatal(err)
}
defer client.Close()

resp, err := client.IngestMemory(tinyhumans.MemoryItem{
    Key:       "user-preference-theme",
    Content:   "User prefers dark mode",
    Namespace: "preferences",
    Metadata:  map[string]interface{}{"source": "onboarding"},
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(resp.Ingested, resp.Updated, resp.Errors)
```
{% endtab %}

{% tab title="Rust" %}
```rust
use tinyhumansai::{InsertMemoryParams, TinyHumanConfig, TinyHumanMemoryClient};

let client = TinyHumanMemoryClient::new(TinyHumanConfig::new("YOUR_API_KEY"))?;

let response = client
    .insert_memory(InsertMemoryParams {
        title: "user-preference-theme".into(),
        content: "User prefers dark mode".into(),
        namespace: "preferences".into(),
        ..Default::default()
    })
    .await?;

println!("{}", response.data.status.unwrap_or_default());
```
{% endtab %}

{% tab title="Java" %}
```java
import xyz.alphahuman.sdk.*;

try (AlphahumanMemoryClient client = new AlphahumanMemoryClient(System.getenv("ALPHAHUMAN_TOKEN"))) {
    InsertMemoryResponse response = client.insertMemory(
        new InsertMemoryParams("user-preference-theme", "User prefers dark mode", "preferences")
    );

    System.out.println(response.getStatus());
}
```
{% endtab %}

{% tab title="C++" %}
```cpp
#include "alphahuman/alphahuman.hpp"
using namespace alphahuman;

AlphahumanMemoryClient client(std::getenv("ALPHAHUMAN_TOKEN"));

InsertMemoryParams params;
params
    .set_title("user-preference-theme")
    .set_content("User prefers dark mode")
    .set_namespace("preferences");

auto response = client.insert_memory(params);
std::cout << response.status << std::endl;
```
{% endtab %}
{% endtabs %}
