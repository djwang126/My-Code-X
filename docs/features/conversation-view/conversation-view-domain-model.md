# Conversation View Domain Model

## Summary

`ConversationView` 是当前选中 Codex `Thread` 的页面级聚合根。它协调只读 `Conversation` timeline、`Composer` 草稿与 thread action、`Recovering error`、`Conversation timeline state` 和 timeline 外 notice。

`Conversation` 只表示当前选中 Codex `Thread` 的只读 timeline 投影。它不拥有输入，也不拥有恢复中错误提示。

## Aggregate

### ConversationView

`ConversationView` 是 aggregate root。

拥有：

- `selection: ConversationSelection`
- `conversation: Conversation | null`
- `timelineState: ConversationTimelineState`
- `composer: Composer | null`
- `recoveringError: RecoveringError | null`
- `notices: ConversationViewNotice[]`
- `connectionState: ConversationConnectionState`
- `activeTurn: ActiveTurnState`

不拥有：

- Codex `Thread` 本体
- Codex `Turn` 本体
- Codex app-server transport 细节
- Browser DOM 状态
- Markdown 渲染结果
- Toast 动画生命周期

## Entity

### Conversation

当前选中 Codex `Thread` 的只读 timeline 投影。

字段：

- `thread: ThreadRef`
- `items: ConversationItem[]`
- `restoredAt?: Timestamp`
- `lastSyncedAt?: Timestamp`
- `freshness: ConversationFreshness`

规则：

- 只能通过投影更新。
- 不处理 Composer 输入。
- 不拥有 `RecoveringError`。
- 不表达无 Codex `Thread` 选中状态。

### ConversationItem

`ConversationItem` 是 timeline 中的正式展示单元，只允许四种类型：

```ts
type ConversationItem =
  | MessageItem
  | WorkTraceItem
  | UnknownItem
  | ErrorItem;
```

共同字段：

- `id: ConversationItemId`
- `threadId: ThreadId`
- `turnId: TurnId`
- `sourceRef: ConversationItemSourceRef`
- `sequence: TimelineSequence`
- `finality: ItemFinality`

规则：

- `RecoveringError` 不属于 `ConversationItem`。
- `ConversationViewNotice` 不属于 `ConversationItem`。
- 排序基于投影顺序或来源序列，不基于 UI index。
- 恢复历史中的 `turnId` 来自父级 Codex `Turn.id`，不是 `ThreadItem` 字段。

### MessageItem

由 Codex `userMessage` 或 `agentMessage` 投影。

字段：

- `kind: "message"`
- `role: "user" | "agent"`
- `text: MarkdownText`
- `rawText: PlainText`
- `turnPosition: MessageTurnPosition`
- `streaming: boolean`
- `copyable: boolean`

规则：

- `userMessage` 只能投影为 `role = "user"`。
- `agentMessage` 只能投影为 `role = "agent"`。
- `agentMessage` delta 只能更新同一个未 final 的 agent message。
- Codex `item/completed` 中的 final `agentMessage.text` 是最终权威内容。
- Markdown 渲染结果不写回 domain。

### WorkTraceItem

由 My-Code-X 已明确归类为工作过程痕迹的 Codex `ThreadItem` 或可归属到当前 `Turn` 的 typed runtime input 投影。

字段：

- `kind: "work-trace"`
- `nativeType: CodexNativeType`
- `status?: CodexStatus`
- `fields: StructuredField[]`
- `details: DisclosureState`

规则：

- 必须保留 Codex 原生 type。
- 是否存在专门 renderer 不影响 `WorkTraceItem` 和 `UnknownItem` 的分类边界。
- 复杂字段以 `StructuredValue` 保存，不保存 HTML。

### UnknownItem

由 My-Code-X 当前没有专门产品分类，但可归属到当前 `Turn` 的 Codex 来源投影。

字段：

- `kind: "unknown"`
- `sourceType: CodexNativeType | RuntimeEventType | UnknownSourceLabel`
- `status?: CodexStatus`
- `fields: StructuredField[]`
- `details: DisclosureState`

规则：

- 必须可归属到当前 `Thread` 和 `Turn`。
- 不表示 failure。
- 不等同 `WorkTraceItem`。

### ErrorItem

可归属到当前选中 Codex `Thread` 和 `Turn` 的 failure 投影。

字段：

- `kind: "error"`
- `errorKey: ErrorProjectionKey`
- `message: PlainText`
- `errorSource: ErrorProjectionSource`
- `threadId: ThreadId`
- `turnId: TurnId`
- `codexErrorInfo: StructuredValue | null`
- `additionalDetails: PlainText | null`
- `fields: StructuredField[]`

规则：

- Codex `error` notification with `willRetry = false` 可以投影为 `ErrorItem`。
- Codex `turn/completed` with `status = failed` 中的 `TurnError` 可以投影为 `ErrorItem`。
- `willRetry = true` 绝不能投影为 `ErrorItem`。
- `willRetry` 只存在于 `codex-error-notification` 来源；`status = failed` 只存在于 `codex-turn-completed` 来源。
- 去重只允许使用 `turnId + error.message`。
- 不折叠，不展开。

### Composer

`ConversationView` 内的输入控制台状态。

字段：

- `threadId: ThreadId`
- `draft: ComposerDraft`
- `action: ComposerPrimaryAction`

规则：

- 草稿不进入 timeline。
- 空草稿不能发送。
- Codex 接受发送请求后清空已发送草稿。
- Codex 拒绝发送请求后恢复或保留原草稿。
- 不伪造 committed `ConversationItem`。

### RecoveringError

active `Turn` 中 Codex 仍会继续尝试恢复的错误 overlay。

字段：

- `threadId: ThreadId`
- `turnId: TurnId`
- `message: PlainText`
- `source: { kind: "codex-error-notification"; willRetry: true }`
- `codexErrorInfo: StructuredValue | null`
- `additionalDetails: PlainText | null`
- `receivedAt: Timestamp`

规则：

- 属于 `ConversationView`，不属于 `Conversation.items`。
- 只绑定当前 active `Turn`。
- 同一个 active `Turn` 同时最多存在一个。
- 新的 `willRetry = true` error 覆盖旧值。
- 同一 active `Turn` 收到正常进展或 `turn/completed` 时清除。

### ConversationViewNotice

timeline 外提示、错误或警告。

字段：

- `noticeId: NoticeId`
- `severity: "info" | "warning" | "error"`
- `source: NoticeSource`
- `message: PlainText`
- `fields: StructuredField[]`
- `createdAt: Timestamp`

规则：

- 不进入 timeline。
- 不参与 timeline 排序。
- 可以投影为 `Client notice`。
- Toast 只是呈现方式，不是 domain object。

## Value Object

### Identity

```ts
type ThreadId = Brand<string, "ThreadId">;
type TurnId = Brand<string, "TurnId">;
type ExpectedTurnId = Brand<string, "ExpectedTurnId">;
type ConversationItemId = Brand<string, "ConversationItemId">;
type NoticeId = Brand<string, "NoticeId">;
```

`ExpectedTurnId` 是 `turn/steer` 专用值对象，防止漏传或误传当前 active `Turn`。

### Selection

```ts
type ConversationSelection =
  | { kind: "none" }
  | { kind: "selected"; thread: ThreadRef };

type ThreadRef = {
  threadId: ThreadId;
  cwd?: CanonicalCwd;
};
```

### Timeline State

```ts
type ConversationTimelineState =
  | { kind: "restoring"; readable: false }
  | { kind: "empty"; readable: true }
  | { kind: "restore-failed"; readable: false; reason: TimelineFailureReason }
  | { kind: "readable"; readable: true }
  | { kind: "readable-syncing"; readable: true }
  | { kind: "readable-freshness-uncertain"; readable: true; reason: FreshnessUncertainReason };
```

规则：

- 不包含无 `Thread` 选中状态。
- 不表达 Codex `Turn` 的 running、completed、failed、interrupted。

### Item Source

```ts
type ConversationItemSourceRef =
  | { kind: "thread-item"; nativeType: CodexNativeType; threadItemId: CodexThreadItemId }
  | { kind: "runtime-event"; eventType: RuntimeEventType; eventId: RuntimeEventId };

type ItemFinality =
  | { kind: "live" }
  | { kind: "final" };

type TimelineSequence = {
  value: number;
};
```

如果 runtime notification 没有稳定 id，adapter 应生成 source sequence，不应让缺失 id 泄漏到 domain。

### Message

```ts
type MessageRole = "user" | "agent";

type MessageTurnPosition =
  | { kind: "first-user" }
  | { kind: "last-agent" }
  | { kind: "middle" };

type MarkdownText = {
  value: string;
};

type PlainText = {
  value: string;
};
```

### Structured Field

```ts
type StructuredField = {
  name: FieldName;
  value: StructuredValue;
};

type StructuredValue =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "list"; value: StructuredValue[] }
  | { kind: "record"; value: Record<string, StructuredValue> };
```

### Disclosure

```ts
type DisclosureState =
  | { kind: "collapsed" }
  | { kind: "expanded" };
```

`ErrorItem` 不使用 `DisclosureState`。

### Error

```ts
type ErrorProjectionKey = {
  turnId: TurnId;
  message: PlainText;
};

type ErrorProjectionSource =
  | { kind: "codex-error-notification"; willRetry: false }
  | { kind: "codex-turn-completed"; status: "failed" };
```

`ErrorProjectionSource` 表达错误语义来源；`ConversationItemSourceRef` 表达 timeline item 的来源定位。两者不能合并为同一个字段。

### Composer

```ts
type ComposerDraft = {
  threadId: ThreadId;
  text: PlainText;
  updatedAt: Timestamp;
};

type ComposerPrimaryAction =
  | { kind: "send-start" }
  | { kind: "send-steer"; expectedTurnId: ExpectedTurnId }
  | { kind: "interrupt"; turnId: TurnId }
  | { kind: "disabled"; reason: ComposerDisabledReason };

type ComposerDisabledReason =
  | "no-thread-selected"
  | "conversation-restoring"
  | "connection-unavailable"
  | "target-state-unknown"
  | "empty-draft"
  | "no-active-turn";
```

### Runtime State

```ts
type ConversationConnectionState =
  | { kind: "connected" }
  | { kind: "reconnecting"; since: Timestamp }
  | { kind: "disconnected"; since: Timestamp }
  | { kind: "unknown" };

type ActiveTurnState =
  | { kind: "none" }
  | { kind: "active"; turnId: TurnId }
  | { kind: "unknown" };
```

### Codex Projection Input

```ts
type CodexThreadRestoreResult = {
  thread: ThreadRef;
  turns: RestoredCodexTurn[];
};

type RestoredCodexTurn = {
  turnId: TurnId;
  status: CodexTurnStatus;
  error: CodexTurnError | null;
  items: CodexThreadItem[];
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  durationMs: number | null;
};

type ConversationProjectionInput =
  | {
      kind: "restored-thread-item";
      threadId: ThreadId;
      turnId: TurnId;
      turnStatus: CodexTurnStatus;
      item: CodexThreadItem;
    }
  | {
      kind: "runtime-thread-item";
      threadId: ThreadId;
      turnId: TurnId;
      item: CodexThreadItem;
      eventId: RuntimeEventId;
    }
  | {
      kind: "agent-message-delta";
      threadId: ThreadId;
      turnId: TurnId;
      itemId: CodexThreadItemId;
      delta: PlainText;
      eventId: RuntimeEventId;
    }
  | {
      kind: "runtime-error";
      threadId: ThreadId;
      turnId: TurnId;
      error: CodexTurnError;
      willRetry: boolean;
      eventId: RuntimeEventId;
    }
  | {
      kind: "turn-completed";
      threadId: ThreadId;
      turnId: TurnId;
      status: CodexTurnStatus;
      error: CodexTurnError | null;
      eventId: RuntimeEventId;
    }
  | {
      kind: "json-rpc-rejection";
      requestId: CodexRequestId;
      message: PlainText;
      data: StructuredValue | null;
    }
  | {
      kind: "system-warning";
      threadId: ThreadId | null;
      message: PlainText;
    };
```

ACL 必须保留 `Turn -> ThreadItem[]` 结构直到生成 `ConversationProjectionInput`。不得把 restored `ThreadItem` 打平后再猜 `turnId`。

## Invariant

### ConversationView

- 同一时间最多绑定一个 selected `Thread`。
- `selection.kind = "none"` 时，不得存在 `Conversation`、`Composer.threadId`、`RecoveringError`。
- `selection.kind = "selected"` 时，`Conversation.threadId`、`Composer.threadId`、`RecoveringError.threadId` 必须与 selected `ThreadId` 一致。
- 不能用空 `Conversation.items` 表达无 `Thread` 选中。
- `RecoveringError`、`ConversationViewNotice` 不属于 `Conversation.items`。

### Timeline

- `Conversation.items` 只能包含 `message`、`work-trace`、`unknown`、`error`。
- 每个 `ConversationItem` 必须归属当前 selected `Thread`。
- 每个 `ConversationItem` 必须归属一个 `Turn`。
- 无法归属到 `Turn` 的错误或 warning 走 `ConversationViewNotice`。
- `sequence` 一旦分配，不因 live delta 更新而改变。
- finalized item 不能被普通 delta 覆盖。
- 恢复历史得到的 timeline 以 Codex 可重建的 `Turn -> ThreadItem[]` 为准。

### Error

- `willRetry = true` 绝不能投影为 `ErrorItem`。
- `willRetry = false` 且可归属当前 `Thread` 和 `Turn` 的 Codex error notification 必须投影为 `ErrorItem`。
- `turn/completed status = failed` 且可归属当前 `Thread` 和 `Turn` 的 `TurnError` 必须投影为 `ErrorItem`。
- `ErrorItem.errorSource` 必须精确表达错误来自 `codex-error-notification` 还是 `codex-turn-completed`。
- 错误去重只允许使用 `turnId + error.message`。
- `ErrorItem` 必须保留来源中可用的错误字段。

### RecoveringError

- 只允许绑定当前 active `Turn`。
- 同一个 active `Turn` 同时最多存在一个。
- 新的 `willRetry = true` error notification 必须覆盖旧值。
- 同一 active `Turn` 收到正常 `item/*` delta、progress、completed 或 `turn/completed` 时必须清除。
- 不得持久化为正式 `ConversationItem`。

### Composer

- 空草稿不能发送。
- 没有 selected `Thread` 时不能发送、steer 或 interrupt。
- `Conversation` 正在恢复且无可读 timeline 时不能发送。
- 连接不可用或目标 active/idle 状态不明确时不能发送。
- 已知无 active `Turn` 时，发送草稿只能映射为 Codex `turn/start`。
- 已知有 active `Turn` 时，发送草稿只能映射为 Codex `turn/steer`。
- `turn/steer` 必须携带 `expectedTurnId`。
- My-Code-X 不预判 Codex 是否会接受 `turn/steer`；Codex 拒绝 `turn/steer` 时必须保留或恢复原 draft 并 raise notice。
- `turn/interrupt` 必须显式来自 interrupt 主操作。
- `turn/interrupt` 必须携带当前已知 active `Turn` 的 `turnId`。
- `turn/interrupt` 不消耗 Composer draft。
- Codex 接受发送请求前不得清空 draft。
- Codex 拒绝发送、steer 或 interrupt 请求后必须保留或恢复原 draft，并 raise notice。
- Composer 不伪造 committed `ConversationItem`。

## Command

- `SelectConversation(threadId)`
- `ClearConversationSelection`
- `RestoreConversation(threadId)`
- `ApplyConversationProjectionInput(input)`
- `RaiseConversationViewNotice(source)`
- `UpdateComposerDraft(threadId, text)`
- `SubmitComposerDraft(threadId, draft)`
- `InterruptActiveTurn(threadId, turnId)`
- `ClearComposerDraft(threadId, submittedDraftId)`
- `PreserveComposerDraft(threadId, draft, reason)`
- `ToggleConversationItemDetails(itemId)`

## Domain Event

### Conversation

- `ConversationSelected`
- `ConversationCleared`
- `ConversationRestoreStarted`
- `ConversationRestored`
- `ConversationRestoreFailed`
- `ConversationBecameEmpty`
- `ConversationFreshnessBecameUncertain`
- `ConversationTimelineSynced`

### Projection

- `MessageItemProjected`
- `MessageItemDeltaApplied`
- `MessageItemFinalized`
- `WorkTraceItemProjected`
- `UnknownItemProjected`
- `ErrorItemProjected`
- `DuplicateErrorItemSuppressed`
- `ConversationItemUpdated`
- `ConversationItemFinalized`

### Recovering Error

- `RecoveringErrorShown`
- `RecoveringErrorReplaced`
- `RecoveringErrorCleared`

### Notice

- `ConversationViewNoticeRaised`

### Composer

- `ComposerDraftChanged`
- `ComposerDraftPreserved`
- `ComposerDraftCleared`
- `ThreadStartRequested`
- `ThreadSteerRequested`
- `ThreadInterruptRequested`
- `ThreadActionAccepted`
- `ThreadActionRejected`

## Policy

### TimelineProjectionPolicy

决定 `ConversationProjectionInput` 如何投影：

- `userMessage` -> `MessageItem`
- `agentMessage` -> `MessageItem`
- 已知工作痕迹 -> `WorkTraceItem`
- 未识别但可归属到当前 `Turn` 的来源 -> `UnknownItem`
- `runtime-error willRetry = false` -> `ErrorItem` with `errorSource.kind = "codex-error-notification"`
- `turn-completed status = failed` -> `ErrorItem` with `errorSource.kind = "codex-turn-completed"`
- `runtime-error willRetry = true` -> `RecoveringErrorPolicy`
- JSON-RPC error、系统级 warning、无法归属到当前 `Turn` 的错误 -> `ConversationViewNoticePolicy`

### ErrorDeduplicationPolicy

只处理一个规则：

- 同一个 `Turn` 先收到 `willRetry = false` error notification，后收到 `turn/completed status = failed`
- 且 `turnId` 相同、`error.message` 相同
- 则抑制第二个 `ErrorItem`

不添加其他错误去重规则。

### RecoveringErrorPolicy

- `willRetry = true` 时显示 `RecoveringError`。
- 同一 active `Turn` 再次收到 `willRetry = true` 时覆盖。
- 同一 active `Turn` 收到正常进展或 `turn/completed` 时清除。
- 后续失败按正式 `ErrorItem` 规则投影。

### ComposerActionPolicy

输入：

- selected `Thread`
- `ConversationTimelineState`
- `ConversationConnectionState`
- `ActiveTurnState`
- draft text
- UI 主操作模式

输出：

```ts
type ComposerPrimaryAction =
  | { kind: "send-start" }
  | { kind: "send-steer"; expectedTurnId: ExpectedTurnId }
  | { kind: "interrupt"; turnId: TurnId }
  | { kind: "disabled"; reason: ComposerDisabledReason };
```

规则：

- 无 selected `Thread` -> `disabled(no-thread-selected)`
- 无可读 timeline 且正在恢复 -> `disabled(conversation-restoring)`
- 连接不可用 -> `disabled(connection-unavailable)`
- active/idle 状态不明确 -> `disabled(target-state-unknown)`
- 草稿为空且主操作是发送 -> `disabled(empty-draft)`
- 已知无 active `Turn` 且主操作是发送 -> `send-start`
- 已知有 active `Turn` 且主操作是发送 -> `send-steer(expectedTurnId)`
- active `Turn` 且主操作是 interrupt -> `interrupt(turnId)`
- 无 active `Turn` 且主操作是 interrupt -> `disabled(no-active-turn)`
- `expectedTurnId` 由当前已知 active `Turn` 的 `turnId` 派生，不来自 UI 输入。

### ConversationTimelineStatePolicy

- 无 selected `Thread` 不属于 timeline state。
- 恢复中且无可读 timeline -> `restoring`
- 恢复成功但无 item -> `empty`
- 恢复失败且无可读 timeline -> `restore-failed`
- 已有可读 timeline 且同步中 -> `readable-syncing`
- 已有可读 timeline 且新鲜度未知 -> `readable-freshness-uncertain`
- Codex `Turn` 运行状态不由 timeline state 表达。

### ConversationViewNoticePolicy

- JSON-RPC error response -> `ConversationViewNotice`
- 系统级 warning -> `ConversationViewNotice`
- 无法归属到当前 `Turn` 的错误 -> `ConversationViewNotice`
- Composer action rejected -> `ConversationViewNotice`，并保留草稿

## Repository Interface

```ts
interface ConversationViewRepository {
  getCurrent(): Promise<ConversationView>;
  save(view: ConversationView): Promise<void>;
}

interface ComposerDraftRepository {
  get(threadId: ThreadId): Promise<ComposerDraft | null>;
  save(draft: ComposerDraft): Promise<void>;
  delete(threadId: ThreadId): Promise<void>;
}

interface ConversationProjectionRepository {
  get(threadId: ThreadId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  delete(threadId: ThreadId): Promise<void>;
}
```

`ConversationProjectionRepository` 是可选投影缓存，不是 Codex `Thread` 的 source of truth。

## External Port

### CodexRuntimePort

```ts
interface CodexRuntimePort {
  restoreThread(threadId: ThreadId): Promise<CodexThreadRestoreResult>;

  startTurn(input: StartTurnInput): Promise<TurnStartAccepted>;
  steerTurn(input: SteerTurnInput): Promise<TurnSteerAccepted>;
  interruptTurn(input: InterruptTurnInput): Promise<TurnInterruptAccepted>;

  subscribe(threadId: ThreadId): AsyncIterable<ConversationProjectionInput>;
}

type StartTurnInput = {
  threadId: ThreadId;
  input: PlainText;
  overrides: TurnStartOverrides;
};

type SteerTurnInput = {
  threadId: ThreadId;
  input: PlainText;
  expectedTurnId: ExpectedTurnId;
};

type InterruptTurnInput = {
  threadId: ThreadId;
  turnId: TurnId;
};

type TurnStartOverrides = { kind: "none" };

type TurnStartAccepted = { turnId: TurnId };
type TurnSteerAccepted = { turnId: TurnId };
type TurnInterruptAccepted = { turnId: TurnId };
```

规则：

- 每个发送给 Codex app-server 的参数都必须是明确决策。
- Conversation View v1 只把 `PlainText` 映射为单个 Codex text `UserInput`，`text_elements` 为空。
- `turn/start` override 当前全部显式省略为 `TurnStartOverrides.kind = "none"`。
- JSON-RPC error response 不在 port 内吞掉。
- Codex 原生 payload 在 ACL 边界 parse/validate 后进入 domain。

### ClientEventPublisher

```ts
interface ClientEventPublisher {
  publish(event: ClientEvent): Promise<void>;
  publishSnapshot(snapshot: ClientSnapshot): Promise<void>;
}
```

`ClientEvent` 不是 `ConversationProjectionInput`。`ClientSnapshot` 不是 Codex 历史 snapshot。

## Application Service

### SelectConversationService

流程：

1. 读取当前 `ConversationView`。
2. 应用 `SelectConversation(threadId)`。
3. 读取并恢复当前 `Thread` 的 `ComposerDraft`。
4. 保存 `ConversationView`。
5. 调用 `CodexRuntimePort.restoreThread(threadId)`。
6. 遍历返回的 Codex `Turn`，用父级 `Turn.id` 投影其中的 `ThreadItem`。
7. 更新 `ConversationTimelineState`。
8. 保存并发布 `ClientSnapshot`。

### RestoreConversationService

流程：

1. 校验当前有 selected `Thread`。
2. 设置恢复状态；如果已有可读 timeline，则保留。
3. 调用 `CodexRuntimePort.restoreThread(threadId)`。
4. 遍历返回的 Codex `Turn`，用父级 `Turn.id` 投影其中的 `ThreadItem`。
5. 成功后进入 `readable` 或 `empty`。
6. 失败且无可读 timeline -> `restore-failed`。
7. 失败但已有 timeline -> `readable-freshness-uncertain` 并 raise notice。

### ApplyConversationProjectionInputService

流程：

1. 读取当前 `ConversationView`。
2. input 不属于当前 selected `Thread` 时，不进入当前 view。
3. `runtime-error willRetry = true` 交给 `RecoveringErrorPolicy`。
4. 可投影为正式 item 的 input 交给 `TimelineProjectionPolicy`。
5. failure 经过 `ErrorDeduplicationPolicy`。
6. JSON-RPC error、system warning、unattributed error 生成 notice。
7. 更新 timeline state 和 freshness。
8. 保存 aggregate。
9. 交给 batching publisher 推送 client update。

### SubmitComposerService

流程：

1. 读取当前 `ConversationView` 和 draft。
2. 调用 `ComposerActionPolicy`。
3. `disabled` 时保留草稿并 raise notice。
4. `send-start` 时构造 `StartTurnInput` 并调用 `CodexRuntimePort.startTurn`。
5. `send-steer` 时构造 `SteerTurnInput` 并调用 `CodexRuntimePort.steerTurn`。
6. Codex 接受后清空对应 draft。
7. Codex 拒绝或 port error 后保留或恢复 draft，并 raise notice。
8. 不创建 `MessageItem`。

### InterruptTurnService

流程：

1. 读取当前 `ConversationView`。
2. 调用 `ComposerActionPolicy`，要求输出 `interrupt(turnId)`。
3. disabled 时 raise notice。
4. 构造 `InterruptTurnInput` 并调用 `CodexRuntimePort.interruptTurn`。
5. 不清空 Composer draft。
6. 后续 timeline 变化由 `ConversationProjectionInput` 投影。

### UpdateComposerDraftService

流程：

1. 有 selected `Thread` 时保存 `ComposerDraft`。
2. 更新 `ConversationView.Composer`。
3. 不触发 Codex runtime。

### ToggleConversationItemDetailsService

流程：

1. 读取当前 `ConversationView`。
2. 找到 item。
3. `work-trace` 或 `unknown` 切换 `DisclosureState`。
4. `message` 或 `error` 返回 typed domain error。
5. 保存并发布 client event。

## Domain Service

### ConversationProjectionService

负责把 `ConversationProjectionInput` 投影成 domain 结果。

```ts
type ProjectionResult =
  | { kind: "append-item"; item: ConversationItem }
  | { kind: "update-item"; itemId: ConversationItemId; patch: ConversationItemPatch }
  | { kind: "show-recovering-error"; error: RecoveringError }
  | { kind: "clear-recovering-error"; turnId: TurnId }
  | { kind: "raise-notice"; notice: ConversationViewNotice }
  | { kind: "suppress-duplicate-error"; key: ErrorProjectionKey }
  | { kind: "ignore"; reason: ProjectionIgnoreReason };
```

## Factory

### ConversationItemFactory

```ts
interface ConversationItemFactory {
  message(input: MessageItemInput): MessageItem;
  workTrace(input: WorkTraceItemInput): WorkTraceItem;
  unknown(input: UnknownItemInput): UnknownItem;
  error(input: ErrorItemInput): ErrorItem;
}
```

规则：

- Factory 不判断来源分类。
- Factory 统一分配 `ConversationItemId` 和 `TimelineSequence`。
- Factory 拒绝用 `willRetry = true` 创建 `ErrorItem`。
- Factory 要求 `ErrorItemInput.errorSource` 明确区分 `codex-error-notification` 和 `codex-turn-completed`。

## ACL

### CodexRuntimeACL

负责把 Codex app-server 原生协议翻译成 My-Code-X domain 输入。

输入：

- JSON-RPC response
- Codex notification
- Codex `Turn`
- Codex `ThreadItem`
- Codex `TurnError`
- Codex connection/system warning

输出：

- `CodexThreadRestoreResult`
- `ConversationProjectionInput`
- `TurnStartAccepted`
- `TurnSteerAccepted`
- `TurnInterruptAccepted`
- typed rejection / typed port error
- `ThreadRef`
- `TurnId`
- `ExpectedTurnId`
- `StructuredField[]`

规则：

- 外部数据在 ACL 边界 parse/validate。
- 进入 domain 后不再传 raw untyped payload。
- JSON-RPC error response 不伪装成 runtime item。
- 无法归属到 current `Turn` 的错误标记为 unattributed，交给 notice policy。
- Codex 原生 type/status 作为 `CodexNativeType` / `CodexStatus` 保留。
- UI mock 中的示例 type、code、attempt count 和时间字段不作为 Codex contract。

## CQRS / Saga / Event Sourcing

轻量使用 CQRS，不引入框架。

- Command side 使用 application service。
- Read side 输出 `ClientSnapshot` 和 `ClientEvent`。
- 500ms batching 是 delivery concern，不属于 domain entity。

不使用 Saga：

- 当前没有跨 aggregate 长事务。
- 提交失败恢复规则是保留 draft 并 raise notice。

不使用 Event Sourcing：

- Codex `Thread` 是上游历史 source of truth。
- `Conversation` 是只读投影。
- 恢复历史以 Codex 可重建 `Turn -> ThreadItem[]` 为准。

## Typed Domain Error

建议定义：

- `NoThreadSelectedError`
- `ThreadMismatchError`
- `ConversationRestoringError`
- `ConnectionUnavailableError`
- `TargetStateUnknownError`
- `EmptyComposerDraftError`
- `NoActiveTurnError`
- `ExpectedTurnIdMissingError`
- `InvalidConversationItemKindError`
- `InvalidRecoveringErrorProjectionError`
- `UnattributedTimelineError`
- `DuplicateFinalizedItemUpdateError`
- `UnsupportedConversationItemDisclosureError`
