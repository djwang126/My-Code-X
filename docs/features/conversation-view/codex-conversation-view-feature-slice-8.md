# Codex Conversation View Feature Slice - Work Trace Item Cards

- **Type:** AFK
- **Blocked by:** Slice 6
- **Feature requirements covered:** 5, 25, 26, 27, 28, 33, 34

## 目标

展示 Codex 原生工作痕迹 item，让 Conversation View 不像黑盒，同时保持移动端可读。

## 垂直路径

- Server contract 支持工作痕迹 item。
- Server 从 Codex 原生 item 映射工作痕迹，不发明额外语义。
- 工作痕迹 contract 使用 `codexType` 表示 Codex 原生 item type。
- 工作痕迹 contract 使用通用字段列表 `fields: { name, value }[]` 展示 Codex 原始 payload 中的字段名和值。
- 通用字段列表按 Codex raw payload object entries 的顺序生成和展示，保留 `type`、`id`、`status` 等原始字段，不过滤、不改名、不重新排序、不解释为 My-Code-X 自定义标题或摘要。
- Runtime delta 形成临时工作痕迹 snapshot 时，Server 先按 Codex 原生 notification shape 和目标字段/index 构造 raw-like payload，再从该 payload 生成通用字段列表；不得把实现层的 `channels`、单一 `text` 或 last-delta-wins 结果暴露为工作痕迹语义。
- 已知工作痕迹 item type 包括 `hookPrompt`、`plan`、`reasoning`、`commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`webSearch`、`imageView`、`imageGeneration`、`enteredReviewMode`、`exitedReviewMode`、`contextCompaction`。
- `userMessage` 仍投影为 user message；`agentMessage` 仍投影为 assistant message；`unknown` 不伪装成 work-trace，留给 Slice 10 的 unknown fallback。
- 工作痕迹按后端权威顺序逐条进入 timeline。
- Web 把工作痕迹作为 Codex/assistant 侧内容展示，不能使用用户消息样式。
- Web 使用 `codexType` 作为折叠卡片标题。
- 工作痕迹默认折叠。
- 展开后按字段名和值逐项展示；复杂字段值用格式化 JSON 或等价安全文本展示。

## 完成后可验证

- hook prompt、plan、reasoning、命令、工具、文件变更、网页搜索等工作痕迹能进入 timeline。
- 工作痕迹逐条展示，不额外归并成工作痕迹组。
- 工作痕迹默认折叠。
- 工作痕迹位于 Codex/assistant 侧，而不是用户消息侧。
- 工作痕迹标题显示 Codex 原生 item type。
- 展开工作痕迹后能看到 Codex 原始字段名和值。
- 字段显示顺序与 Codex raw payload 字段顺序一致。

## 非目标

- 不做工作痕迹折叠预览。
- 不做工作痕迹专门复制按钮。
- 不做长内容 30 行展开规则。
- 不把 pending request / approval 作为工作痕迹卡片的业务逻辑处理。
- 不显示工作痕迹时间戳。

## Contract 方向

Slice 8 的工作痕迹 item 使用 raw-first 的通用字段方案：

```ts
interface ConversationWorkTraceItem {
  readonly id: string;
  readonly kind: 'work-trace';
  readonly codexType: string;
  readonly fields: readonly ConversationItemField[];
}

interface ConversationItemField {
  readonly name: string;
  readonly value: JsonValue;
}
```

`codexType` 来自 Codex `ThreadItem.type` / runtime `itemKind`。`fields` 从 Codex raw payload 的 object entries 生成，并保留 raw payload 字段顺序。My-Code-X 不需要理解每个字段含义，也不从字段中提炼 title、label 或 summary。

对 runtime delta 投影出的临时工作痕迹，`fields` 来自 Codex-aware raw-like payload，而不是来自 My-Code-X 自创的 delta channel。示例：reasoning delta 应投影为包含 `summary` / `content` 的 payload；file change patch 应投影为包含 `changes` 的 payload；command output 应投影为包含输出字段的 payload。completed item 到来后，以 completed item 的 Codex raw payload 为准。
