## What to build

让会触发 Codex 副作用的 composer command 按 client request identity 幂等，避免网络重试或重复点击造成重复 turn action。

References:
- `conversation-view-api-contract.md`: `Idempotency`, `SendUserInputRequest`, `SendSteerInputRequest`, `InterruptTurnRequest`
- `conversation-view-domain-model.md`: `ComposerService`, `RequestAcceptancePolicy`
- `conversation-view-codex-interface.md`: `turn/start`, `turn/steer`, `turn/interrupt`

Acceptance focus:
- 缺失必填 `clientRequestId` 按 `INVALID_REQUEST` 处理。
- 同一幂等 key 的重复请求不得再次调用 Codex app-server。
- accepted 后重复请求不因为 draft 已清空而返回 `EMPTY_COMPOSER_DRAFT`。

Out of scope:
- 不改变 command DTO shape。
- 不处理 restore/sync 的完整并发语义。
- 不实现跨进程持久幂等存储，除非实现方案需要并经过确认。

## Blocked by

- 010-idle-send-user-input.md
- 013-active-steer-input.md
- 014-active-interrupt-turn.md
