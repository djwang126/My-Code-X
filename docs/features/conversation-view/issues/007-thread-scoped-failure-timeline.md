## What to build

将归属于已选 Thread 的明确失败展示为 timeline failure item，让用户能在发生位置理解失败，而不把失败伪装成普通回复。

References:
- `conversation-view-feature-description.md`: `Failure reading`
- `conversation-view-api-contract.md`: `FailureTimelineItem`, `Error Contract`, `Domain Error Mapping`
- `conversation-view-domain-model.md`: `FailureIsNotMessage`, `ThreadFailureStaysInTimeline`, `FailureDedupPolicy`, `NoticeClassifier`
- `conversation-view-codex-interface.md`: `Failure and Warning`, `Event Correlation Notes`

## Blocked by

- 003-restore-message-history.md
