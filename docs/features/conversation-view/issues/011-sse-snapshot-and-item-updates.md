## What to build

建立 Conversation View 的 SSE live update 路径，让前端能接收并应用 selected Thread 的 snapshot 和基础 timeline 变更。

References:
- `conversation-view-feature-description.md`: `Live update`
- `conversation-view-api-contract.md`: `GET /api/conversation-view/threads/{threadId}/events`, `SSE Events`, `Reconnect`
- `conversation-view-domain-model.md`: `ConversationIngestService`, `ConversationRecoveryService`, `Timeline Item Transition`
- `conversation-view-codex-interface.md`: `Server Notifications`, item lifecycle, turn lifecycle

## Blocked by

- 003-restore-message-history.md
- 005-restore-work-progress.md
- 006-unknown-item-fallback.md
- 007-thread-scoped-failure-timeline.md
