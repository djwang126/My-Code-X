# Codex Conversation View Feature Slice - Markdown Rendering Baseline

- **Type:** AFK
- **Blocked by:** Slice 3
- **Feature requirements covered:** 6, 7, 8, 10, 11, 12

## 目标

为用户消息和 assistant message 提供安全、轻量、移动端友好的 Markdown 阅读体验。

## 垂直路径

- Web 对用户消息和 assistant message 按 Markdown 语义渲染。
- 原始 HTML 不作为可信 HTML 执行或渲染。
- Markdown 代码块使用等宽字体展示。
- Markdown 代码块提供单独复制按钮。
- 代码块复制内容使用原始代码文本。
- Markdown 表格在窄屏下使用横向滚动容器。
- 代码块不做语法高亮。

## 完成后可验证

- 列表、代码块、表格、链接等 Markdown 内容可读。
- 原始 HTML 不会破坏页面。
- 代码块可以单独复制。
- 宽表格不会把移动端布局挤坏。

## 非目标

- 不做语法高亮。
- 不做 message 30 行截断。
- 不做工作痕迹长内容展开。
