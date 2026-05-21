## What to build

构建已选 Thread 的最小 Conversation View 投影，让前端能端到端显示一个真实 selected Thread，即使 timeline 还没有恢复内容。

References:
- `conversation-view-api-contract.md`: `GET /api/conversation-view/threads/{threadId}`, `ConversationView`, `ThreadContext`, `ConversationPageState`, `ComposerView`, `ConversationSyncState`
- `conversation-view-domain-model.md`: `Conversation`, `ConversationQueryService`, `Application State Outside Domain Aggregate`
- `conversation-view-feature-description.md`: `Conversation View shell`

Acceptance focus:
- thread-scoped endpoint 返回完整 `ConversationView` wrapper，而不是只返回 Thread metadata。
- 空 timeline 是可读状态，不等同于恢复失败。
- composer action 的禁用或可用状态来自 contract，不由前端临时猜测。

Out of scope:
- 不恢复 Codex history。
- 不实现 message/work progress/failure 分类。
- 不实现 live update。

## Blocked by

- 001-default-cwd-current-thread-bridge.md
