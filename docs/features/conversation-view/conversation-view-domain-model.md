# Conversation View Domain Model v3

本文档描述 Conversation View 的领域模型——即实现领域层时不可违反的结构、规则与边界。

---

## Modeling Principles

这些公理定义了本 bounded context 的设计温度。新增概念前必须先对照本章——如果违反，要么有更强的理由推翻公理，要么是设计错误。

- Conversation View 不拥有 Codex `Thread`，只维护 My-Code-X 侧的可读投影。所有 Codex 数据经过 ACL 翻译后才进入领域。
- 核心领域只保留一个 `Conversation` aggregate。
- 未确认被 Codex 接受的用户输入不能进入正式 timeline。
- 未识别信息不能静默丢弃。
- 失败信息不能伪装成普通 Codex 回复。
- 不引入 `Factory`、`Specification`、`CQRS`、`Saga`、`Event Sourcing`，当前复杂度不需要。
- Application Service 的编排流程、Application Event、UI state、Markdown 渲染、滚动、布局、banner 生命周期不属于本模型。

---

## Entities

| Entity | Identity | 说明 |
| --- | --- | --- |
| `Conversation` | `ThreadId` | 当前 Thread 的 Conversation View 领域投影 |
| `TimelineItem` | `TimelineItemId` | 一条可展示内容；来自 Codex `ThreadItem` 或由 `threadScopedFailure` 派生 |

---

## Value Objects

| Value Object | 说明 |
| --- | --- |
| `ThreadId` | Codex Thread id |
| `TurnId` | Codex turn id。在 Composer 上下文中，steer 和 interrupt 需要的 `activeTurnId: TurnId` 指 Thread 当前 active 的那个 turn，即 Codex 协议中的 `expectedTurnId` |
| `ItemId` | Codex `ThreadItem.id`，仅用于 Codex 原生 item |
| `TimelineItemId` | `codexThreadItem(threadId, turnId, itemId)` 或 `threadScopedFailure(threadId, turnId, message)`。来自 Codex `ThreadItem` 的内容使用前者；由 failed turn 派生的失败使用后者；不为失败伪造 `ItemId` |
| `ThreadRuntimeContext` | 当前 Thread 的运行时快照：`threadId`、`status`（`idle` / `active`）、`activeTurnId`（`status = active` 时存在） |
| `ComposerTarget` | 当前 Composer 的合法操作目标，由 `ComposerPolicy` 从 `ThreadRuntimeContext` 本地派生。取值：`Disabled(reason)` / `Send(threadId)` / `Steer(threadId, activeTurnId)` / `Interrupt(threadId, activeTurnId)` |
| `AuthoritativeTime` | Codex 提供的时间信息，如 `createdAt`、`updatedAt`、`startedAt`、`completedAt` |
| `TimelineKind` | `message` / `workProgress` / `failure` / `unknown` |
| `TimelineStatus` | `inProgress` / `completed` / `failed` / `declined` / `unknown` |
| `TimelineContent` | `message` / `workProgress` / `failure` / `unknown` 的 discriminated union |
| `InputText` | 用户输入原文 |
| `FailureSignature` | 由 `threadId + turnId + error.message` 构成的稳定签名 |
| `CodexItem` | ACL 解析后的 Codex `ThreadItem` 领域表示 |
| `CodexItemPatch` | ACL 解析后的 live event 内容增量 |
| `CodexItemStatusChange` | ACL 解析后的 live event 状态变更 |
| `ScopedFailureInput` | ACL 解析后的 Thread 归属失败 |
| `PageNoticeInput` | ACL 解析后的非 Thread 归属错误或 warning |

---

## Aggregate

### Conversation

| Aggregate Root | 数据 | Invariant |
| --- | --- | --- |
| `Conversation` | `threadId: ThreadId`，`timelineItems: TimelineItem[]` | 见下方 |

**能力与规则**（声明 aggregate 对外暴露的操作，每个操作由哪条 invariant 约束、产生什么 event、可能抛什么 error）：

| 操作 | Invariant | 产生的 Event | 可能的 Error |
| --- | --- | --- | --- |
| 接收一个新 timeline item | `CurrentThreadOnly`，`DisplayableItemNeverDropped`，`ClassificationIsStable`，`FailureIsNotMessage`，`UnknownIsNotFailure` | `TimelineItemReceived` | `ThreadMismatch`，`UnknownTimelineItemRejected` |
| 更新已有 item 的内容 | `CurrentThreadOnly`，`TimelineOrderIsAuthoritative` | `TimelineItemContentUpdated` | `ThreadMismatch`，`TimelineItemNotFound`，`InvalidTimelineTransition` |
| 更新已有 item 的状态 | `CurrentThreadOnly` | `TimelineItemStatusChanged` | `ThreadMismatch`，`TimelineItemNotFound`，`InvalidTimelineTransition` |
| 报告一个 Thread 内失败 | `FailureIsNotMessage`，`ThreadFailureStaysInTimeline`，`FailureDedup` | `ThreadFailureReported` | `ThreadMismatch` |

**领域不变式**：

| Invariant | 规则 |
| --- | --- |
| `CurrentThreadOnly` | Conversation 只展示当前 `ThreadId` 对应内容，不混入其他 Thread |
| `AcceptedInputOnly` | 未被 Codex 接受的用户输入不能进入正式 timeline |
| `OriginalInputPreserved` | 发送给 Codex 的用户原文不能被删改 |
| `DisplayableItemNeverDropped` | 可展示信息不能被静默丢弃；未知类型也必须保留 |
| `TimelineOrderIsAuthoritative` | timeline 顺序以 Codex 历史或 live event 的发生顺序为准 |
| `ClassificationIsStable` | item 分类不能只依赖文本猜测，必须基于可靠类型或明确来源 |
| `FailureIsNotMessage` | 失败信息不能伪装成 Codex 普通回复 |
| `UnknownIsNotFailure` | 未识别信息不能被当作失败信息 |
| `ThreadFailureStaysInTimeline` | 归属于当前 Thread 的失败保留在 timeline 中对应位置 |
| `UnscopedFailureStaysOutOfTimeline` | 无法归属到具体 Thread 的错误不能插入 timeline |
| `ReliableTargetRequired` | Composer send / steer / interrupt 必须有可靠目标（`ThreadId` 或 `ThreadId + activeTurnId`） |
| `FailureDedup` | 同一 `FailureSignature` 的失败不重复出现在 timeline 中 |

---

## Domain Events

所有 Domain Event 由 aggregate 操作产生。

| Event | 携带数据 | 产生自 |
| --- | --- | --- |
| `TimelineItemReceived` | `threadId`, `timelineItemId`, `kind`, `content` | 接收新 item |
| `TimelineItemContentUpdated` | `threadId`, `timelineItemId`, `content` | 更新已有 item 内容 |
| `TimelineItemStatusChanged` | `threadId`, `timelineItemId`, `status` | 更新已有 item 状态 |
| `ThreadFailureReported` | `threadId`, `timelineItemId`, `failure` | 报告 Thread 内失败 |

---

## Domain Errors

| Error | 触发操作 | 触发条件 | 语义 |
| --- | --- | --- | --- |
| `ThreadMismatch` | 任何 aggregate 操作 | 操作目标 `ThreadId` ≠ aggregate `threadId` | 禁止跨 Thread 写入 |
| `UnknownTimelineItemRejected` | 接收新 item | 未知 item 缺少可保留的原始 payload | 违反 `DisplayableItemNeverDropped` |
| `TimelineItemNotFound` | 更新内容 / 更新状态 | `ItemId` 不在当前 timeline 中 | 上游事件无对应 item |
| `InvalidTimelineTransition` | 更新内容 / 更新状态 | 状态转换不合法（如已 completed 又回到 inProgress） | timeline lifecycle 被破坏 |
| `EmptyComposerInput` | send / steer | `InputText` 为空 | 空文本不能发送 |
| `NoReliableThreadTarget` | send | 缺少可靠 `ThreadId` | 不能向不明确目标发送 |
| `NoReliableSteerTarget` | steer | 缺少可靠 `ThreadId` 或 `activeTurnId` | 不能向不明确 active turn 追加 |
| `NoReliableInterruptTarget` | interrupt | 缺少可靠 `ThreadId` 或 `activeTurnId` | 不能中断不明确目标 |
| `ThreadNotActive` | steer / interrupt | Thread 不在 active 状态 | 操作需要 active turn，当前没有 |
| `ThreadNotIdle` | send | Thread 不是 idle 状态 | 当前有 active turn 正在进行，应使用 steer |
| `InterruptNotConfirmed` | interrupt | 未通过防误触确认 | 高影响动作未经确认 |

---

## Domain Services

纯函数。不访问 I/O，不修改 aggregate。声明输入→输出映射和约束。

### TimelineClassifier

把 `CodexItem` 分类为 `TimelineContent`。

| 输入 | 输出 |
| --- | --- |
| `ThreadItem.type = userMessage` | `TimelineContent.message(role=user)` |
| `ThreadItem.type = agentMessage` | `TimelineContent.message(role=agent)` |
| 已知工作过程类型 | `TimelineContent.workProgress(...)` |
| Thread 内明确失败 | `TimelineContent.failure(...)` |
| 未知 `ThreadItem.type` | `TimelineContent.unknown(...)` |

已知工作过程类型：`hookPrompt`、`reasoning`、`commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`webSearch`、`imageView`、`imageGeneration`、`enteredReviewMode`、`exitedReviewMode`、`contextCompaction`。

约束：
- 不根据 message 文本内容推断类型。
- 未知 item 输出 `unknown` 并保留 payload（不可保留时触发 `UnknownTimelineItemRejected`）。
- 不重写 Codex message、type label、error message。
- 状态表达上游提供的值，不自行推断完成、失败或进行中。

### FailureDeduper

| 输入 | 输出 |
| --- | --- |
| `FailureSignature` 已存在于当前 timeline | `duplicate` |
| `FailureSignature` 不存在 | `new` |

约束：
- 去重只影响展示。
- 签名必须稳定。
- 不做模糊匹配。

### ComposerPolicy

从 `ThreadRuntimeContext` 本地派生 `ComposerTarget`。不依赖服务端指令。

| 条件 | `ComposerTarget` |
| --- | --- |
| `threadId = null` | `Disabled(NoSelectedThread)` |
| `status` 不可靠 | `Disabled(UnclearState)` |
| `status = idle` | `Send(threadId)` |
| `status = active` + `activeTurnId` 存在 | `Steer(threadId, activeTurnId)` 或 `Interrupt(threadId, activeTurnId)` |

约束：
- `ComposerPolicy` 不判断用户是否输入了内容——输入文本是 application state。Policy 只回答"当前 Thread 状态下哪些操作在法律上是可能的"。
- 具体选 `Steer` 还是 `Interrupt` 由 UI 结合 Composer draft 决定。
- `ComposerTarget` 已携带操作所需的全部参数，调用方无需再次查询 Thread runtime。

### NoticeClassifier

判断错误的展示归属。

| 输入 | 输出 |
| --- | --- |
| 错误归属于当前 Thread | `timelineFailure` |
| 错误无 `threadId` | `pageNotice` |
| My-Code-X 本地错误 | `pageNotice` |
| connection / config warning | `pageNotice` |
| composer request failure | `pageNotice` |

约束：
- Thread 内失败进 timeline。
- 无归属错误不进 timeline。
- 保留原始 message 和可排查字段。
- 优先展示上游 `error.message` 或 `turn.error.message`，不重写语义。

---

## Repository

```ts
interface ConversationRepository {
  get(threadId: ThreadId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
```

| 负责 | 不负责 |
| --- | --- |
| 持久化 My-Code-X 对某个 Thread 的 Conversation 领域投影（含 timeline） | 不调用 Codex app-server；不负责恢复、同步、live subscription；不保存 Composer draft |

---

## ACL

### CodexConversationACL

方向：Codex app-server → Domain

| Codex 输入 | 领域输出 |
| --- | --- |
| Codex `Thread` 标识 | `ThreadId` |
| Codex `Thread` runtime/status | `ThreadRuntimeContext` |
| Codex `ThreadItem` | `CodexItem` |
| Codex live event (delta) | `CodexItemPatch` |
| Codex live event (status change) | `CodexItemStatusChange` |
| Codex 有 `threadId` 的错误 | `ScopedFailureInput` |
| Codex 无 `threadId` 的错误 / warning | `PageNoticeInput` |

规则：
- Codex payload 只在 ACL 边界解析和校验。Domain 不直接依赖 JSON-RPC 字段名或原始 protocol shape。
- 不重写 Codex message、type、status、error message。
- 必需字段缺失时返回 typed boundary error。
- 未知 `ThreadItem.type` 转成可保留 payload，不丢弃。

### CodexTurnCommandACL

方向：Application → Codex app-server

| 领域输入 | Codex request |
| --- | --- |
| `send(threadId, input)` | `turn/start` |
| `steer(threadId, activeTurnId, input)` | `turn/steer` |
| `interrupt(threadId, activeTurnId)` | `turn/interrupt` |

规则：
- 每个发送给 Codex 的参数来自明确的领域决策。
- 用户原文进入 `UserInput[]` 时不删改。
- 缺少必要标识时不构造 request。
- JSON-RPC error 转成 typed application failure，不吞掉 code/message/details。

---

## Design Decisions

记录不是显而易见的取舍。防止后来者善意重构时踩坑。

### 为什么 Composer 没有自己的 aggregate

Composer 的本质操作是验证 → 调用 Codex → 等 Codex 回报。用户输入最终通过 Codex 回报 `userMessage` item → `Conversation.receiveItem()` 进入 timeline，而不是由 Composer 直接写入 aggregate。Composer 的领域价值集中在 `ComposerPolicy`（派生 `ComposerTarget`）和 domain errors（参数与状态校验），不需要独立 aggregate。

### 为什么 ComposerTarget 是本地派生而非服务端下发

`ComposerTarget` 回答的是"在当前 Thread 状态下，Composer 可以做什么"——这是 My-Code-X 的领域决策。服务端只提供原始事实（`ThreadRuntimeContext`），不能替 My-Code-X 决定哪些操作是合法的。

### 为什么 agentMessage 和 workProgress 走统一的 item lifecycle events

两者的生命周期模式相同：出现 → 内容增量更新 → 完成。用 `TimelineItemContentUpdated` + `TimelineItemStatusChanged` 覆盖所有 item 类型，避免为每种 item type 创建专用 event。当前不需要差异化。

### 为什么 ThreadRef（title, cwd）不在 aggregate 中

title 和 cwd 是展示元数据，不参与任何 invariant 的校验，不需要与 `TimelineItem[]` 保持事务一致性。它们来自 Codex 只读投影，属于 application read model。

### 为什么 `NoInventedCodexCopy` 不是领域 invariant

"不添加自创解释文案"是 UI 渲染规则。Aggregate 不可能"发明文案"——它只存储 Codex 原始数据。这是 BDD 层面的约束，不属于领域模型。

### 为什么没有独立 Command 对象

当前每个写操作的输入→event 是 1:1 映射，不存在"一条命令可能产生不同事件"或"合法命令但不产生事件"的路径。用 aggregate 方法直接替代 Command 对象，复杂度刚好。

### 为什么 FailureDedup 的签名由 threadId + turnId + error.message 构成

去重需要稳定签名。`threadId` 限定上下文，`turnId` 定位具体 turn，`error.message` 区分不同失败原因。不做模糊匹配，避免误去重导致用户看不到不同原因但相似文案的失败。

### ComposerPolicy 为什么不判断用户有无输入

输入文本是 application state（Composer draft），不在 domain 中。Policy 只声明当前 Thread 状态下 *可以* 做什么。UI 拿到 `ComposerTarget` 后结合 draft 状态决定具体按钮：有输入 → Steer，无输入 → Interrupt。

### 为什么 activeTurnId 在领域层统一命名而非沿用 Codex 的 expectedTurnId

`expectedTurnId` 的 "expected" 语义是 Codex 协议层面的校验提示。在 My-Code-X 领域层，这个值始终表示"当前 Thread 正在执行的唯一 active turn"。统一命名消除三个概念（turnId / activeTurnId / expectedTurnId）之间的假性差异。
