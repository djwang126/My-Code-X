## What to build

按 Thread 保存和读取 composer draft，让用户切换 Conversation target 后仍能回到对应 Thread 的未发送输入。

References:
- `conversation-view-feature-description.md`: `Composer`
- `conversation-view-api-contract.md`: `PUT /api/conversation-view/threads/{threadId}/draft`, `ComposerView`, `Draft Lifecycle`
- `conversation-view-domain-model.md`: `ComposerDraft`, `DraftBelongsToThread`, `ThreadSwitchKeepsDrafts`, `ComposerService`

Acceptance focus:
- draft 保存以 path `threadId` 为准，body 不能覆盖目标 Thread。
- 保存 draft 不 trim 用户原文。
- draft change 不调用 Codex app-server，也不产生 timeline item。

Out of scope:
- 不实现 send / steer / interrupt。
- 不实现 Thread selection lifecycle。
- 不实现 pending interaction 输入。

## Blocked by

- 002-empty-conversation-projection.md
