## What to build

让会触发 Codex 副作用的 composer command 按 client request identity 幂等，避免网络重试或重复点击造成重复 turn action。

References:
- `conversation-view-api-contract.md`: `Idempotency`, `SendUserInputRequest`, `SendSteerInputRequest`, `InterruptTurnRequest`
- `conversation-view-domain-model.md`: `ComposerService`, `RequestAcceptancePolicy`
- `conversation-view-codex-interface.md`: `turn/start`, `turn/steer`, `turn/interrupt`

## Blocked by

- 010-idle-send-user-input.md
- 013-active-steer-input.md
- 014-active-interrupt-turn.md
