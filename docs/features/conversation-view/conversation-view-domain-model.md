# Conversation View Domain Model

本文档描述 Conversation View 的领域模型。模型从 feature description 与 BDD statement 中反推，目标是保持实现简单、边界清楚，并避免把 UI 状态或 Codex protocol shape 泄漏进领域层。

## Modeling Principles

- Conversation View 不拥有 Codex `Thread`，只维护 My-Code-X 侧的可读投影。
- 核心领域只保留一个 `Conversation` aggregate。
- Codex app-server 是外部系统，所有 protocol payload 必须先经过 ACL 解析。
- 未确认被 Codex 接受的用户输入不能进入正式 timeline。
- 未识别信息不能静默丢弃。
- 失败信息不能伪装成普通 Codex 回复。
- 页面恢复、同步、连接、banner、滚动、布局、Markdown 渲染属于 application/UI concern，不进入 core domain aggregate。
- 不引入 `Factory`、`Specification`、`CQRS`、`Saga`、`Event Sourcing`，当前复杂度不需要。

## Domain Events

### Timeline

| Event | 含义 |
| --- | --- |
| `DisplayableTimelineItemReceived` | 收到新的可展示 timeline item |
| `AgentMessageDeltaReceived` | 收到 Codex 回复增量 |
| `AgentMessageCompleted` | Codex 回复完成 |
| `WorkProgressStatusChanged` | 工作过程信息状态变化 |
| `ThreadFailureReported` | 当前 Thread 内失败被报告 |

### Composer

| Event | 含义 |
| --- | --- |
| `ComposerDraftChanged` | 当前 Thread 的草稿发生变化 |
| `ComposerDraftCleared` | 当前 Thread 的草稿被清空 |
| `UserInputAccepted` | 普通输入请求被接受 |
| `SteerInputAccepted` | 追加输入请求被接受 |
| `TurnInterruptAccepted` | 中断请求被接受 |

## Commands

### Timeline

| Command | 产生的 Domain Events |
| --- | --- |
| `ReceiveTimelineItem` | `DisplayableTimelineItemReceived` |
| `ApplyAgentMessageDelta` | `AgentMessageDeltaReceived` |
| `CompleteAgentMessage` | `AgentMessageCompleted` |
| `ChangeWorkProgressStatus` | `WorkProgressStatusChanged` |
| `ReportThreadFailure` | `ThreadFailureReported` |

### Composer

| Command | 产生的 Domain Events |
| --- | --- |
| `ChangeComposerDraft` | `ComposerDraftChanged` |
| `SendUserInput` | `UserInputAccepted` / `ComposerDraftCleared` |
| `SendSteerInput` | `SteerInputAccepted` / `ComposerDraftCleared` |
| `InterruptTurn` | `TurnInterruptAccepted` |

## Actors

| Actor | 触发 Commands |
| --- | --- |
| `User` | `ChangeComposerDraft`, `SendUserInput`, `SendSteerInput`, `InterruptTurn` |
| `CodexAppServer` | `ReceiveTimelineItem`, `ApplyAgentMessageDelta`, `CompleteAgentMessage`, `ChangeWorkProgressStatus`, `ReportThreadFailure` |

## Invariants

| Invariant | 规则 |
| --- | --- |
| `CurrentThreadOnly` | Conversation 只展示当前 `ThreadId` 对应内容，不混入其他 Thread |
| `AcceptedInputOnly` | 未被 app-server 接受的用户输入不能进入正式 timeline |
| `OriginalInputPreserved` | 发送给 Codex 的用户原文不能被删改 |
| `DisplayableItemNeverDropped` | 可展示信息不能被静默丢弃；未知类型也必须保留 |
| `TimelineOrderIsAuthoritative` | timeline 顺序以 Codex 历史或 live event 的发生顺序为准 |
| `ClassificationIsStable` | item 分类不能只依赖文本猜测，必须基于可靠类型或明确来源 |
| `FailureIsNotMessage` | 失败信息不能伪装成 Codex 普通回复 |
| `UnknownIsNotFailure` | 未识别信息不能被当作失败信息 |
| `ThreadFailureStaysInTimeline` | 归属于当前 Thread 的失败必须保留在 timeline 中对应位置 |
| `TimelineIdentityMatchesSource` | 来自 Codex `ThreadItem` 的内容必须使用 `codexThreadItem(threadId, turnId, itemId)`；由 failed turn 派生的失败必须使用 `threadScopedFailure(threadId, turnId, message)`；不为失败伪造 `ItemId` |
| `UnscopedFailureStaysOutOfTimeline` | 无法归属到具体 Thread 的错误不能插入 timeline |
| `DraftBelongsToThread` | 草稿必须归属于一个明确的 `ThreadId` |
| `ThreadSwitchKeepsDrafts` | 切换 Thread 不清空其他 Thread 的草稿 |
| `DraftClearsOnlyAfterAcceptedForSameThread` | 只有当前 Thread 的发送请求被接受后，才清空该 Thread 草稿 |
| `DraftPreservedAfterFailureForSameThread` | 当前 Thread 的发送失败时，保留该 Thread 草稿 |
| `ReliableTargetRequired` | 发送、追加、中断必须有可靠目标标识 |
| `NoInventedCodexCopy` | 用户输入、Codex 回复、类型标签、错误 message 不添加 My-Code-X 自创解释文案 |

## Policies

| Policy | 规则 |
| --- | --- |
| `TimelineClassificationPolicy` | `userMessage` / `agentMessage` 归为普通对话；已知工作痕迹类型归为工作过程；明确 Codex failure 归为失败；未知类型归为未知 |
| `UnknownPreservationPolicy` | 未知 item 使用通用结构保留，不阻断阅读或输入 |
| `FailureDedupPolicy` | 同一 FailureSignature 的失败只保留一个 timeline 呈现 |
| `PageNoticePolicy` | My-Code-X 自身错误、连接级 warning、无 `threadId` 的 JSON-RPC error、发送失败等作为页面提示，不进入 timeline |
| `ComposerActionPolicy` | `idle + 有文本` 发送普通输入；`active + 有文本` 发送追加输入；`active + 无文本` 中断当前工作；其他不可靠状态禁用 |
| `InterruptGuardPolicy` | 中断当前工作是高影响动作，必须先确认再发送 interrupt |
| `RequestAcceptancePolicy` | `turn/start` 或 `turn/steer` success response 才代表输入被接受 |
| `WorkProgressStatusPolicy` | 工作过程状态只表达上游提供的状态，不自行推断完成、失败或进行中 |
| `ErrorMessagePolicy` | 失败优先展示上游 `error.message` 或 `turn.error.message`，不重写语义 |

## Failure Conditions

| Failure Condition | 结果 |
| --- | --- |
| `NoSelectedThread` | 不能恢复目标内容，不能发送输入，进入无选中状态 |
| `UnreliableThreadId` | 禁止 `turn/start` / `turn/steer` |
| `MissingExpectedTurnId` | 禁止 active 状态下追加输入 |
| `MissingActiveTurnId` | 禁止中断当前工作 |
| `EmptyInputForSendOrSteer` | 禁止发送普通输入或追加输入 |
| `UserInputRejected` | 草稿保留；输入不进入 timeline；产生页面提示 |
| `SteerInputRejected` | 草稿保留；追加内容不进入 timeline；产生页面提示 |
| `TurnInterruptRejected` | 当前工作不视为已中断；产生页面提示 |
| `ThreadFailureReported` | 作为当前 Thread timeline 内失败信息处理 |
| `UnscopedCodexErrorReported` | 作为页面提示处理，不进入 timeline |
| `UnknownTimelineItemReceived` | 不是失败；进入未知信息保留流程 |

## Entities

| Entity | Identity | 说明 |
| --- | --- | --- |
| `Conversation` | `ThreadId` | 当前 Thread 的 Conversation View 领域投影 |
| `TimelineItem` | `TimelineItemId` | 一条可展示内容；可能来自 Codex `ThreadItem`，也可能由 `threadScopedFailure` 派生 |
| `ComposerDraft` | `ThreadId` | 每个 Thread 一份草稿；切换 Thread 后恢复对应 Thread 的草稿 |

## Value Objects

| Value Object | 说明 |
| --- | --- |
| `ThreadId` | Codex Thread id |
| `TurnId` | Codex turn id |
| `ItemId` | Codex `ThreadItem.id`，只用于 Codex 原生 item |
| `TimelineItemId` | timeline item identity；`codexThreadItem(threadId, turnId, itemId)` 或 `threadScopedFailure(threadId, turnId, message)` |
| `ThreadRef` | `threadId`, `title`, `cwd` |
| `AuthoritativeTime` | Codex 提供的时间信息，例如 `createdAt`、`updatedAt`、`startedAt`、`completedAt` |
| `TimelineKind` | `message`, `workProgress`, `failure`, `unknown` |
| `TimelineStatus` | `running`, `completed`, `failed`, `unknown` |
| `TimelineContent` | message / work progress / failure / unknown 的 discriminated union |
| `DraftText` | 用户输入原文 |
| `FailureSignature` | 重复失败识别用的稳定签名，当前由 `threadId + turnId + error.message` 构成 |

## Aggregate

| Aggregate Root | 包含 | 负责的业务一致性 |
| --- | --- | --- |
| `Conversation` | `ThreadRef`, `TimelineItem[]`, `ComposerDraft` | 当前只对应一个 Thread；可展示 item 不丢；未知 item 保留；失败不伪装成普通回复；未接受输入不进 timeline；当前 Thread 的草稿按接受/失败规则处理 |

## Application State Outside Domain Aggregate

| 状态 | 原因 |
| --- | --- |
| selected thread / no selected thread | 当前查看目标|
| restore / loading / empty / error | 页面恢复流程状态 |
| syncing / reconnecting / stale | 同步和连接体验状态 |
| banner notice lifecycle | UI/application concern |
| scroll follow / reading position | 纯交互状态 |
| button style / safe area / markdown rendering | 纯 UI concern |

## Application Events and State

这些信号有设计价值，但不属于 `Conversation` aggregate 的 Domain Event 或 Command。

### Thread Selection

| Signal | 用途 |
| --- | --- |
| `ThreadSelected` | 标记用户选中了一个 Codex `Thread` 作为当前查看目标 |
| `ThreadCleared` | 标记当前查看目标被清除 |

### Restore and Sync

| Signal | 用途 |
| --- | --- |
| `ConversationRestoreStarted` | 标记内容恢复开始 |
| `ConversationRestoreSucceeded` | 标记内容恢复成功 |
| `ConversationRestoreFailed` | 标记内容恢复失败 |
| `ConversationRestoreProducedNoDisplayableContent` | 标记恢复成功但没有可展示内容 |
| `ConversationContentMarkedStale` | 标记已有内容可能不是最新 |
| `ConversationSyncStarted` | 标记同步开始 |
| `ConversationSyncFailed` | 标记同步失败 |
| `ConversationConnectionRestored` | 标记连接恢复，后续可继续接收更新 |

### Notice

| Signal | 用途 |
| --- | --- |
| `PageNoticeRaised` | 页面级提示被产生 |
| `PageNoticeDismissed` | 页面级提示被关闭 |

### Request Failure

| Signal | 用途 |
| --- | --- |
| `UserInputRejected` | 普通输入请求被拒绝，草稿保留，输入不进入 timeline |
| `SteerInputRejected` | 追加输入请求被拒绝，草稿保留，输入不进入 timeline |
| `TurnInterruptRejected` | 中断请求被拒绝，当前工作不视为已中断 |

## Domain Errors

| Error | 触发条件 | 语义 |
| --- | --- | --- |
| `NoThreadSelected` | 需要当前 `ThreadId`，但当前没有选中 Thread | 当前操作没有明确目标 |
| `ThreadMismatch` | 命令目标 `ThreadId` 与当前 `Conversation.threadId` 不一致 | 禁止把其他 Thread 的内容或结果写入当前 Conversation |
| `TimelineItemNotFound` | 增量、完成、状态更新指向不存在的 `ItemId` | 上游事件无法应用到当前 timeline |
| `UnknownTimelineItemRejected` | 未知 item 缺少可保留的原始 payload | 无法满足“未知信息不丢失” |
| `InvalidTimelineTransition` | item 状态转换不合法，例如已 completed 后继续被标记 running | timeline lifecycle 被破坏 |
| `EmptyComposerDraft` | 尝试 send / steer，但当前 `DraftText` 为空 | 空文本不能发送 |
| `NoReliableThreadTarget` | 发送普通输入时缺少可靠 `ThreadId` | 禁止向不明确目标发送 |
| `NoReliableSteerTarget` | 追加输入时缺少可靠 `ThreadId` 或 `ExpectedTurnId` | 禁止向不明确 active turn 追加 |
| `NoReliableInterruptTarget` | 中断时缺少可靠 `ThreadId` 或 active `TurnId` | 禁止中断不明确目标 |
| `InterruptNotConfirmed` | 尝试 interrupt，但尚未通过确认 | 高影响动作未确认 |

## Repository Interfaces

```ts
interface ConversationRepository {
  get(threadId: ThreadId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
```

| Repository | 负责 | 不负责 |
| --- | --- | --- |
| `ConversationRepository` | 保存 My-Code-X 对某个 Thread 的 Conversation 领域投影，包括 timeline 与该 Thread 的草稿 | 不调用 Codex app-server；不负责恢复、同步、live subscription |

不单独建立 `ThreadRepository`、`TimelineItemRepository`、`ComposerDraftRepository`、`PageNoticeRepository`、`ConnectionRepository`。

## Application Services

| Service | 负责 |
| --- | --- |
| `ConversationQueryService` | 加载当前 Thread 的 Conversation View 数据 |
| `ConversationIngestService` | 接收 Codex 历史或 live item，写入 `Conversation` |
| `ComposerService` | 处理 send / steer / interrupt，维护 per-thread 草稿 |
| `ConversationRecoveryService` | 编排恢复、同步、stale 状态和 page notice |

### ConversationQueryService

```ts
interface ConversationQueryService {
  getConversation(threadId: ThreadId): Promise<ConversationView>;
}
```

流程：

1. 从 `ConversationRepository.get(threadId)` 读取 `Conversation`
2. 从 `Conversation` 读取 per-thread draft
3. 组合为 `ConversationView`
4. 不发起 Codex 请求
5. 不修改领域状态

### ConversationIngestService

```ts
interface ConversationIngestService {
  ingestThreadItems(thread: ThreadRef, items: CodexThreadItem[]): Promise<void>;
  ingestLiveEvent(threadId: ThreadId, event: CodexLiveEvent): Promise<void>;
}
```

流程：

1. parse Codex payload
2. load `Conversation`，不存在则创建
3. 对每个 item 调用 `Conversation.receiveItem(...)`
4. 对 delta / completed / status 调用对应 aggregate 方法
5. domain 内执行分类、未知保留、失败去重、状态转换校验
6. save `Conversation`
7. domain error 显式返回或抛出 typed error

### ComposerService

```ts
interface ComposerService {
  changeDraft(threadId: ThreadId, text: DraftText): Promise<void>;
  send(threadId: ThreadId): Promise<void>;
  steer(threadId: ThreadId, expectedTurnId: TurnId): Promise<void>;
  interrupt(threadId: ThreadId, turnId: TurnId, confirmed: boolean): Promise<void>;
}
```

`changeDraft` 流程：

1. load or create `Conversation(threadId)`
2. 设置该 Conversation 的 `DraftText`
3. save `Conversation`

`send` 流程：

1. load `Conversation` by `threadId`
2. validate draft non-empty
3. 调用 Codex app-server `turn/start`
4. success 后只清空该 `Conversation.threadId` 的 draft
5. failure 保留 draft，并 raise page notice

`steer` 流程：

1. load `Conversation` by `threadId`
2. validate draft non-empty
3. validate `expectedTurnId`
4. 调用 Codex app-server `turn/steer`
5. success 后只清空该 `Conversation.threadId` 的 draft
6. failure 保留 draft，并 raise page notice

`interrupt` 流程：

1. validate `confirmed`
2. validate reliable `threadId`
3. validate active `turnId`
4. 调用 Codex app-server `turn/interrupt`
5. failure raise page notice
6. 不修改 draft

### ConversationRecoveryService

```ts
interface ConversationRecoveryService {
  restore(thread: ThreadRef): Promise<void>;
  sync(thread: ThreadRef): Promise<void>;
  markStale(threadId: ThreadId): Promise<void>;
}
```

`restore` 流程：

1. 标记 application restore state 为 `restoring`
2. 调用 Codex app-server `thread/resume` 或 `thread/turns/list`
3. 成功后交给 `ConversationIngestService.ingestThreadItems`
4. 无可展示内容时记录 empty application state
5. 失败时记录 restore failed application state
6. 已有内容存在时不清空旧内容

`sync` 流程：

1. 标记 application sync state
2. 拉取或恢复当前内容
3. 成功后 ingest
4. 失败时保留旧 conversation，标记 stale 或 raise page notice

`markStale` 流程：

1. 只更新 application state
2. 不修改 `Conversation` aggregate

## Domain Services

| Service | 负责 | 输入 | 输出 |
| --- | --- | --- | --- |
| `TimelineClassifier` | 把已解析的 Codex item 归类为 My-Code-X 的 `TimelineContent` | `CodexItem` | `message` / `workProgress` / `failure` / `unknown` |
| `FailureDeduper` | 判断当前失败是否已经存在 | `FailureSignature`, existing signatures | `new` / `duplicate` |
| `ComposerPolicy` | 判断当前 Composer 可执行动作 | `ThreadStatus`, `DraftText`, target ids | `ComposerAction` |
| `NoticeClassifier` | 判断错误进入 timeline 还是 page notice | parsed error with thread scope | `timelineFailure` / `pageNotice` |

### TimelineClassifier

| 输入条件 | 输出 |
| --- | --- |
| `userMessage` | `TimelineContent.message(role=user)` |
| `agentMessage` | `TimelineContent.message(role=agent)` |
| 已知工作过程类型 | `TimelineContent.workProgress(...)` |
| Thread 内明确失败 | `TimelineContent.failure(...)` |
| 未知 item type | `TimelineContent.unknown(...)` |

约束：

- 不根据 message 文本内容推断类型。
- 未知 item 必须输出 `unknown` 并保留 payload，除非 payload 无法保留。
- message、type label、error message 保留上游语义。

### FailureDeduper

| 输入条件 | 输出 |
| --- | --- |
| signature 已存在 | `duplicate` |
| signature 不存在 | `new` |

约束：

- 去重只影响展示。
- signature 必须稳定。
- 不做模糊匹配。

### ComposerPolicy

| 条件 | 输出 |
| --- | --- |
| `idle` + 非空 `DraftText` + 可靠 `ThreadId` | `send` |
| `active` + 非空 `DraftText` + 可靠 `ThreadId` + `ExpectedTurnId` | `steer` |
| `active` + 空 `DraftText` + reliable `ThreadId` + reliable active `TurnId` + confirmed | `interrupt` |
| 其他 | `disabled(reason)` |

约束：

- 空文本不能 send / steer。
- 不修改草稿。
- 不调用 app-server。

### NoticeClassifier

| 输入条件 | 输出 |
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

## ACL

| ACL | 方向 | 负责 |
| --- | --- | --- |
| `CodexConversationACL` | Codex app-server -> Domain | 把 Codex `Thread`、`ThreadItem`、live event、error 转成 My-Code-X domain input |
| `CodexTurnCommandACL` | Domain/Application -> Codex app-server | 把 send / steer / interrupt 转成 Codex request payload |

### CodexConversationACL

| 输入 | 输出 |
| --- | --- |
| Codex `Thread` | `ThreadRef` |
| Codex `ThreadItem` | `CodexItem` |
| Codex live event | `CodexItemPatch` / `CodexItemCompletion` / `CodexWorkProgressStatus` / `CodexThreadFailure` |
| Codex scoped error | `ScopedFailureInput` |
| Codex unscoped error / warning | `PageNoticeInput` |

规则：

- Codex payload 只在 ACL 边界解析和校验。
- 不重写 Codex message、type、status、error message。
- 必需字段缺失时返回 typed boundary error。
- domain 不直接依赖 JSON-RPC 字段名或原始 protocol shape。
- 未知 `ThreadItem.type` 转成可保留 payload，不丢弃。

### CodexTurnCommandACL

| 输入 | Codex request |
| --- | --- |
| `SendUserInput(threadId, input)` | `turn/start` |
| `SteerInput(threadId, expectedTurnId, input)` | `turn/steer` |
| `InterruptTurn(threadId, turnId)` | `turn/interrupt` |

规则：

- 每个发送给 Codex 的参数必须来自明确决策。
- 用户原文进入 `UserInput[]` 时不删改。
- 缺少 `threadId`、`expectedTurnId`、`turnId` 时不构造 request。
- JSON-RPC error 转成 typed application failure，不吞掉 code/message/details。
