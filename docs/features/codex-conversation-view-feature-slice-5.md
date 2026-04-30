# Codex Conversation View Feature Slice - Link and Workspace Reference Rendering

- **Type:** AFK
- **Blocked by:** Slice 4
- **Feature requirements covered:** 13, 14

## 目标

区分普通外部链接和 workspace 文件引用，避免用户把本地项目文件和网页链接混淆。

## 垂直路径

- Web 中普通 Markdown 外部链接新标签页打开。
- Web 中 workspace 文件引用与普通外部链接做视觉区分。
- workspace 文件引用不触发打开本地文件行为。

## 完成后可验证

- 点击普通网页链接不会打断当前对话页面。
- workspace 文件引用看起来不同于普通网页链接。
- workspace 文件引用当前不能打开本地文件。

## 非目标

- 不实现 workspace 文件打开。
- 不设计文件预览。
- 不处理文件跳转或编辑器集成。
