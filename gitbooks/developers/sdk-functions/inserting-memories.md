# Inserting Memories

## Multi-syntax code

You can add code to your GitBook pages using code blocks.

When you add a code block, you can choose to [set the syntax](https://gitbook.com/docs/creating-content/blocks/code-block#set-syntax), [show line numbers](https://gitbook.com/docs/creating-content/blocks/code-block#with-line-numbers), [show a caption](https://gitbook.com/docs/creating-content/blocks/code-block#with-caption), and [wrap the lines](https://gitbook.com/docs/creating-content/blocks/code-block#wrap-code). It’s also easy to [copy the contents of a code block to the clipboard](https://gitbook.com/docs/creating-content/blocks/code-block#copying-the-code), so you can use it elsewhere.

### Example of code block

{% tabs %}
{% tab title="JavaScript" %}
```javascript
const message = "hello world";
console.log(message);
```
{% endtab %}

{% tab title="Python" %}
```python
message = "hello world"
print(message)
```
{% endtab %}

{% tab title="Ruby" %}
```ruby
message = "hello world"
puts message
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
You can make code blocks [span the full width of your window](https://gitbook.com/docs/creating-content/blocks#full-width-blocks) by clicking on the **Options menu** <i class="fa-grip-dots-vertical">:grip-dots-vertical:</i> icon in GitBook next to the block and choosing **Full width.**
{% endhint %}

## HTTP Schema

You can also directly test

{% openapi-operation spec="tinyhumans-api" path="/actionable-items/ingest" method="post" %}
[OpenAPI tinyhumans-api](https://4401d86825a13bf607936cc3a9f3897a.r2.cloudflarestorage.com/gitbook-x-prod-openapi/raw/b063a0161bcaed2556372fc23f676821d08c87ea3e7e17732d3e3d37ca3b7e87.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=dce48141f43c0191a2ad043a6888781c%2F20260320%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260320T231947Z&X-Amz-Expires=172800&X-Amz-Signature=10f116f5610bf82445010a8d2f50371e2645dccfd408e739b138083ab23c072f&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject)
{% endopenapi-operation %}
