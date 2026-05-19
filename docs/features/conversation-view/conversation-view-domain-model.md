# Conversation View Domain Model

本文档基于 Conversation View feature description 与 BDD statement，定义 Conversation View 的领域模型。

本文档不定义 Codex agent 能力，不定义 API contract，不定义 UI 视觉细节。

## Event Storming Summary

Conversation View 的核心事件流分为六组：

- Thread context / recovery：用户选择 `Thread`，页面恢复内容，确认内容是否最新。
- Timeline ingestion and rendering：历史内容与 live event 进入 timeline，按类型分类并展示。
- Thread scoped error normalization：将 Codex retrying error、最终失败规范化为 My-Code-X 派生 timeline item。
- Live update：持续接收新内容与工作过程增量，更新已有 item，并保持阅读位置稳定。
- Composer：维护输入草稿，决定主操作，并发送 start / steer / interrupt 请求。
- Page notice：展示不适合插入 timeline 的页面级提示。

## Aggregates

| Aggregate | 责任 | 不负责 |
| --- | --- | --- |
| `ConversationViewSession` | 当前选中 `Thread`、恢复状态、连接状态、内容新鲜度、页面是否可读 | 不保存具体 timeline item 细节 |
| `Timeline` | 维护当前 `Thread` 的可展示 timeline、顺序、item 更新、分类、retrying error、失败派生 item、失败去重 | 不决定 Composer 能否发送 |
| `Composer` | 当前草稿、绑定 `Thread`、主动作状态、发送成功清空、发送失败保留 | 不把未确认输入写入 timeline |
| `NoticeQueue` | 非 timeline 的页面提示、自动收起 | 不展示 Thread 内 error、retrying error 或失败 |

`LiveUpdateSession` 暂不作为独立 Aggregate。当前它更适合作为 `ConversationViewSession` 的连接子状态。

## Entities

| Entity | Identity | 说明 |
| --- | --- | --- |
| `ConversationViewSession` | 当前页面实例或 selected `threadId` | 表达用户正在看的工作现场 |
| `Timeline` | `threadId` | 一个 `Thread` 对应一条 timeline |
| `TimelineItem` | discriminated union | My-Code-X 的可展示 item，不等同于 Codex `ThreadItem` |
| `CodexThreadTimelineItem` | Codex `ThreadItem.id` | 从 Codex 原生 `ThreadItem` 映射而来 |
| `RetryingErrorTimelineItem` | `threadId + turnId + error fingerprint` | 从 `ErrorNotification(willRetry = true)` 派生，表达 Codex 正在自动恢复 |
| `ThreadScopedFailureTimelineItem` | `threadId + turnId + error fingerprint` | 从 `ErrorNotification(willRetry = false)` 或 failed `Turn.error` 派生 |
| `Composer` | selected `threadId` 或全局 composer id | 草稿全局保存，但发送动作绑定当前 `Thread` |
| `PageNotice` | notice id | 页面 banner 提示 |

## Value Objects

| Value Object | 字段 / 形态 | 说明 |
| --- | --- | --- |
| `ThreadRef` | `threadId`, `title`, `cwd` | 顶部上下文展示所需的当前 `Thread` 引用 |
| `TurnRef` | `threadId`, `turnId` | active turn、失败 item、steer / interrupt 的目标 |
| `TimelineItemKind` | `message`, `workProgress`, `failure`, `unknown` | 用户可感知的四类信息 |
| `TimelineItemStatus` | `raw`, `phase`, `source` | 保留上游原始状态；`phase` 只服务内部行为判断 |
| `TimelineItemPhase` | `notStarted`, `running`, `terminal`, `unknown` | My-Code-X 派生的粗粒度阶段，不替代上游状态 |
| `DisplayMode` | `expanded`, `compact` | 普通消息和失败默认 expanded；工作过程和未知默认 compact |
| `ComposerDraft` | 原始文本 | 不删改用户输入 |
| `ComposerMainAction` | `startTurn`, `steerTurn`, `interruptTurn`, `disabled` | 用 union 表达可执行动作 |
| `RecoveryState` | `notStarted`, `recovering`, `restored`, `failed` | 页面恢复状态 |
| `FreshnessState` | `fresh`, `syncing`, `possiblyStale` | 内容是否可认为最新 |
| `ConnectionState` | `available`, `unavailable`, `reconnecting` | 影响 Composer 可用性和页面提示 |
| `TurnErrorInfo` | `message`, `codexErrorInfo`, `additionalDetails` | 保留 Codex 错误语义 |
| `ThreadErrorSignal` | `threadId`, `turnId`, `error`, `willRetry` | ACL 解析后的 Codex thread 内错误信号 |
| `ErrorFingerprint` | stable string | 由 `message` 与稳定的 `codexErrorInfo` 语义组成，用于 error item 合并 |
| `ErrorTimelineDisposition` | `retrying`, `recovered`, `finalFailure`, `ignored` | `ErrorTimelinePolicy` 对错误信号的分类结果 |
| `WorkProgressLiveUpdate` | `itemId`, `turnId`, `updateKind`, `payload`, `status?` | 工作过程 item 的后续增量或状态更新 |

## TimelineItem Model

`TimelineItem` 是 My-Code-X 的 canonical display model。它表达 Conversation View 中可展示的 timeline 内容，不等同于 Codex protocol 的 `ThreadItem`。

```ts
type TimelineItem =
  | CodexMessageTimelineItem
  | CodexWorkProgressTimelineItem
  | RetryingErrorTimelineItem
  | UnknownCodexTimelineItem
  | ThreadScopedFailureTimelineItem;
```

Codex 原生 `ThreadItem` 映射为 `CodexMessageTimelineItem`、`CodexWorkProgressTimelineItem` 或 `UnknownCodexTimelineItem`。这些 item 使用 Codex `ThreadItem.id` 作为 identity。item lifecycle、message delta 与 work progress live update 都通过该 identity 更新已有 item。

`RetryingErrorTimelineItem` 与 `ThreadScopedFailureTimelineItem` 是 My-Code-X 派生 item，不是 Codex `ThreadItem` variant。

### Status Fidelity Model

`TimelineItemStatus` 不把上游状态压扁为 My-Code-X 自己的固定枚举。只要 Codex 提供原始状态，domain object 必须保留该状态。

```ts
type TimelineItemStatus = {
  raw: string | null;
  phase: "notStarted" | "running" | "terminal" | "unknown";
  source: "codexItem" | "codexTurn" | "notification" | "derived" | "missing";
};
```

`raw` 是用户可见与排查时使用的权威状态。`phase` 是 My-Code-X 为了判断是否仍在生成、是否进入终态而派生的内部状态，不替代 `raw`。

### Work Progress Live Update Model

`CodexWorkProgressTimelineItem` 可以被后续 live update 更新。live update 包括文本输出增量、结构化进度、patch snapshot、terminal interaction、summary delta 和最终 item 状态。

```ts
type CodexWorkProgressTimelineItem = {
  kind: "workProgress";
  id: ThreadItemId;
  threadId: ThreadId;
  turnId: TurnId;
  type: string;
  status: TimelineItemStatus;
  summaryFields: Record<string, unknown>;
  detail: WorkProgressDetail;
  displayMode: "compact" | "expanded";
};

type WorkProgressDetail = {
  rawItem: unknown;
  output?: string;
  patch?: unknown;
  progressMessages?: string[];
  terminalInteractions?: unknown[];
  structuredFields?: Record<string, unknown>;
};
```

工作过程 live update 必须通过 `threadId + turnId + itemId` 命中已有 item。更新只改变 item 内容、状态或详情，不改变该 item 在 timeline 中的初始位置。

```ts
type RetryingErrorTimelineItem = {
  kind: "workProgress";
  subtype: "retryingError";
  id: RetryingErrorTimelineItemId;
  threadId: ThreadId;
  turnId: TurnId;
  message: string;
  details: TurnErrorInfo;
  retryCount: number;
  status: TimelineItemStatus;
  displayMode: "compact";
};

type ThreadScopedFailureTimelineItem = {
  kind: "failure";
  id: FailureTimelineItemId;
  threadId: ThreadId;
  turnId: TurnId;
  message: string;
  details: {
    codexErrorInfo?: unknown;
    additionalDetails?: unknown;
  };
  source: "errorNotification" | "failedTurn" | "retrySuperseded" | "merged";
  confirmation: "pendingTurnCompleted" | "confirmed";
  displayMode: "expanded";
};
```

`RetryingErrorTimelineItem.id` 与 `ThreadScopedFailureTimelineItem.id` 都由 `threadId + turnId + error fingerprint` 组成。`error fingerprint` 使用 `message` 与稳定的 `codexErrorInfo` 语义；`additionalDetails` 只进入 details，不参与 identity。

live 更新时，收到 `error.willRetry = true` 后 upsert `RetryingErrorTimelineItem`。如果后续 `turn/completed.status = completed`，该 retrying item 标记为 `recovered`，不升级为失败。如果后续收到 `error.willRetry = false` 或 `turn/completed.status = failed`、`turn.error != null`，按相同 identity 将 retrying item 顶替或合并为 `ThreadScopedFailureTimelineItem`，不重复展示。

收到 `error.willRetry = false` 时，可以 upsert `ThreadScopedFailureTimelineItem`，但 `confirmation = pendingTurnCompleted`。随后收到 failed `turn/completed` 时，按相同 identity merge，并标记 `confirmation = confirmed`。

history resume 时，从 failed `Turn.error` 合成 `ThreadScopedFailureTimelineItem`。该 item 的位置放在该 turn 的 items 之后，表达这个 turn 以失败结束。

## Invariants

| Invariant | 规则 |
| --- | --- |
| 当前 Thread 隔离 | `Timeline` 只包含当前 selected `threadId` 的内容 |
| 顺序权威 | timeline item 按 Codex history / live event 的发生顺序排列；已有 item 更新不改变其初始位置 |
| 原生 item identity | Codex 原生 item 更新必须通过 `ThreadItem.id` / `item_id` 命中已有 item |
| 状态保真 | 上游提供的原始 status 必须保留；My-Code-X 派生的 `phase` 不得覆盖 `raw` |
| 工作过程增量更新 | 工作过程 live update 通过 `threadId + turnId + itemId` 更新已有 item，不新建重复 item |
| error 派生 identity | Thread 内 retrying error 与失败使用 `threadId + turnId + error fingerprint` 去重 |
| retrying error 不等于失败 | `error.willRetry = true` 只能产生或更新 `RetryingErrorTimelineItem`，不得直接生成失败 item |
| retrying error 需结算 | 同一 turn 完成后，retrying item 必须进入 `recovered`、被失败顶替，或被明确忽略 |
| retry 成功不污染失败 | `turn/completed.status = completed` 后，相关 retrying item 不得升级为失败 |
| retry 失败不重复展示 | retrying item 被失败顶替或合并后，不得同时展示重复的 retrying error 与失败 item |
| 失败不伪装 | `ThreadScopedFailureTimelineItem` 不得被渲染为普通 Codex 回复 |
| 未知不丢弃 | 未识别 `ThreadItem.type` 必须进入 `UnknownCodexTimelineItem` |
| 未确认输入不入 timeline | `turn/start` 或 `turn/steer` success response 前，Composer 输入不能进入正式 timeline |
| 草稿保留 | 发送失败、连接不可用、恢复中、目标状态不明确时，草稿保持不变 |
| 成功后清空 | 只有发送请求被接受后，清空对应已发送草稿 |
| 空文本不可发送 | `startTurn` / `steerTurn` 要求非空原文 |
| interrupt 需确认 | active + 空输入触发中断前必须经过 app 层确认 |
| 页面提示不污染 timeline | 无法归属 `Thread` 的错误、My-Code-X 本地错误、warning、发送失败不插入 timeline |

## Commands

| Command | 输入 | 产出事件 |
| --- | --- | --- |
| `SelectThread` | `ThreadRef` | `ThreadSelected` |
| `ClearThreadSelection` | none | `ThreadSelectionCleared` |
| `StartConversationRecovery` | `threadId` | `ConversationRecoveryStarted` |
| `ApplyRecoveredTurns` | `threadId`, `Turn[]` | `ConversationContentRestored`, maybe `ThreadScopedFailureTimelineItemCreated` |
| `ApplyLiveThreadItemStarted` | `threadId`, `turnId`, `ThreadItem` | `TimelineItemInserted` |
| `ApplyAgentMessageDelta` | `itemId`, `delta` | `TimelineItemUpdated` |
| `ApplyWorkProgressLiveUpdate` | `threadId`, `turnId`, `itemId`, `WorkProgressLiveUpdate` | `TimelineItemUpdated` |
| `ApplyThreadItemCompleted` | `threadId`, `turnId`, `ThreadItem` | `TimelineItemCompleted`, `TimelineItemStatusChanged` |
| `ApplyErrorNotification` | `threadId`, `turnId`, `TurnError`, `willRetry` | `RetryingErrorTimelineItemUpserted` / `ThreadScopedFailureTimelineItemUpserted` |
| `ApplyTurnCompleted` | `Turn` | `TurnCompleted`, maybe `RetryingErrorTimelineItemRecovered`, maybe `RetryingErrorTimelineItemSupersededByFailure`, maybe `ThreadScopedFailureTimelineItemMerged` |
| `ChangeComposerDraft` | raw text | `ComposerDraftChanged` |
| `SubmitComposerMainAction` | current action | `TurnStartRequested` / `TurnSteerRequested` / `InterruptConfirmationRequested` |
| `ConfirmInterrupt` | `TurnRef` | `TurnInterruptRequested` |
| `AcceptTurnRequest` | request id | `TurnRequestAccepted`, `ComposerDraftCleared` |
| `RejectTurnRequest` | request id, error | `TurnRequestFailed`, `PageNoticeRaised` |
| `RaisePageNotice` | notice payload | `PageNoticeRaised` |
| `DismissPageNotice` | notice id | `PageNoticeAutoDismissed` |

## Domain Events

| Domain Event | 说明 |
| --- | --- |
| `ThreadSelected` | 用户选中了一个 Codex `Thread` |
| `ThreadSelectionCleared` | 当前没有选中 `Thread` |
| `ConversationRecoveryStarted` | 页面开始恢复当前 `Thread` 内容 |
| `ConversationContentRestored` | 当前 `Thread` 内容恢复成功 |
| `ConversationRecoveryFailed` | 当前 `Thread` 内容恢复失败 |
| `ConversationContentMarkedPossiblyStale` | 现有内容可能不是最新 |
| `TimelineItemInserted` | 新 timeline item 进入 timeline |
| `TimelineItemUpdated` | 已有 timeline item 被后续进展更新 |
| `TimelineItemCompleted` | timeline item 完成 |
| `TimelineItemStatusChanged` | timeline item 的上游状态或派生阶段变化 |
| `TimelineItemClassified` | raw input 被分类为用户可见 timeline kind |
| `RetryingErrorTimelineItemUpserted` | Codex 报告可重试错误，timeline 展示自动恢复中的工作过程 item |
| `RetryingErrorTimelineItemRecovered` | retrying error 所属 turn 后续完成，retrying item 被标记为已恢复 |
| `RetryingErrorTimelineItemSupersededByFailure` | retrying item 被同一错误语义的失败 item 顶替或合并 |
| `ThreadScopedFailureTimelineItemCreated` | Thread 内失败被合成为派生 timeline item |
| `ThreadScopedFailureTimelineItemMerged` | live error 与 failed turn 被合并为同一个失败 item |
| `ThreadScopedFailureTimelineItemConfirmed` | failed `turn/completed` 确认失败 item 是该 turn 的最终失败 |
| `DuplicateFailureSuppressed` | 同一 turn 且 error fingerprint 一致的重复失败被抑制 |
| `ComposerDraftChanged` | Composer 草稿变化 |
| `ComposerMainActionChanged` | Composer 主动作变化 |
| `TurnStartRequested` | 用户请求启动普通输入 |
| `TurnSteerRequested` | 用户请求追加输入 |
| `TurnInterruptRequested` | 用户确认中断当前工作 |
| `TurnRequestAccepted` | app-server 接受 start / steer 请求 |
| `TurnRequestFailed` | start / steer 请求失败 |
| `PageNoticeRaised` | 页面级提示被创建 |
| `PageNoticeAutoDismissed` | 页面级提示自动消失 |

## Policies

| Policy | 决策 |
| --- | --- |
| `TimelineClassificationPolicy` | 根据已解析的 Codex item type 分类，不能靠文本猜测 |
| `TimelineStatusPolicy` | 保留上游 raw status，并派生内部 `phase` |
| `WorkProgressLiveUpdatePolicy` | 将工作过程增量合并到已有 item，保持顺序不变 |
| `ErrorTimelinePolicy` | `error.willRetry = true` upsert retrying item；retry 成功标记 recovered；retry 失败顶替或合并为失败；`error.willRetry = false` upsert 待确认失败；failed `turn/completed` 确认失败；history resume 从 `Turn.error` 合成已确认失败 item |
| `ComposerActionPolicy` | 基于 `Thread` state、draft、connection、recovery、`expectedTurnId`、active `turnId` 产出主动作 |
| `PageNoticePolicy` | 无法归属到当前 `Thread` 的错误进入 banner；Thread 内 error 交给 `ErrorTimelinePolicy` |
| `ReadingPositionPolicy` | 用户看旧内容时不强制到底部；在底部时自然跟随 |

## Repository Interfaces

| Repository Interface | 方法 |
| --- | --- |
| `ConversationGateway` | `resumeThread(threadId)`, `listThreadTurns(threadId)`, `startTurn(threadId, input)`, `steerTurn(threadId, expectedTurnId, input)`, `interruptTurn(threadId, turnId)` |
| `LiveConversationSubscription` | `subscribe(threadId)`, `unsubscribe(threadId)` |
| `ComposerDraftRepository` | `getDraft(scope)`, `saveDraft(scope, draft)`, `clearDraft(scope)` |
| `ClipboardPort` | `copyText(text)` |
| `ExternalLinkPort` | `openMarkdownLink(url)` |

`ConversationGateway` 是对 Codex app-server 的 outbound port。UI 不直接依赖 JSON-RPC 细节。

## Application Services

| Application Service | 责任 |
| --- | --- |
| `ConversationViewService` | 选择 `Thread`、恢复内容、维护 `ConversationViewSession` |
| `TimelineIngestionService` | 接收 history / live event，调用 timeline policy，转换为 canonical `TimelineItem` |
| `ComposerService` | 计算主动作，发送 start / steer / interrupt，处理成功失败 |
| `NoticeService` | 管理 banner 提示 |
| `ClipboardService` | 复制用户输入、Codex 回复、代码块 |

## Anti-Corruption Layer

`CodexProtocolACL` 负责把 Codex protocol 输入解析成 My-Code-X 领域对象。

| Codex protocol input | My-Code-X domain object |
| --- | --- |
| Codex `ThreadItem` | `CodexThreadTimelineItem` |
| work progress live notification | `WorkProgressLiveUpdate` |
| `ErrorNotification` | `ThreadErrorSignal` |
| `Turn(status = Failed, error != null)` | `ThreadScopedFailureTimelineItem` |
| `warning`, `guardianWarning`, `configWarning` | `PageNotice` |
| JSON-RPC error without `threadId` | `PageNotice` |

`ThreadErrorSignal` 进入 domain 后由 `ErrorTimelinePolicy` 分类，不由 UI 直接判断 `willRetry`。外部 protocol 只在 ACL 层解析一次。进入 domain 后，内部逻辑使用 My-Code-X canonical domain object。
