## What to build

将不适合进入 timeline 的错误、warning 和 My-Code-X 本地问题展示为 page notice，让用户看到问题但不混淆为 Thread failure item。

References:
- `conversation-view-feature-description.md`: `Conversation View notice`
- `conversation-view-api-contract.md`: `PageNotice`, `Error Contract`, `ConversationView.notices`
- `conversation-view-domain-model.md`: `PageNoticePolicy`, `NoticeClassifier`, `Application Events and State`
- `conversation-view-codex-interface.md`: `warning`, `guardianWarning`, `configWarning`, unscoped `error`

## Blocked by

- 002-empty-conversation-projection.md
- 007-thread-scoped-failure-timeline.md
