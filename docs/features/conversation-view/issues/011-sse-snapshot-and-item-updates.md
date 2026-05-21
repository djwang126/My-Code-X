## What to build

建立 Conversation View 的 SSE live update 路径，让前端能接收并应用 selected Thread 的 snapshot 和基础 timeline 变更。

References:
- `conversation-view-feature-description.md`: `Live update`
- `conversation-view-api-contract.md`: `GET /api/conversation-view/threads/{threadId}/events`, `SSE Events`, `Reconnect`
- `conversation-view-domain-model.md`: `ConversationIngestService`, `ConversationRecoveryService`, `Timeline Item Transition`
- `conversation-view-codex-interface.md`: `Server Notifications`, item lifecycle, turn lifecycle

Acceptance focus:
- SSE event 是 My-Code-X display event，不是 Codex raw notification 原样转发。
- snapshot 全量替换，item add/update/completed/failure 按 contract 应用。
- event 只作用于 path `threadId`，不串到其他 Thread。

Out of scope:
- 不实现 agent message delta streaming。
- 不实现 reconnect 补齐和 stale catch-up 的完整体验。
- 不实现 composer command 行为。

## Blocked by

- 003-restore-message-history.md
- 005-restore-work-progress.md
- 006-unknown-item-fallback.md
- 007-thread-scoped-failure-timeline.md
