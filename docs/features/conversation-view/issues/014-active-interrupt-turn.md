## What to build

在已选 Thread 有可靠 active Turn 且用户确认后，允许用户触发 Codex `turn/interrupt`；interrupt 不修改 composer draft。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/interrupt`, `InterruptTurnRequest`, `ComposerAction`
- `conversation-view-domain-model.md`: `InterruptGuardPolicy`, `NoReliableInterruptTarget`, `InterruptNotConfirmed`, `ComposerService`
- `conversation-view-codex-interface.md`: `turn/interrupt`, `turn/completed`

Acceptance focus:
- interrupt 必须带确认信号。
- `turnId` 必须属于 path `threadId` 的可靠 active Turn。
- accepted/rejected 都不清空 draft，失败通过 page notice/API error 暴露。

Out of scope:
- 不实现 steer。
- 不实现中断后的完整恢复策略。
- 不实现 command idempotency 的完整重复请求语义。

## Blocked by

- 009-per-thread-draft-lifecycle.md
- 011-sse-snapshot-and-item-updates.md
