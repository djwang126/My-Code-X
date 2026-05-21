## What to build

为 Conversation View 暂时不能专门理解的 Thread 信息提供 fallback 展示，保证可见、可排查，并且不阻断正常阅读或输入。

References:
- `conversation-view-feature-description.md`: `Unknown information fallback`
- `conversation-view-api-contract.md`: `UnknownTimelineItem`, `DisplayDetail`
- `conversation-view-domain-model.md`: `DisplayableItemNeverDropped`, `UnknownPreservationPolicy`, `UnknownIsNotFailure`
- `conversation-view-codex-interface.md`: `ThreadItem`

Acceptance focus:
- 未知 `ThreadItem.type` 进入 unknown timeline item，而不是被丢弃或当作 failure。
- unknown detail 只展示经过服务端整理后的通用字段。
- 缺少可保留 payload 的情况按 domain/API error contract 处理。

Out of scope:
- 不为 unknown 类型补专用 UI。
- 不把 unknown 升级成 failure。
- 不实现 future protocol 的专门解析。

## Blocked by

- 003-restore-message-history.md
