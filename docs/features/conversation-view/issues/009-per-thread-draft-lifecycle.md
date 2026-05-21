## What to build

按 Thread 保存和读取 composer draft，让用户切换 Conversation target 后仍能回到对应 Thread 的未发送输入。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `PUT /api/conversation-view/threads/{threadId}/draft`, `ComposerView`, `Draft Lifecycle`
- `conversation-view-domain-model.md`: `ComposerDraft`, `DraftBelongsToThread`, `ThreadSwitchKeepsDrafts`, `ComposerService`

## Blocked by

- 002-empty-conversation-projection.md
