## What to build

在已选 Thread 有可靠 active Turn 且用户确认后，允许用户触发 Codex `turn/interrupt`；interrupt 不修改 composer draft。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/interrupt`, `InterruptTurnRequest`, `ComposerAction`
- `conversation-view-domain-model.md`: `InterruptGuardPolicy`, `NoReliableInterruptTarget`, `InterruptNotConfirmed`, `ComposerService`
- `conversation-view-codex-interface.md`: `turn/interrupt`, `turn/completed`

## Blocked by

- 009-per-thread-draft-lifecycle.md
- 011-sse-snapshot-and-item-updates.md
