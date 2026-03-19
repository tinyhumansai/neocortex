# Delete

**Deleting** removes memories explicitly when you need immediate cleanup rather than waiting for natural decay.

## Delete a Specific Memory

```python
client.delete_memory(namespace="preferences", key="fact-1")
```

## Delete Multiple Memories

```python
client.delete_memory(namespace="preferences", keys=["fact-1", "fact-2"])
```

## Delete Everything in a Namespace

```python
client.delete_memory(namespace="preferences", delete_all=True)
```

## When to Delete vs. Let Decay

Most of the time, you can let [memory decay](memory-decay.md) handle cleanup naturally. Use explicit deletion when:

* A user requests their data be removed
* Information is known to be incorrect and should not influence future recall
* You're resetting or rebuilding a namespace

Deletion is **permanent and immediate** the memory is gone, not just decayed.
