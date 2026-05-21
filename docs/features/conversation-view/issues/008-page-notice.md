## What to build

将不适合进入 timeline 的错误、warning 和 My-Code-X 本地问题展示为 page notice，让用户看到问题但不混淆为 Thread failure item。

References:
- `conversation-view-feature-description.md`: `Conversation View notice`
- `conversation-view-api-contract.md`: `PageNotice`, `Error Contract`, `ConversationView.notices`
- `conversation-view-domain-model.md`: `PageNoticePolicy`, `NoticeClassifier`, `Application Events and State`
- `conversation-view-codex-interface.md`: `warning`, `guardianWarning`, `configWarning`, unscoped `error`

Acceptance focus:
- timeline failure 和 page notice 的边界以 domain policy 为准。
- API failure 中的 `notice` 字段和 view 中的 `notices` 保持 contract shape。
- notice 不改变 timeline 顺序，也不伪造 timeline item。

Out of scope:
- 不实现复杂 notice 生命周期管理。
- 不实现全局 notification center。
- 不改变 failure item 展示。

## Blocked by

- 002-empty-conversation-projection.md
- 007-thread-scoped-failure-timeline.md
