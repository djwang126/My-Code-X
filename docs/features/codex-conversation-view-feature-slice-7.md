# Codex Conversation View Feature Slice - Resume Thread Conversation Restore

- **Type:** AFK
- **Blocked by:** Slice 6
- **Feature requirements covered:** 16, 17, 18, 19

## 目标

让恢复出的 thread 能展示权威历史 conversation，并在进行中时继续接收后续 conversation updates。

## 垂直路径

- Application 实现 resume thread 的 conversation restore 路径。
- Server 从 Codex app-server 权威数据恢复 conversation timeline。
- Conversation state 使用恢复出的 timeline 替换当前 timeline。
- 已完成 thread 展示完整历史 conversation。
- 进行中 thread 恢复后继续消费后端后续 conversation updates。
- Web 根据恢复后的 snapshot/events 更新 Conversation View。

## 完成后可验证

- 打开已完成 thread 可以看到完整历史 conversation。
- 打开进行中 thread 可以先看到恢复出的历史内容，再继续看到后续更新。
- 恢复失败显示 timeline 外常规错误状态，不伪造 Codex error item。

## 非目标

- 不做手动刷新。
- 不做客户端缓存。
- 不做自动滚动。
- 不显示额外完成横幅或 done 提示。
- 不提供手动刷新、手动重新加载或跳转控件。
