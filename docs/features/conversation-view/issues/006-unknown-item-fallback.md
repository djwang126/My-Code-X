## What to build

为 Conversation View 暂时不能专门理解的 Thread 信息提供 fallback 展示，保证可见、可排查，并且不阻断正常阅读或输入。

References:
- `conversation-view-feature-description.md`: `Unknown information fallback`
- `conversation-view-api-contract.md`: `UnknownTimelineItem`, `DisplayDetail`
- `conversation-view-domain-model.md`: `DisplayableItemNeverDropped`, `UnknownPreservationPolicy`, `UnknownIsNotFailure`
- `conversation-view-codex-interface.md`: `ThreadItem`

## Blocked by

- 003-restore-message-history.md
