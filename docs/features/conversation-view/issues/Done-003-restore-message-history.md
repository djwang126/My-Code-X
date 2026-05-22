## What to build

恢复已选 Thread 的历史 user message 和 agent message，并让它们作为普通 message timeline item 端到端可读。

References:
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/restore`, `TimelineItem`, `MessageTimelineItem`, `Sorting And Pagination`
- `conversation-view-domain-model.md`: `ConversationRecoveryService`, `ConversationIngestService`, `TimelineClassifier`, `TimelineIdentityMatchesSource`
- `conversation-view-codex-interface.md`: `thread/resume`, `thread/turns/list`, `ThreadItem`
- `conversation-view-feature-description.md`: `Message reading`

## Blocked by

- 002-empty-conversation-projection.md
