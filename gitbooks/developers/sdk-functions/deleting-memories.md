# Deleting Memories

Use delete to remove memory by namespace.

## API Endpoint

`POST /memory/admin/delete`

Some deployments and SDKs use a `/v1` prefix (`/v1/memory/admin/delete`). If your deployment requires it, prepend `/v1`.

## Request Body

```json
{
  "namespace": "preferences"
}
```

## Examples by Language

{% tabs %}
{% tab title="cURL" %}
```bash
curl -X POST "https://api.tinyhumans.ai/memory/admin/delete" \
  -H "Authorization: Bearer $ALPHAHUMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "preferences"}'
```
{% endtab %}

{% tab title="TypeScript" %}
```ts
await client.deleteMemory({ namespace: "preferences" });
```
{% endtab %}

{% tab title="Python" %}
```python
client.delete_memory(namespace="preferences", delete_all=True)
```
{% endtab %}

{% tab title="Go" %}
```go
resp, err := client.DeleteMemory("preferences", nil)
if err != nil {
    log.Fatal(err)
}

fmt.Println(resp.Deleted)
```
{% endtab %}

{% tab title="Rust" %}
```rust
use tinyhumansai::{DeleteMemoryParams, TinyHumanConfig, TinyHumanMemoryClient};

let client = TinyHumanMemoryClient::new(TinyHumanConfig::new("YOUR_API_KEY"))?;

let response = client
    .delete_memory(DeleteMemoryParams {
        namespace: Some("preferences".into()),
    })
    .await?;

println!("{}", response.data.nodes_deleted);
```
{% endtab %}

{% tab title="Java" %}
```java
DeleteMemoryResponse response = client.deleteMemory(
    new DeleteMemoryParams().setNamespace("preferences")
);

System.out.println(response.getNodesDeleted());
```
{% endtab %}

{% tab title="C++" %}
```cpp
DeleteMemoryParams params;
params.set_namespace("preferences");

auto response = client.delete_memory(params);
std::cout << response.nodes_deleted << std::endl;
```
{% endtab %}
{% endtabs %}
