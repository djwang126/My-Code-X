# Codex Conversation View Feature Slice - Unknown Item Field Fallback

- **Type:** AFK
- **Blocked by:** Slice 8
- **Feature requirements covered:** 35, 36, 37

## 目标

保证 My-Code-X 不认识的 Codex item type 不会被丢弃，Codex schema 演进后仍然可观察。

## 垂直路径

- Server 保留未知 item 的 Codex 原生 item type 和原始 payload。
- Server contract 支持未知 item fallback，并复用工作痕迹的通用字段列表 `fields: { name, value }[]`。
- 通用字段列表按 Codex raw payload object entries 的顺序生成和展示，不过滤、不改名、不重新排序。
- 未知 item 的 `codexType` 来自 Codex 原始 type；如果 adapter 已归一为 `unknown`，则使用 `unknownItemKind`。
- Web 把未知 item 渲染为默认折叠卡片。
- 用户展开未知 item 后按字段名和值看到原始 payload；复杂字段值用格式化 JSON 或等价安全文本展示。

## 完成后可验证

- 未知 Codex item type 不会静默消失。
- 展开未知 item 可以看到完整字段列表和复杂字段的格式化 JSON。
- My-Code-X 不对未知 item 自行摘要、改写或伪装成已知工作痕迹。

## 非目标

- 不为未知 item 设计专门字段解释 UI。
- 不推断未知 item 的业务含义。
- 不把未知 item 伪装成 work-trace；它可以复用字段渲染组件，但 product kind 仍保持 unknown。
- 不给未知 item 加专门复制按钮。

## Contract 方向

Slice 10 复用 Slice 8 的通用字段 concept，但保留独立产品语义：

```ts
interface ConversationUnknownItem {
  readonly id: string;
  readonly kind: 'unknown';
  readonly codexType: string;
  readonly fields: readonly ConversationItemField[];
}
```

`ConversationItemField` 与 work-trace 共用。这样字段解析和 UI 渲染可以复用，但 `kind: 'unknown'` 仍明确表达 My-Code-X 当前不认识该 Codex item type。
