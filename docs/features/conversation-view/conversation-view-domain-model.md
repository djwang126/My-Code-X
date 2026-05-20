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

## Domain Events

### Thread Selection

| Event | 含义 |
| --- | --- |
| `ThreadSelected` | 用户选中了一个 Codex `Thread` |
| `ThreadCleared` | 当前选中 Thread 被清除 |

### Restore and Sync

| Event | 含义 |
| --- | --- |
| `ConversationRestoreStarted` | Conversation 内容恢复开始 |
| `ConversationRestoreSucceeded` | Conversation 内容恢复成功 |
| `ConversationRestoreFailed` | Conversation 内容恢复失败 |
| `ConversationRestoreProducedNoDisplayableContent` | 恢复成功但没有可展示内容 |
| `ConversationContentMarkedStale` | 已有内容被标记为可能不是最新 |
| `ConversationSyncStarted` | Conversation 同步开始 |
| `ConversationSyncFailed` | Conversation 同步失败 |
| `ConversationConnectionRestored` | 连接恢复，后续可继续接收更新 |

### Timeline

| Event | 含义 |
| --- | --- |
| `DisplayableTimelineItemReceived` | 收到新的可展示 timeline item |
| `TimelineItemClassifiedAsMessage` | timeline item 被分类为普通对话内容 |
| `TimelineItemClassifiedAsWorkProgress` | timeline item 被分类为工作过程信息 |
| `TimelineItemClassifiedAsFailure` | timeline item 被分类为失败信息 |
| `TimelineItemClassifiedAsUnknown` | timeline item 被分类为未识别信息 |
| `UnknownTimelineItemPreserved` | 未识别信息被保留 |
| `AgentMessageDeltaReceived` | 收到 Codex 回复增量 |
| `AgentMessageCompleted` | Codex 回复完成 |
| `WorkProgressStatusChanged` | 工作过程信息状态变化 |
| `ThreadFailureReported` | 当前 Thread 内失败被报告 |
| `RepeatedFailureSuppressed` | 重复失败被抑制展示 |

### Notice

| Event | 含义 |
| --- | --- |
| `PageNoticeRaised` | 页面级提示被产生 |
| `PageNoticeDismissed` | 页面级提示被关闭 |

### Composer

| Event | 含义 |
| --- | --- |
| `ComposerDraftChanged` | 当前 Thread 的草稿发生变化 |
| `ComposerDraftPreserved` | 当前 Thread 的草稿被保留 |
| `ComposerDraftCleared` | 当前 Thread 的草稿被清空 |
| `UserInputAccepted` | 普通输入请求被接受 |
| `UserInputRejected` | 普通输入请求被拒绝 |
| `SteerInputAccepted` | 追加输入请求被接受 |
| `SteerInputRejected` | 追加输入请求被拒绝 |
| `TurnInterruptConfirmed` | 用户确认中断当前工作 |
| `TurnInterruptAccepted` | 中断请求被接受 |
| `TurnInterruptRejected` | 中断请求被拒绝 |

## Commands

### Thread Selection

| Command | 产生的 Domain Events |
| --- | --- |
| `SelectThread` | `ThreadSelected` |
| `ClearSelectedThread` | `ThreadCleared` |

### Restore and Sync

| Command | 产生的 Domain Events |
| --- | --- |
| `RestoreConversation` | `ConversationRestoreStarted` |
| `AcceptConversationRestore` | `ConversationRestoreSucceeded` |
| `RejectConversationRestore` | `ConversationRestoreFailed` |
| `RecordNoDisplayableContent` | `ConversationRestoreProducedNoDisplayableContent` |
| `MarkConversationContentStale` | `ConversationContentMarkedStale` |
| `SyncConversation` | `ConversationSyncStarted` |
| `RejectConversationSync` | `ConversationSyncFailed` |
| `RecordConnectionRestored` | `ConversationConnectionRestored` |

### Timeline

| Command | 产生的 Domain Events |
| --- | --- |
| `ReceiveTimelineItem` | `DisplayableTimelineItemReceived` |
| `ClassifyTimelineItem` | `TimelineItemClassifiedAsMessage` / `TimelineItemClassifiedAsWorkProgress` / `TimelineItemClassifiedAsFailure` / `TimelineItemClassifiedAsUnknown` |
| `PreserveUnknownTimelineItem` | `UnknownTimelineItemPreserved` |
| `ApplyAgentMessageDelta` | `AgentMessageDeltaReceived` |
| `CompleteAgentMessage` | `AgentMessageCompleted` |
| `ChangeWorkProgressStatus` | `WorkProgressStatusChanged` |
| `ReportThreadFailure` | `ThreadFailureReported` |
| `SuppressRepeatedFailure` | `RepeatedFailureSuppressed` |

### Notice

| Command | 产生的 Domain Events |
| --- | --- |
| `RaisePageNotice` | `PageNoticeRaised` |
| `DismissPageNotice` | `PageNoticeDismissed` |

### Composer

| Command | 产生的 Domain Events |
| --- | --- |
| `ChangeComposerDraft` | `ComposerDraftChanged` |
| `PreserveComposerDraft` | `ComposerDraftPreserved` |
| `ClearComposerDraft` | `ComposerDraftCleared` |
| `SendUserInput` | `UserInputAccepted` / `UserInputRejected` |
| `SendSteerInput` | `SteerInputAccepted` / `SteerInputRejected` |
| `ConfirmTurnInterrupt` | `TurnInterruptConfirmed` |
| `InterruptTurn` | `TurnInterruptAccepted` / `TurnInterruptRejected` |

## Actors

| Actor | 触发 Commands |
| --- | --- |
| `User` | `SelectThread`, `ClearSelectedThread`, `ChangeComposerDraft`, `SendUserInput`, `SendSteerInput`, `ConfirmTurnInterrupt`, `InterruptTurn`, `DismissPageNotice` |
| `ConversationView` | `RestoreConversation`, `SyncConversation`, `MarkConversationContentStale`, `RecordNoDisplayableContent`, `PreserveComposerDraft`, `ClearComposerDraft`, `RaisePageNotice` |
| `CodexAppServer` | `AcceptConversationRestore`, `RejectConversationRestore`, `RejectConversationSync`, `RecordConnectionRestored`, `ReceiveTimelineItem`, `ApplyAgentMessageDelta`, `CompleteAgentMessage`, `ChangeWorkProgressStatus`, `ReportThreadFailure` |
| `TimelineClassifier` | `ClassifyTimelineItem`, `PreserveUnknownTimelineItem` |
| `FailureDeduper` | `SuppressRepeatedFailure` |
| `ComposerPolicy` | `SendUserInput`, `SendSteerInput`, `InterruptTurn` |

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
| `ConversationRestorePolicy` | 打开或切换 Thread 后恢复内容；无内容是正常状态，不等同失败 |
| `ConversationFreshnessPolicy` | 已有内容可读但无法确认最新时，保留已有内容，标记为可能过期并继续尝试同步 |
| `TimelineClassificationPolicy` | `userMessage` / `agentMessage` 归为普通对话；已知工作痕迹类型归为工作过程；明确 Codex failure 归为失败；未知类型归为未知 |
| `UnknownPreservationPolicy` | 未知 item 使用通用结构保留，不阻断阅读或输入 |
| `FailureDedupPolicy` | 同一个失败被重复报告时，只保留一个对用户有意义的失败呈现 |
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
| `RestoreRequestFailed` | 如果无可读内容，进入恢复失败；如果已有内容，保留内容并提示 |
| `SyncRequestFailed` | 保留已有内容，标记同步失败或可能过期 |
| `ConnectionUnavailable` | 禁用发送；草稿保留；产生页面提示 |
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
| `TimelineItem` | `ItemId` | 一条可展示内容，可被更新、完成、分类 |
| `ComposerDraft` | `ThreadId` | 每个 Thread 一份草稿；切换 Thread 后恢复对应 Thread 的草稿 |

## Value Objects

| Value Object | 说明 |
| --- | --- |
| `ThreadId` | Codex Thread id |
| `TurnId` | Codex turn id |
| `ItemId` | Codex item id |
| `ThreadRef` | `threadId`, `title`, `cwd` |
| `TimelineKind` | `message`, `workProgress`, `failure`, `unknown` |
| `TimelineStatus` | `running`, `completed`, `failed`, `unknown` |
| `TimelineContent` | message / work progress / failure / unknown 的 discriminated union |
| `DraftText` | 用户输入原文 |
| `FailureSignature` | 重复失败识别用的稳定签名 |

## Aggregate

| Aggregate Root | 包含 | 负责的业务一致性 |
| --- | --- | --- |
| `Conversation` | `ThreadRef`, `TimelineItem[]`, `ComposerDraft` | 当前只对应一个 Thread；可展示 item 不丢；未知 item 保留；失败不伪装成普通回复；未接受输入不进 timeline；当前 Thread 的草稿按接受/失败规则处理 |

## Application State Outside Domain Aggregate

| 状态 | 原因 |
| --- | --- |
| restore / loading / empty / error | 页面恢复流程状态 |
| syncing / reconnecting / stale | 同步和连接体验状态 |
| banner notice lifecycle | UI/application concern |
| scroll follow / reading position | 纯交互状态 |
| button style / safe area / markdown rendering | 纯 UI concern |

## Domain Errors

| Error | 触发条件 | 语义 |
| --- | --- | --- |
| `NoThreadSelected` | 需要当前 `ThreadId`，但当前没有选中 Thread | 当前操作没有明确目标 |
| `ThreadMismatch` | 命令目标 `ThreadId` 与当前 `Conversation.threadId` 不一致 | 禁止把其他 Thread 的内容或结果写入当前 Conversation |
| `TimelineItemNotFound` | 增量、完成、状态更新指向不存在的 `ItemId` | 上游事件无法应用到当前 timeline |
| `UnknownTimelineItemRejected` | 未知 item 缺少可保留的原始 payload | 无法满足“未知信息不丢失” |
| `InvalidTimelineTransition` | item 状态转换不合法，例如已 completed 后继续被标记 running | timeline lifecycle 被破坏 |
| `DuplicateFailureSuppressed` | 重复失败被识别 | 不是系统错误；用于显式表达重复失败被抑制 |
| `EmptyComposerDraft` | 尝试 send / steer，但当前 `DraftText` 为空 | 空文本不能发送 |
| `NoReliableThreadTarget` | 发送普通输入时缺少可靠 `ThreadId` | 禁止向不明确目标发送 |
| `NoReliableSteerTarget` | 追加输入时缺少可靠 `ThreadId` 或 `ExpectedTurnId` | 禁止向不明确 active turn 追加 |
| `NoReliableInterruptTarget` | 中断时缺少可靠 active `TurnId` | 禁止中断不明确目标 |
| `InterruptNotConfirmed` | 尝试 interrupt，但尚未通过确认 | 高影响动作未确认 |
| `InputNotAccepted` | app-server 拒绝 `turn/start` 或 `turn/steer` | 输入未进入正式 timeline，草稿必须保留 |
| `InterruptNotAccepted` | app-server 拒绝 `turn/interrupt` | 当前工作不能视为已中断 |

## Repository Interfaces

```ts
interface ConversationRepository {
  get(threadId: ThreadId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
```

```ts
interface ComposerDraftRepository {
  get(threadId: ThreadId): Promise<ComposerDraft | null>;
  save(draft: ComposerDraft): Promise<void>;
  delete(threadId: ThreadId): Promise<void>;
}
```

| Repository | 负责 | 不负责 |
| --- | --- | --- |
| `ConversationRepository` | 保存 My-Code-X 对某个 Thread 的 Conversation 领域投影 | 不调用 Codex app-server；不负责恢复、同步、live subscription |
| `ComposerDraftRepository` | 按 `ThreadId` 保存 per-thread 草稿 | 不判断能否发送；不清空非目标 Thread 草稿 |

不单独建立 `ThreadRepository`、`TimelineItemRepository`、`PageNoticeRepository`、`ConnectionRepository`。

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
2. 从 `ComposerDraftRepository.get(threadId)` 读取 per-thread draft
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
  interrupt(turnId: TurnId, confirmed: boolean): Promise<void>;
}
```

`changeDraft` 流程：

1. load or create `ComposerDraft(threadId)`
2. 设置 `DraftText`
3. save draft

`send` 流程：

1. load draft by `threadId`
2. validate non-empty
3. 调用 Codex app-server `turn/start`
4. success 后只清空该 `threadId` draft
5. failure 保留 draft，并 raise page notice

`steer` 流程：

1. load draft by `threadId`
2. validate non-empty
3. validate `expectedTurnId`
4. 调用 Codex app-server `turn/steer`
5. success 后只清空该 `threadId` draft
6. failure 保留 draft，并 raise page notice

`interrupt` 流程：

1. validate `confirmed`
2. validate active `turnId`
3. 调用 Codex app-server `turn/interrupt`
4. failure raise page notice
5. 不修改 draft

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
| `TimelineClassifier` | 把已解析的 Codex item 归类为 My-Code-X 的 `TimelineContent` | `CodexItem` | `TimelineContent` |
| `FailureDeduper` | 判断当前失败是否已经存在 | `FailureSignature`, existing signatures | `duplicate` / `new` |
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
- 未知 item 必须输出 `unknown`，除非 payload 无法保留。
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
| `active` + 空 `DraftText` + reliable active `TurnId` + confirmed | `interrupt` |
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
| `InterruptTurn(turnId)` | `turn/interrupt` |

规则：

- 每个发送给 Codex 的参数必须来自明确领域决策。
- 用户原文进入 `UserInput[]` 时不删改。
- 缺少 `threadId`、`expectedTurnId`、`turnId` 时不构造 request。
- JSON-RPC error 转成 typed application failure，不吞掉 code/message/details。
