# Delete

Delete removes stored memory explicitly.

## When to Delete

- user-requested data removal
- invalid or unsafe memory content
- namespace reset during migrations or test setup

## Delete vs. Decay

- Use decay for natural long-term pruning.
- Use delete when you need immediate removal.

Deletion is permanent.

For implementation examples in all supported languages, see [Deleting Memories](../sdk-functions/deleting-memories.md).
