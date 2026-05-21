## What to build

支持 agent message 的增量输出展示，让正在生成的回复能更新已有 timeline item，并在完成后回到权威完成状态。

References:
- `conversation-view-feature-description.md`: `Message reading`, `Live update`
- `conversation-view-api-contract.md`: `AgentMessageDeltaEvent`, `TimelineItemCompletedEvent`, `MessageTimelineItem`
- `conversation-view-domain-model.md`: `ApplyAgentMessageDelta`, `CompleteAgentMessage`, `TimelineItemNotFound`
- `conversation-view-codex-interface.md`: `item/agentMessage/delta`, `item/completed`

## Blocked by

- 011-sse-snapshot-and-item-updates.md
