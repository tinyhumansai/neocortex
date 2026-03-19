# Namespaces

**Namespaces** let you organize memories into logical groups. Think of them as folders or categories.

```
preferences          → "User prefers dark mode", "Timezone is PST"
conversation-history → "Discussed Q3 roadmap on March 5"
user-facts           → "Works at Acme Corp", "Based in Austin"
```

Each namespace is isolated: you can have the same key in different namespaces without conflict. When recalling memory, you query within a specific namespace.

## Why Use Namespaces?

* **Separation of concerns:** Keep user preferences separate from conversation history, separate from domain knowledge.
* **Scoped queries:** Recall only what's relevant. When the user asks about preferences, you don't need to search through conversation logs.
* **Scoped deletion:** Clean up an entire category of memories without affecting others.

```python
# Store in different namespaces
client.ingest_memory(item={"key": "theme", "content": "Dark mode", "namespace": "preferences"})
client.ingest_memory(item={"key": "meeting-1", "content": "Discussed roadmap", "namespace": "conversations"})

# Recall from a specific namespace
ctx = client.recall_memory(namespace="preferences", prompt="What does the user prefer?")
```
