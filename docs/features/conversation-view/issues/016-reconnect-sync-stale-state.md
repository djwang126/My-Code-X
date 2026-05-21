## What to build

完善 reconnect、sync 和 stale 状态，让已有内容保持可读，同时应用尽量追上 selected Thread 的最新可用状态。

References:
- `conversation-view-feature-description.md`: `Conversation View shell`, `Live update`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/sync`, `ConversationSyncState`, `Reconnect`, `Lifecycle Rules`
- `conversation-view-domain-model.md`: `ConversationRecoveryService`, `ConversationContentMarkedStale`, `ConversationSyncStarted`, `ConversationSyncFailed`
- `conversation-view-codex-interface.md`: `thread/resume`, `thread/turns/list`, live subscription notes

## Blocked by

- 011-sse-snapshot-and-item-updates.md
