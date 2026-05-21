## What to build

构建临时 current conversation bridge，让 Conversation View 在完整 Thread selection 功能完成前能进入一个真实 Thread；没有可用 Thread 时仍返回无选中状态。

References:
- `conversation-view-api-contract.md`: `GET /api/conversation-view/current`, `ConversationHostView`, `Versioning`
- `conversation-view-domain-model.md`: `Application State Outside Domain Aggregate`, `ConversationQueryService`
- `conversation-view-codex-interface.md`: Thread list / cwd scope 相关接口说明

## Blocked by

None - can start immediately
