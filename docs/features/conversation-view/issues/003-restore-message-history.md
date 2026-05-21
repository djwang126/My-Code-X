## What to build

恢复已选 Thread 的历史 user message 和 agent message，并让它们作为普通 message timeline item 端到端可读。

References:
- `conversation-view-api-contract.md`: `POST /api/conversation-view/threads/{threadId}/restore`, `TimelineItem`, `MessageTimelineItem`, `Sorting And Pagination`
- `conversation-view-domain-model.md`: `ConversationRecoveryService`, `ConversationIngestService`, `TimelineClassifier`, `TimelineIdentityMatchesSource`
- `conversation-view-codex-interface.md`: `thread/resume`, `thread/turns/list`, `ThreadItem`
- `conversation-view-feature-description.md`: `Message reading`

Acceptance focus:
- restore 后的 message identity、顺序和 role 以 domain/API contract 为准。
- 未被 Codex 接受的本地输入不能因为恢复流程进入正式 timeline。
- 恢复失败走 page/application state，不伪装成 agent message。

Out of scope:
- 不实现 Markdown 高级渲染。
- 不处理 work progress、unknown 或 failure item 的完整展示。
- 不实现 live streaming。

## Blocked by

- 002-empty-conversation-projection.md
