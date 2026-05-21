## What to build

将归属于已选 Thread 的明确失败展示为 timeline failure item，让用户能在发生位置理解失败，而不把失败伪装成普通回复。

References:
- `conversation-view-feature-description.md`: `Failure reading`
- `conversation-view-api-contract.md`: `FailureTimelineItem`, `Error Contract`, `Domain Error Mapping`
- `conversation-view-domain-model.md`: `FailureIsNotMessage`, `ThreadFailureStaysInTimeline`, `FailureDedupPolicy`, `NoticeClassifier`
- `conversation-view-codex-interface.md`: `Failure and Warning`, `Event Correlation Notes`

Acceptance focus:
- 只有 thread-scoped failure 进入 timeline。
- failure message 和 detail 保留上游语义，不添加 My-Code-X 自创解释。
- 同一 failure signature 的重复报告按 dedup policy 处理。

Out of scope:
- 不处理 unscoped error 的 page notice。
- 不实现 recovering error overlay。
- 不为每种错误类型做专用 UI。

## Blocked by

- 003-restore-message-history.md
