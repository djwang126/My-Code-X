## What to build

在已选 Thread 可可靠发送普通输入时，让用户用服务端保存的 draft 触发 Codex `turn/start`，并按接受或拒绝结果维护 composer。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/send`, `SendUserInputRequest`, `Command Responses`, `Draft Lifecycle`
- `conversation-view-domain-model.md`: `ComposerService`, `RequestAcceptancePolicy`, `AcceptedInputOnly`, `DraftClearsOnlyAfterAcceptedForSameThread`
- `conversation-view-codex-interface.md`: `turn/start`

## Blocked by

- 003-restore-message-history.md
- 009-per-thread-draft-lifecycle.md
