# Codex Conversation View Feature Slice - Aggregated Conversation Event Delivery

- **Type:** AFK
- **Blocked by:** Slice 2, Slice 3
- **Feature requirements covered:** 19, 20, 21, 22, 23, 24, 25

## 目标

建立后端聚合 conversation events 到前端进度刷新式更新的路径，不要求前端承受 token 级高频流式输出。

## 垂直路径

- Server conversation model 支持后端聚合后的 conversation events。
- Server 支持 Codex 原生同一个 item 的 update 方式。
- Server 支持 Codex 原生多个 item 的 append 方式。
- Server 保留 Codex app-server 的权威顺序、item identity 和内容完整性。
- Server 对 runtime delta 的聚合必须基于 Codex 原生 notification shape：同一个 itemId 的不同 delta notification 要按它们更新的 Codex 目标字段/index 累积成 full item snapshot，不能引入 `channels` 作为产品语义，不能把不同 delta kind 合并成单个 `text`，也不能 last-delta-wins。
- API 向前端提供聚合后的 conversation events。
- Web 消费聚合后的 events 并更新 timeline。
- UI 呈现像进度刷新，而不是逐 token 直播。

## 完成后可验证

- 后端可以批量或低频推送 conversation updates。
- 前端不需要逐 token 渲染。
- Codex 原生是同一个 item 时，UI 更新同一个 item。
- Codex 原生是多个 item 时，UI 追加多个 item。
- 完成后内容完整且顺序正确。
- 同一个 Codex item 的不同 runtime delta 不会互相覆盖，例如 reasoning summary/content、file change output/changes、command output 和 tool progress 都按 Codex 原生字段保留。

## 非目标

- 不发明 Codex 没有的 item 生命周期、turn 状态、标题、摘要、字段、delta channel 或关系。
- 不实现自动滚动策略。
- 不做多页签专项优化。
- 不显示额外完成横幅或 done 提示。
- 不显示 turn 或 item 时间戳。
