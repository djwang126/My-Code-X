# Codex Conversation View Feature Slice - Unknown Item JSON Fallback

- **Type:** AFK
- **Blocked by:** Slice 8
- **Feature requirements covered:** 35, 36, 37

## 目标

保证 My-Code-X 不认识的 Codex item type 不会被丢弃，Codex schema 演进后仍然可观察。

## 垂直路径

- Server 保留未知 item 的原始 payload。
- Server contract 支持未知 item fallback。
- Web 把未知 item 渲染为默认折叠卡片。
- 用户展开未知 item 后看到格式化 JSON。

## 完成后可验证

- 未知 Codex item type 不会静默消失。
- 展开未知 item 可以看到完整格式化 JSON。
- My-Code-X 不对未知 item 自行摘要或改写。

## 非目标

- 不为未知 item 设计专门 UI。
- 不推断未知 item 的业务含义。
- 不给未知 item 加专门复制按钮。
