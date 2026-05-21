## What to build

恢复 Codex work progress 信息，并以通用紧凑 timeline item 展示，让用户能理解 Codex 正在或曾经做过什么。

References:
- `conversation-view-feature-description.md`: `Work progress reading`
- `conversation-view-api-contract.md`: `WorkProgressTimelineItem`, `DisplayDetail`, `TimelineStatus`
- `conversation-view-domain-model.md`: `TimelineClassificationPolicy`, `WorkProgressStatusPolicy`, `TimelineClassifier`
- `conversation-view-codex-interface.md`: `ThreadItem`, work progress streaming 相关 notification

Acceptance focus:
- 已知 work progress 类型按 domain policy 分类，不靠正文文本猜测。
- UI 使用通用字段和详情展示，不为每个 Codex source 发散专用组件。
- `plan` 不在本 slice 里当作 work progress 展示，除非上游设计文档先更新。

Out of scope:
- 不实现每种工具调用的专属 UI。
- 不实现 live work progress streaming。
- 不处理 unknown item fallback。

## Blocked by

- 003-restore-message-history.md
