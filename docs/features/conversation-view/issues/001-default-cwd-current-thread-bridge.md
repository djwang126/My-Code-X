## What to build

构建临时 current conversation bridge，让 Conversation View 在完整 Thread selection 功能完成前能进入一个真实 Thread；没有可用 Thread 时仍返回无选中状态。

References:
- `conversation-view-api-contract.md`: `GET /api/conversation-view/current`, `ConversationHostView`, `Versioning`
- `conversation-view-domain-model.md`: `Application State Outside Domain Aggregate`, `ConversationQueryService`
- `conversation-view-codex-interface.md`: Thread list / cwd scope 相关接口说明

Acceptance focus:
- `/current` 的 response shape 以 `ConversationHostView` 为准。
- 该 bridge 只负责 transitional host contract，不定义长期 selection lifecycle。
- Thread 来源遵守 Codex app-server / cwd scope 语义，不直接扫描 session 文件作为权威来源。

Out of scope:
- 不实现 Workspace Thread Browser。
- 不实现用户手动切换 Thread。
- 不恢复 timeline history。

## Blocked by

None - can start immediately
