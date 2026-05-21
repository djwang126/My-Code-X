## What to build

在已选 Thread 可可靠发送普通输入时，让用户用服务端保存的 draft 触发 Codex `turn/start`，并按接受或拒绝结果维护 composer。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/commands/send`, `SendUserInputRequest`, `Command Responses`, `Draft Lifecycle`
- `conversation-view-domain-model.md`: `ComposerService`, `RequestAcceptancePolicy`, `AcceptedInputOnly`, `DraftClearsOnlyAfterAcceptedForSameThread`
- `conversation-view-codex-interface.md`: `turn/start`

Acceptance focus:
- send 使用服务端 draft，不从 command body 重复传文本。
- draft 为空、目标不可靠或 Codex 拒绝时按 API error contract 返回，并保留 draft。
- 只有 app-server 接受请求后才清空同一 Thread 的 draft。

Out of scope:
- 不实现 steer。
- 不实现 interrupt。
- 不实现 command idempotency 的完整重复请求语义。

## Blocked by

- 003-restore-message-history.md
- 009-per-thread-draft-lifecycle.md
