## What to build

支持 agent message 的增量输出展示，让正在生成的回复能更新已有 timeline item，并在完成后回到权威完成状态。

References:
- `conversation-view-feature-description.md`: `Message reading`, `Live update`
- `conversation-view-api-contract.md`: `AgentMessageDeltaEvent`, `TimelineItemCompletedEvent`, `MessageTimelineItem`
- `conversation-view-domain-model.md`: `ApplyAgentMessageDelta`, `CompleteAgentMessage`, `TimelineItemNotFound`
- `conversation-view-codex-interface.md`: `item/agentMessage/delta`, `item/completed`

Acceptance focus:
- delta 只应用到已存在的 agent message item。
- completed/update event 的完整 item 是权威状态。
- 找不到目标 item 时按 domain/API error contract 处理，不创建不可靠 message。

Out of scope:
- 不处理 work progress delta。
- 不实现 reconnect 缺失 delta 回放。
- 不改变 Markdown rendering contract。

## Blocked by

- 011-sse-snapshot-and-item-updates.md
