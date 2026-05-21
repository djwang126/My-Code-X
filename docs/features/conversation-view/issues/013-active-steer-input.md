## What to build

在已选 Thread 有可靠 active Turn 且存在 draft 时，让用户用服务端保存的 draft 触发 Codex `turn/steer`。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/steer`, `SendSteerInputRequest`, `ComposerAction`
- `conversation-view-domain-model.md`: `ComposerService`, `NoReliableSteerTarget`, `RequestAcceptancePolicy`, `DraftClearsOnlyAfterAcceptedForSameThread`
- `conversation-view-codex-interface.md`: `turn/steer`, `ThreadStatus`

## Blocked by

- 009-per-thread-draft-lifecycle.md
- 011-sse-snapshot-and-item-updates.md
