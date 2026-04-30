# Codex Conversation View Feature Slice - Work Trace Item Cards

- **Type:** AFK
- **Blocked by:** Slice 6
- **Feature requirements covered:** 5, 25, 26, 27, 28, 33, 34

## 目标

展示 Codex 原生工作痕迹 item，让 Conversation View 不像黑盒，同时保持移动端可读。

## 垂直路径

- Server contract 支持工作痕迹 item。
- Server 从 Codex 原生 item 映射工作痕迹，不发明额外语义。
- 工作痕迹按后端权威顺序逐条进入 timeline。
- Web 把工作痕迹作为 Codex/assistant 侧内容展示，不能使用用户消息样式。
- 工作痕迹默认折叠。
- 结构化 item 优先使用 Codex 原生 title、label、summary 或等价展示元数据。
- 缺少 Codex 展示元数据时，退回显示原始 item type。

## 完成后可验证

- plan、reasoning summary、命令、工具、文件变更、网页搜索等工作痕迹能进入 timeline。
- 工作痕迹逐条展示，不额外归并成工作痕迹组。
- 工作痕迹默认折叠。
- 工作痕迹位于 Codex/assistant 侧，而不是用户消息侧。

## 非目标

- 不做工作痕迹折叠预览。
- 不做工作痕迹专门复制按钮。
- 不做长内容 30 行展开规则。
- 不把 pending request / approval 作为工作痕迹卡片的业务逻辑处理。
- 不显示工作痕迹时间戳。
