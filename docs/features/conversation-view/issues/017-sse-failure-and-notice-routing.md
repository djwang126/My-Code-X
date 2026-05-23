## What to build

将 Codex live failure、warning 和 My-Code-X live 同步问题路由到已有的 timeline failure 或 page notice 表达能力。

References:
- `conversation-view-feature-description.md`: `Failure reading`, `Conversation View notice`, `Live update`
- `conversation-view-api-contract.md`: `TimelineFailureAddedEvent`, `PageNoticeRaisedEvent`, `SSE Events`
- `conversation-view-domain-model.md`: `FailureDedupPolicy`, `NoticeClassifier`, `PageNoticePolicy`
- `conversation-view-codex-interface.md`: `Failure and Warning`, `Event Correlation Notes`

## Scope

- 将 live `turn/completed` 中的 failed turn 映射为 `timeline.failureAdded`。
- 将 live `error` 按 `willRetry` 与最终 `turn/completed` 结果处理为失败候选。
- 对同一 failure 在 `error` 与 `turn/completed.failed` 中重复出现的情况做去重或合并。
- 将 unscoped `error`、connection / config warning、My-Code-X live 同步问题映射为 `pageNotice.raised`。

## Out of scope

- 不重新定义 failure timeline item。
- 不重新定义 page notice 展示。
- 不建立基础 SSE endpoint。
- 不处理 agent delta streaming。

## Blocked by

- 007-thread-scoped-failure-timeline.md
- 008-page-notice.md
- 011-sse-snapshot-and-item-updates.md
