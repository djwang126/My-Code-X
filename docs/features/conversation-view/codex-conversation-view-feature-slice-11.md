# Codex Conversation View Feature Slice - Error Surfaces

- **Type:** AFK
- **Blocked by:** Slice 2, Slice 6
- **Feature requirements covered:** 16, 38, 39, 40, 41

## 目标

区分 conversation 内错误 item 和非 conversation 基础设施错误，让用户看到原始错误信息而不混淆来源。

本 slice 同时收尾整个 Conversation View 的 error item 语义：当前 Codex app-server protocol 中聊天过程错误可能表现为 turn-scoped `error` notification、failed `turn/completed` error，或恢复历史中的 failed turn error，而不一定是原生 ThreadItem 变体。My-Code-X 只把这些带有 thread 和 turn 归属的 conversation-scoped error facts 投影为 timeline error item。

## 垂直路径

- Server 把带 threadId 和 turnId 的 runtime error notification 投影为 timeline error item，但不据此更新或推断 turn lifecycle。
- Server 把 failed turn completed error 投影为 timeline error item。
- Server 在恢复历史 conversation 时，把 failed turn error 投影到该 turn 对应的 timeline 位置。
- 同一个 turn 的 error notification 和 failed turn completed error 使用由 turn id 派生的同一个 error item identity，后续权威错误更新同一个 item，不重复追加。
- Web 把 conversation 错误 item 渲染为错误卡片。
- 错误卡片展示原始错误 message。
- 错误卡片中的错误文字使用红色。
- 加载、恢复等非 conversation 基础设施错误显示为 timeline 外常规错误状态。
- 没有 turnId 或没有 threadId 的 runtime/system/realtime 错误不伪造成 conversation timeline item。
- Conversation View 不改写、重新解释或推断原始错误原因。

## 完成后可验证

- 带 threadId 和 turnId 的聊天过程 runtime error 显示在 timeline 中。
- failed turn completed error 显示在 timeline 中。
- 恢复历史中的 failed turn error 显示在 timeline 中。
- 同一个 turn 的错误不会重复显示为多张错误卡。
- 错误 item 不伪装成普通 assistant message。
- 恢复失败不会被伪造成 Codex conversation item。
- 用户看到的是原始 error message。

## 非目标

- 不设计复杂错误图标、边框或背景。
- 不展示额外错误分析。
- 不给错误卡片加专门复制按钮。
- 不给错误卡片增加重试、取消、approval 或发送控件。
- 不显示错误时间戳。
- 不展示除原始 error message 外的调试字段。
