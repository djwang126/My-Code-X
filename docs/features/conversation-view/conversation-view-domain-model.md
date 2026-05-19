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
| `Timeline` | 维护当前 `Thread` 的可展示 timeline、顺序、item 更新、turn 分段、消息锚点、分类、retrying error、失败派生 item、失败去重 | 不决定 Composer 能否发送 |
| `Composer` | 当前草稿、绑定 `Thread`、主动作状态、发送成功清空、发送失败保留 | 不把未确认输入写入 timeline |
| `NoticeQueue` | 非 timeline 的页面提示、自动收起 | 不展示 Thread 内 error、retrying error 或失败 |

`LiveUpdateSession` 暂不作为独立 Aggregate。当前它更适合作为 `ConversationViewSession` 的连接子状态。

`TurnTimelineSegment` 暂不作为独立 Aggregate。它是 `Timeline` 内由 Codex `Turn` 派生的分段模型，用于表达同一 turn 内 item 的归属、turn lifecycle 与消息锚点。

## Entities

| Entity | Identity | 说明 |
| --- | --- | --- |
| `ConversationViewSession` | 当前页面实例或 selected `threadId` | 表达用户正在看的工作现场 |
| `Timeline` | `threadId` | 一个 `Thread` 对应一条 timeline |
| `TurnTimelineSegment` | `threadId + turnId` | `Timeline` 内的 turn 级分段，引用该 turn 的 timeline item |
| `TimelineItem` | discriminated union | My-Code-X 的 canonical display model，不等同于 Codex `ThreadItem` |
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
| `TimelineItemPhase` | `notStarted`, `running`, `finished`, `unknown` | My-Code-X 派生的粗粒度阶段，不替代上游状态 |
| `DisplayMode` | `expanded`, `compact` | 普通消息和失败默认 expanded；工作过程和未知默认 compact |
| `TurnLifecycle` | discriminated union | 保留 Codex turn 原始状态，并表达 My-Code-X 的 turn 阶段 |
| `TurnMessageAnchors` | `firstUserMessageItemId?`, `lastAgentMessageItemId?` | turn 内第一条用户消息与最后一条 Codex 回复的锚点 |
| `CodexTimestamp` | stable timestamp string | 来自 Codex 的权威时间字段，不由 My-Code-X 推测生成 |
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

## Timeline Item Model

`TimelineItem` 是 Conversation View 中可展示内容的 canonical display model：

```ts
type TimelineItem =
  | CodexMessageTimelineItem
  | CodexWorkProgressTimelineItem
  | RetryingErrorTimelineItem
  | UnknownCodexTimelineItem
  | ThreadScopedFailureTimelineItem;
```

Codex 原生 `ThreadItem` 映射为 `CodexMessageTimelineItem`、`CodexWorkProgressTimelineItem` 或 `UnknownCodexTimelineItem`，使用 Codex `ThreadItem.id` 作为 identity。`RetryingErrorTimelineItem` 与 `ThreadScopedFailureTimelineItem` 是 My-Code-X 派生 item，不是 Codex `ThreadItem` variant。

```ts
type TimelineItemStatus = {
  raw: string | null;
  phase: "notStarted" | "running" | "finished" | "unknown";
  source: "codexItem" | "codexTurn" | "notification" | "derived" | "missing";
};
```

`raw` 是用户可见与排查时使用的权威状态。`phase` 是 My-Code-X 为了判断是否仍在生成、是否进入终态而派生的内部状态，不替代 `raw`。

### Turn Segments

`TurnTimelineSegment` 是 `Timeline` 内的 turn 级分段模型。它不复制 item 内容，只引用同一 turn 下已经进入 timeline 的 item，并集中表达 turn lifecycle 与消息锚点。

```ts
type TurnTimelineSegment = {
  threadId: ThreadId;
  turnId: TurnId;
  itemIds: TimelineItemId[];
  lifecycle: TurnLifecycle;
  messageAnchors: TurnMessageAnchors;
};

type TurnLifecycle =
  | {
      phase: "running";
      rawStatus: string | null;
      startedAt?: CodexTimestamp;
    }
  | {
      phase: "completed";
      rawStatus: string;
      startedAt?: CodexTimestamp;
      completedAt?: CodexTimestamp;
      durationMs?: number;
    }
  | {
      phase: "failed";
      rawStatus: string;
      startedAt?: CodexTimestamp;
      completedAt?: CodexTimestamp;
      durationMs?: number;
      failureItemId?: FailureTimelineItemId;
    }
  | {
      phase: "interrupted";
      rawStatus: string;
      startedAt?: CodexTimestamp;
      completedAt?: CodexTimestamp;
      durationMs?: number;
    }
  | {
      phase: "unknown";
      rawStatus: string | null;
    };

type TurnMessageAnchors = {
  firstUserMessageItemId?: TimelineItemId;
  lastAgentMessageItemId?: TimelineItemId;
};
```

`firstUserMessageItemId` 是该 turn 中第一条 `kind = "message" && role = "user"` 的 item。`lastAgentMessageItemId` 是该 turn 中最后一条 `kind = "message" && role = "agent"` 的 item。复制、时间展示和工具栏渲染由应用层或 UI 通过锚点读取对应 `TimelineItem` 与 `TurnLifecycle`，domain 不缓存 `copyText`，也不定义 toolbar 视觉模型。

### Message Items

```ts
type CodexMessageTimelineItem = {
  kind: "message";
  id: ThreadItemId;
  threadId: ThreadId;
  turnId: TurnId;
  role: "user" | "agent";
  content: unknown;
  text: string;
  rawItem: unknown;
  status: TimelineItemStatus;
  displayMode: "expanded";
};
```

`role = "user"` 时，`content` 保留 Codex `UserInput[]` 原始语义，`text` 是可复制和展示的用户原文。`role = "agent"` 时，`text` 来自 `agentMessage.text`，按 Markdown 文本展示。message delta 通过 `threadId + turnId + itemId` 更新已有 `agentMessage` item；`item/completed` 到达后，最终权威文本来自 completed item。

### Work Progress Items

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

工作过程 live update 包括文本输出增量、结构化进度、patch snapshot、terminal interaction、summary delta 和最终 item 状态。更新必须通过 `threadId + turnId + itemId` 命中已有 item，只改变内容、状态或详情，不改变该 item 在 timeline 中的初始位置。

### Unknown Items

```ts
type UnknownCodexTimelineItem = {
  kind: "unknown";
  id: ThreadItemId;
  threadId: ThreadId;
  turnId: TurnId;
  type: string;
  status: TimelineItemStatus;
  rawItem: unknown;
  displayMode: "compact" | "expanded";
};
```

未识别 `ThreadItem.type` 不被静默丢弃，不当作失败，不阻断阅读或输入。它使用通用字段展示，默认 compact，可展开排查。

### Error Items

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
  disposition: "retrying" | "recovered" | "ignored";
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

## Timeline Policies

| Policy | 决策 |
| --- | --- |
| `TimelineClassificationPolicy` | 根据已解析的 Codex item type 分类，不能靠文本猜测。已知 message 类型进入 `message`；已知工作过程类型进入 `workProgress`；未识别 `ThreadItem.type` 进入 `unknown`。 |
| `TimelineStatusPolicy` | 保留上游 raw status，并派生内部 `phase`。只要 Codex 提供原始状态，domain object 必须保留该状态。 |
| `TurnSegmentPolicy` | 从 recovered turn 与 live turn lifecycle 维护 `TurnTimelineSegment`，关联 item，并计算 first user / last agent 消息锚点。 |
| `WorkProgressLiveUpdatePolicy` | 将工作过程增量合并到已有 item，保持顺序不变，不新建重复 item。 |
| `ErrorTimelinePolicy` | 处理 `error.willRetry`、failed `turn/completed`、history resume 中的失败合成、retry 成功恢复、retry 失败顶替或合并。 |
| `ComposerActionPolicy` | 基于 `Thread` state、draft、connection、recovery、`expectedTurnId`、active `turnId` 产出主动作。 |
| `PageNoticePolicy` | 无法归属到当前 `Thread` 的错误进入 banner；Thread 内 error 交给 `ErrorTimelinePolicy`。 |
| `ReadingPositionPolicy` | 用户看旧内容时不强制到底部；在底部时自然跟随。 |

`ErrorTimelinePolicy` 的结算规则：

- 收到 `error.willRetry = true` 后，upsert `RetryingErrorTimelineItem`。
- 如果后续 `turn/completed.status = completed`，对应 retrying item 标记为 `recovered`，不升级为失败。
- 如果后续收到 `error.willRetry = false`，或 `turn/completed.status = failed` 且 `turn.error != null`，按相同 identity 将 retrying item 顶替或合并为 `ThreadScopedFailureTimelineItem`，不重复展示。
- 收到 `error.willRetry = false` 时，可以 upsert `ThreadScopedFailureTimelineItem`，但 `confirmation = pendingTurnCompleted`。
- 随后收到 failed `turn/completed` 时，按相同 identity merge，并标记 `confirmation = confirmed`。
- history resume 时，从 failed `Turn.error` 合成 `ThreadScopedFailureTimelineItem`。该 item 的位置放在该 turn 的 items 之后，表达这个 turn 以失败结束。

`TurnSegmentPolicy` 的维护规则：

- history resume 时，为每个 recovered `Turn` upsert `TurnTimelineSegment`，保存 `Turn.id`、`startedAt`、`completedAt`、`durationMs` 与原始 `status`。
- live `turn/started` 到达时，upsert 对应 `TurnTimelineSegment`，将 lifecycle 置为 `running` 或从 Codex 原始状态派生的阶段。
- `item/started` 或 `item/completed` 到达时，将该 item identity 关联到同一 `turnId` 的 `itemIds`；如果 segment 尚不存在，创建 `phase = "unknown"` 的 segment。
- `turn/completed` 到达时，更新 lifecycle；`status = failed` 时可关联对应 `ThreadScopedFailureTimelineItem`。
- 每次 turn 内 message item 集合变化后，重新计算 `firstUserMessageItemId` 与 `lastAgentMessageItemId`。

## Composer Model

`Composer` 绑定当前 selected `Thread`，但草稿全局保存。发送动作只由 `ComposerMainAction` 表达：

| Action | 条件 | 请求 |
| --- | --- | --- |
| `startTurn` | 当前 `Thread` idle，draft 为非空原文，且 `threadId` 可靠 | `turn/start` |
| `steerTurn` | 当前 `Thread` active，draft 为非空原文，且 `threadId` 与 `expectedTurnId` 可靠 | `turn/steer` |
| `interruptTurn` | 当前 `Thread` active，draft 为空，且 active `turnId` 可靠 | `turn/interrupt`，先经过 app 层确认 |
| `disabled` | 无选中 `Thread`、恢复中、连接不可用、目标状态不明确或输入为空且不能中断 | none |

发送请求被接受后，清空对应已发送草稿。发送失败、连接不可用、恢复中或目标状态不明确时，草稿保持不变。`turn/start` 或 `turn/steer` success response 前，Composer 输入不能进入正式 timeline。

## Invariants

| Invariant | 规则 |
| --- | --- |
| 当前 Thread 隔离 | `Timeline` 只包含当前 selected `threadId` 的内容 |
| 顺序权威 | timeline item 按 Codex history / live event 的发生顺序排列；已有 item 更新不改变其初始位置 |
| 原生 item identity | Codex 原生 item 更新必须通过 `ThreadItem.id` / `item_id` 命中已有 item |
| 状态保真 | 上游提供的原始 status 必须保留；My-Code-X 派生的 `phase` 不得覆盖 `raw` |
| 工作过程增量更新 | 工作过程 live update 更新已有 item，不新建重复 item |
| error 派生 identity | Thread 内 retrying error 与失败使用 `threadId + turnId + error fingerprint` 去重 |
| retrying error 不等于失败 | `error.willRetry = true` 只能产生或更新 `RetryingErrorTimelineItem`，不得直接生成失败 item |
| retrying error 需结算 | 同一 turn 完成后，retrying item 必须进入 `recovered`、被失败顶替，或被明确忽略 |
| retry 成功不污染失败 | `turn/completed.status = completed` 后，相关 retrying item 不得升级为失败 |
| retry 失败不重复展示 | retrying item 被失败顶替或合并后，不得同时展示重复的 retrying error 与失败 item |
| 失败不伪装 | `ThreadScopedFailureTimelineItem` 不得被渲染为普通 Codex 回复 |
| 未知不丢弃 | 未识别 `ThreadItem.type` 必须进入 `UnknownCodexTimelineItem` |
| 未确认输入不入 timeline | `turn/start` 或 `turn/steer` success response 前，Composer 输入不能进入正式 timeline |
| Turn 分段保真 | `TurnTimelineSegment` 只由 Codex `Turn` 与其 `ThreadItem` 派生，不创建新的对话内容 |
| item 顺序不分叉 | `TurnTimelineSegment.itemIds` 引用 timeline item，不复制 item 内容，不改变 timeline item 初始顺序 |
| 消息锚点权威 | 第一条用户消息与最后一条 agent 消息由同一 turn 内 message item 顺序计算 |
| 复制文本不缓存 | 复制操作通过锚点读取对应 `TimelineItem.text`，不在 `TurnTimelineSegment` 中缓存文本副本 |
| 时间不推测 | turn 级时间只使用 Codex `startedAt`、`completedAt`、`durationMs` 等权威字段；缺失则不展示 |
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
| `ApplyRecoveredTurns` | `threadId`, `Turn[]` | `ConversationContentRestored`, `TurnTimelineSegmentUpserted`, maybe `ThreadScopedFailureTimelineItemCreated` |
| `ApplyLiveThreadItemStarted` | `threadId`, `turnId`, `ThreadItem` | `TimelineItemInserted`, `TurnTimelineSegmentUpdated`, maybe `TurnMessageAnchorsChanged` |
| `ApplyAgentMessageDelta` | `threadId`, `turnId`, `itemId`, `delta` | `TimelineItemUpdated` |
| `ApplyWorkProgressLiveUpdate` | `threadId`, `turnId`, `itemId`, `WorkProgressLiveUpdate` | `TimelineItemUpdated` |
| `ApplyThreadItemCompleted` | `threadId`, `turnId`, `ThreadItem` | `TimelineItemCompleted`, `TimelineItemStatusChanged`, `TurnTimelineSegmentUpdated`, maybe `TurnMessageAnchorsChanged` |
| `ApplyErrorNotification` | `threadId`, `turnId`, `TurnError`, `willRetry` | `RetryingErrorTimelineItemUpserted` / `ThreadScopedFailureTimelineItemUpserted` |
| `ApplyTurnCompleted` | `Turn` | `TurnCompleted`, `TurnTimelineSegmentUpdated`, maybe `RetryingErrorTimelineItemRecovered`, maybe `RetryingErrorTimelineItemSupersededByFailure`, maybe `ThreadScopedFailureTimelineItemMerged` |
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
| `TurnTimelineSegmentUpserted` | turn 级分段被创建或用 recovered/live turn 数据更新 |
| `TurnTimelineSegmentUpdated` | turn lifecycle 或 turn 内 item 引用发生变化 |
| `TurnMessageAnchorsChanged` | turn 内第一条用户消息或最后一条 Codex 回复锚点发生变化 |
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

`CodexProtocolACL` 负责把 Codex protocol 输入解析成 My-Code-X 领域对象。外部 protocol 只在 ACL 层解析一次；进入 domain 后，内部逻辑使用 My-Code-X canonical domain object。

| Codex protocol input | My-Code-X domain object |
| --- | --- |
| Codex `ThreadItem` | `CodexThreadTimelineItem` |
| work progress live notification | `WorkProgressLiveUpdate` |
| `ErrorNotification` | `ThreadErrorSignal` |
| `Turn(status = Failed, error != null)` | `ThreadScopedFailureTimelineItem` |
| `warning`, `guardianWarning`, `configWarning` | `PageNotice` |
| JSON-RPC error without `threadId` | `PageNotice` |

`ThreadErrorSignal` 进入 domain 后由 `ErrorTimelinePolicy` 分类，不由 UI 直接判断 `willRetry`。
