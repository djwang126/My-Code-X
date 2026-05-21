## What to build

在已选 Thread 有可靠 active Turn 且存在 draft 时，让用户用服务端保存的 draft 触发 Codex `turn/steer`。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/steer`, `SendSteerInputRequest`, `ComposerAction`
- `conversation-view-domain-model.md`: `ComposerService`, `NoReliableSteerTarget`, `RequestAcceptancePolicy`, `DraftClearsOnlyAfterAcceptedForSameThread`
- `conversation-view-codex-interface.md`: `turn/steer`, `ThreadStatus`

Acceptance focus:
- `expectedTurnId` 必须来自可靠 active Thread context 或 composer action。
- steer 使用服务端 draft，不从 command body 重复传文本。
- steer 被拒绝时 draft 保留，并通过 page notice/API error 暴露失败。

Out of scope:
- 不实现普通 send。
- 不实现 interrupt。
- 不实现 command idempotency 的完整重复请求语义。

## Blocked by

- 009-per-thread-draft-lifecycle.md
- 011-sse-snapshot-and-item-updates.md
