## What to build

完善 reconnect、sync 和 stale 状态，让已有内容保持可读，同时应用尽量追上 selected Thread 的最新可用状态。

References:
- `conversation-view-feature-description.md`: `Conversation View shell`, `Live update`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/sync`, `ConversationSyncState`, `Reconnect`, `Lifecycle Rules`
- `conversation-view-domain-model.md`: `ConversationRecoveryService`, `ConversationContentMarkedStale`, `ConversationSyncStarted`, `ConversationSyncFailed`
- `conversation-view-codex-interface.md`: `thread/resume`, `thread/turns/list`, live subscription notes

Acceptance focus:
- 已有 timeline 内容在 sync/reconnect/stale 期间不被清空。
- sync/reconnect 状态通过 page/sync state 表达，不伪造 timeline item。
- 无法补齐 event buffer 时按 contract 回到 snapshot 路径。

Out of scope:
- 不实现 timeline pagination。
- 不实现 Workspace Thread Browser。
- 不改变 SSE event contract。

## Blocked by

- 011-sse-snapshot-and-item-updates.md
