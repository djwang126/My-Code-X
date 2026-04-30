# Codex Conversation View Feature Slice - Confirmed User and Assistant Messages

- **Type:** AFK
- **Blocked by:** Slice 2
- **Feature requirements covered:** 1, 2, 3, 4, 6, 9, 10

## 目标

让 Conversation View 能展示后端确认过的用户消息和 assistant message，并形成基础聊天阅读体验。

## 垂直路径

- Server contract 让 conversation item 能表达用户消息和 assistant message。
- Conversation snapshot 只包含后端确认过的用户消息，不包含前端 optimistic message。
- Web 按 timeline 顺序渲染消息。
- 用户消息靠右展示。
- assistant message 靠左展示。
- 用户消息和 assistant message 提供整条消息复制按钮。
- 复制内容使用原始文本。

## 完成后可验证

- 一个 thread 中可以看到用户消息和 assistant message。
- 用户消息与 assistant message 有明显左右区分。
- 未经后端确认的用户消息不会出现在 Conversation View。
- 消息复制结果是原始文本。

## 非目标

- 不做 Markdown 复杂渲染细节。
- 不做代码块复制。
- 不做工作痕迹 item。
- 不提供发送、重试、取消或其他操作控件。
- 不显示消息时间戳。
