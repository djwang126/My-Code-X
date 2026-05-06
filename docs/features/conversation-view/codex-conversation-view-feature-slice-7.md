# Codex Conversation View Feature Slice - Restored Conversation Rendering

- **Type:** AFK
- **Blocked by:** Slice 6
- **Feature requirements covered:** 16, 17, 18, 19

## 目标

让 Conversation View 能展示已经由应用层恢复出的权威历史 conversation，并在进行中 thread 后续产生 conversation updates 时继续更新 timeline。

## 垂直路径

- Application resume/thread 生命周期由应用层负责，不由 Conversation View 实现。
- Server conversation state 接收应用层提供的已恢复 conversation timeline。
- Conversation state 使用已恢复 timeline 替换当前 timeline。
- 已完成 thread 的已恢复 timeline 展示为完整历史 conversation。
- 进行中 thread 在恢复后继续消费后端提供的后续 conversation updates。
- Web 根据恢复后的 snapshot、replacement events 或后续 upsert events 更新 Conversation View。

## 完成后可验证

- 已完成 thread 的恢复结果可以展示为完整历史 conversation。
- 进行中 thread 可以先展示恢复出的历史内容，再继续展示后续 conversation updates。
- 恢复失败显示 timeline 外常规错误状态，不伪造 Codex error item。

## 非目标

- 不实现 resume thread 入口或 thread 生命周期。
- 不实现 runtime reconnect 或 Codex app-server 恢复协议。
- 不做手动刷新。
- 不做客户端缓存。
- 不做自动滚动。
- 不显示额外完成横幅或 done 提示。
- 不提供手动刷新、手动重新加载或跳转控件。
