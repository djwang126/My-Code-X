## What to build

增强 message reading 的移动端阅读体验，让已恢复的 message 内容按设计支持 Markdown 阅读和复制相关交互。

References:
- `conversation-view-feature-description.md`: `Message reading`, `Conversation View shell`
- `conversation-view-api-contract.md`: `MessageContent`, `DisplayDetail`
- `conversation-view-UImock.html`: message 样式参考

Acceptance focus:
- 正文渲染行为以 `MessageContent.markdown` 和 `copyText` 为准。
- 窄屏下代码块和表格应保持可读，不破坏整体 conversation layout。
- 复制行为只复制 contract 中允许复制的原文或代码内容。

Out of scope:
- 不改变 message DTO。
- 不新增文件引用浏览能力。
- 不实现 work progress 的专用渲染。

## Blocked by

- 003-restore-message-history.md
