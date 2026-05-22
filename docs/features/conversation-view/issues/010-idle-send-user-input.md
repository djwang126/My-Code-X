## What to build

在已选 Thread 可可靠发送普通输入时，让用户用当前 composer text 触发 Codex `turn/start`，并按接受或拒绝结果维护前端 draft。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/send`, `SendUserInputRequest`, `Command Responses`, `Client Draft Responsibilities`
- `conversation-view-domain-model.md`: `ComposerService`, `RequestAcceptancePolicy`, `AcceptedInputOnly`, `InputText`
- `conversation-view-codex-interface.md`: `turn/start`

## Blocked by

- 003-restore-message-history.md
- 009-per-thread-draft-lifecycle.md
