## What to build

构建已选 Thread 的最小 Conversation View 投影，让前端能端到端显示一个真实 selected Thread，即使 timeline 还没有恢复内容。

References:
- `conversation-view-api-contract.md`: `GET /api/conversation-view/threads/{threadId}`, `ConversationView`, `ThreadContext`, `ConversationPageState`, `ComposerView`, `ConversationSyncState`
- `conversation-view-domain-model.md`: `Conversation`, `ConversationQueryService`, `Application State Outside Domain Aggregate`
- `conversation-view-feature-description.md`: `Conversation View shell`

## Blocked by

- 001-default-cwd-current-thread-bridge.md
