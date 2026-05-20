# Conversation View API Contract

本文档只定义 Conversation View 的前后端 API contract。产品语义、领域模型与 Codex protocol 背景见同目录下的 feature description、BDD、domain model 与 Codex interface 文档。

## Transport

采用 REST + SSE。

| Concern | Transport |
| --- | --- |
| 读取 view | REST |
| 提交用户 command | REST |
| 接收 live update | SSE |

规则：

- REST response 返回 My-Code-X DTO，不返回 Codex raw protocol payload。
- `GET` 不隐式调用 Codex `thread/resume`。
- `send` / `steer` 使用服务端保存的 draft，不在 command body 里重复传文本。
- SSE event 是 My-Code-X display event，不是 Codex notification 原样转发。
- `/threads/{threadId}` endpoints 是 thread-scoped contract；`threadId` 由上层 selection 提供，Conversation View 不拥有 Thread 选中状态。

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/conversation-view/current` | `ConversationHostViewResponse` |
| `GET` | `/api/conversation-view/threads/{threadId}` | `ConversationViewResponse` |
| `POST` | `/api/conversation-view/threads/{threadId}/restore` | `ConversationViewResponse` |
| `POST` | `/api/conversation-view/threads/{threadId}/sync` | `ConversationViewResponse` |
| `GET` | `/api/conversation-view/threads/{threadId}/events` | `text/event-stream` |
| `PUT` | `/api/conversation-view/threads/{threadId}/draft` | `ChangeComposerDraftResponse` |
| `POST` | `/api/conversation-view/threads/{threadId}/commands/send` | `SendUserInputResponse` |
| `POST` | `/api/conversation-view/threads/{threadId}/commands/steer` | `SendSteerInputResponse` |
| `POST` | `/api/conversation-view/threads/{threadId}/commands/interrupt` | `InterruptTurnResponse` |

`GET /api/conversation-view/current` 是 Workspace Thread Browser / Selection State 未完成前的 transitional host contract。最终 Thread selection 应由 Workspace Thread Browser 或 App Shell selection contract 管理，然后使用 thread-scoped Conversation View endpoints 读取内容。

## Common Types

```ts
type ThreadId = string;
type TurnId = string;
type TimelineItemId = string;
type NoticeId = string;
type ClientRequestId = string;
type ISODateTime = string;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
```

## Request DTO

`threadId` 统一来自 path，body 不重复传。

```ts
interface RestoreConversationRequest {
  clientRequestId?: ClientRequestId;
}

interface SyncConversationRequest {
  clientRequestId?: ClientRequestId;
}

interface ChangeComposerDraftRequest {
  text: string;
  clientRequestId?: ClientRequestId;
}

interface SendUserInputRequest {
  clientRequestId?: ClientRequestId;
}

interface SendSteerInputRequest {
  expectedTurnId: TurnId;
  clientRequestId?: ClientRequestId;
}

interface InterruptTurnRequest {
  turnId: TurnId;
  confirmed: true;
  clientRequestId?: ClientRequestId;
}
```

校验规则：

| Request | Rule |
| --- | --- |
| `ChangeComposerDraftRequest.text` | 必填，可以是空字符串；保存时不 trim |
| `SendUserInputRequest` | 使用服务端 draft；draft 为空返回 `EMPTY_COMPOSER_DRAFT` |
| `SendSteerInputRequest.expectedTurnId` | 必填且非空 |
| `SendSteerInputRequest` | 使用服务端 draft；draft 为空返回 `EMPTY_COMPOSER_DRAFT` |
| `InterruptTurnRequest.turnId` | 必填且非空 |
| `InterruptTurnRequest.confirmed` | 必须是 `true` |

SSE reconnect 使用标准 `Last-Event-ID` header。`?lastEventId=` 只作为 fallback。

## Response Wrapper

```ts
interface ApiSuccess<T> {
  ok: true;
  data: T;
}

interface ApiFailure {
  ok: false;
  error: ApiError;
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

REST endpoint 返回 `ApiResponse<T>`，即 `ApiSuccess<T> | ApiFailure`。

## ConversationView DTO

`ConversationView` 只表达一个已选中 `Thread` 的可读投影。无选中 `Thread` 的状态不属于 thread-scoped `ConversationView`，只在 transitional `ConversationHostView` 中表达。

```ts
type ConversationViewResponse = ApiResponse<ConversationView>;

interface ConversationView {
  thread: ThreadContext;
  pageState: ConversationPageState;
  timeline: TimelineItem[];
  composer: ComposerView;
  notices: PageNotice[];
  sync: ConversationSyncState;
}
```

### ConversationHostView

```ts
type ConversationHostViewResponse = ApiResponse<ConversationHostView>;

type ConversationHostView =
  | {
      kind: "noSelectedThread";
      target: ActiveConversationTargetNone;
    }
  | {
      kind: "threadSelected";
      target: ActiveConversationTargetThread;
      conversation: ConversationView;
    };

type ActiveConversationTarget =
  | ActiveConversationTargetNone
  | ActiveConversationTargetThread;

interface ActiveConversationTargetNone {
  kind: "none";
  reason: NoSelectedThreadReason;
}

interface ActiveConversationTargetThread {
  kind: "thread";
  threadId: ThreadId;
}

type NoSelectedThreadReason =
  | "initial"
  | "threadArchived"
  | "threadUnavailable"
  | "unknown";
```

规则：

- `ConversationHostView` 只为当前迁移阶段提供 host-level selection bridge。
- `kind: "noSelectedThread"` 不包含 `ConversationView`、`ThreadContext` 或 `ComposerView`。
- `kind: "threadSelected"` 的 `conversation.thread.threadId` 必须等于 `target.threadId`。
- Workspace Thread Browser 完成 Thread selection contract 后，前端应优先消费 selection/snapshot，再调用 `/threads/{threadId}`。

### ThreadContext

```ts
interface ThreadContext {
  threadId: ThreadId;
  title: string | null;
  cwd: string | null;
  status: ThreadRunStatus;
  activeTurnId: TurnId | null;
  updatedAt: ISODateTime | null;
}

type ThreadRunStatus =
  | "notLoaded"
  | "idle"
  | "active"
  | "systemError"
  | "unknown";
```

### ConversationPageState

```ts
type ConversationPageState =
  | { kind: "ready" }
  | { kind: "restoring"; hasReadableContent: boolean }
  | { kind: "empty" }
  | { kind: "restoreFailed"; message: string }
  | { kind: "stale"; message: string };
```

### TimelineItem

```ts
interface TimelineItemBase {
  id: TimelineItemId;
  turnId: TurnId | null;
  occurredAt: ISODateTime | null;
  status: TimelineStatus;
}

type TimelineStatus =
  | "running"
  | "completed"
  | "failed"
  | "unknown";

type TimelineItem =
  | MessageTimelineItem
  | WorkProgressTimelineItem
  | FailureTimelineItem
  | UnknownTimelineItem;
```

```ts
interface MessageTimelineItem extends TimelineItemBase {
  kind: "message";
  message: MessageContent;
}

type MessageRole = "user" | "agent";

interface MessageContent {
  role: MessageRole;
  text: string;
  markdown: boolean;
  copyText: string;
}
```

```ts
interface WorkProgressTimelineItem extends TimelineItemBase {
  kind: "workProgress";
  workProgress: WorkProgressContent;
}

interface WorkProgressContent {
  sourceType: string;
  label: string;
  summary: string | null;
  detail: GenericDetail;
}
```

```ts
interface FailureTimelineItem extends TimelineItemBase {
  kind: "failure";
  failure: FailureContent;
}

interface FailureContent {
  message: string;
  detail: GenericDetail | null;
}
```

```ts
interface UnknownTimelineItem extends TimelineItemBase {
  kind: "unknown";
  unknown: UnknownContent;
}

interface UnknownContent {
  sourceType: string;
  statusLabel: string | null;
  detail: GenericDetail;
}
```

### GenericDetail

```ts
interface GenericDetail {
  fields: GenericField[];
  rawPreview?: JsonValue;
}

interface GenericField {
  key: string;
  value: JsonValue;
}
```

### ComposerView

```ts
interface ComposerView {
  threadId: ThreadId;
  draft: string;
  action: ComposerAction;
}

type ComposerAction =
  | { kind: "send"; enabled: true }
  | { kind: "steer"; enabled: true; expectedTurnId: TurnId }
  | { kind: "interrupt"; enabled: true; turnId: TurnId; requiresConfirmation: true }
  | { kind: "disabled"; enabled: false; reason: ComposerDisabledReason };

type ComposerDisabledReason =
  | "restoring"
  | "connectionUnavailable"
  | "unreliableThreadTarget"
  | "unreliableTurnTarget"
  | "emptyDraft"
  | "systemError"
  | "unknown";
```

### PageNotice

```ts
interface PageNotice {
  id: NoticeId;
  level: PageNoticeLevel;
  message: string;
  createdAt: ISODateTime;
  autoDismissMs: number | null;
  detail: GenericDetail | null;
}

type PageNoticeLevel = "info" | "warning" | "error";
```

### ConversationSyncState

```ts
interface ConversationSyncState {
  connection: ConversationConnectionState;
  freshness: ConversationFreshness;
  lastSyncedAt: ISODateTime | null;
}

type ConversationConnectionState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected"
  | "unknown";

type ConversationFreshness =
  | "fresh"
  | "syncing"
  | "stale"
  | "unknown";
```

### Command Responses

```ts
type ChangeComposerDraftResponse = ApiResponse<ComposerView>;
type SendUserInputResponse = ApiResponse<ComposerView>;
type SendSteerInputResponse = ApiResponse<ComposerView>;
type InterruptTurnResponse = ApiResponse<ComposerView>;
```

## Lifecycle Rules

### Page State

| State | Timeline | Composer |
| --- | --- | --- |
| `restoring`, no readable content | restoring state | disabled |
| `restoring`, has readable content | keep old timeline | usually disabled |
| `ready` | show timeline | by `composer.action` |
| `empty` | empty state | by thread state |
| `restoreFailed` | no timeline failure | disabled or connection-state disabled |
| `stale` | keep old timeline | enabled only if target is reliable |

### Composer Action

| Condition | Action |
| --- | --- |
| `idle` + non-empty draft + reliable `threadId` | `send` |
| `active` + non-empty draft + reliable `expectedTurnId` | `steer` |
| `active` + empty draft + reliable `turnId` | `interrupt` |
| `notLoaded` / `systemError` / `unknown` | `disabled` |

### Timeline Item Transition

| Transition | Allowed |
| --- | --- |
| missing -> `running` | yes |
| missing -> `completed` | yes |
| `running` -> `completed` | yes |
| `running` -> `failed` | yes |
| `unknown` -> `completed` / `failed` | yes |
| `completed` -> `running` | no |
| `completed` -> `failed` | no |
| `failed` -> `running` | no |

### Draft Lifecycle

| Event | Draft |
| --- | --- |
| draft changed | save to `threadId` |
| send accepted | clear same-thread draft |
| steer accepted | clear same-thread draft |
| send/steer rejected | keep draft |
| interrupt accepted/rejected | keep draft |
| thread switched | restore target-thread draft |

Thread switch 由上层 selection contract 触发；Conversation View 只读取切换后的 `threadId` 对应 draft。

## Error Contract

```ts
interface ApiError {
  code: ApiErrorCode;
  message: string;
  httpStatus: number;
  target?: ErrorTarget;
  retryable: boolean;
  notice?: PageNotice;
  details?: GenericDetail;
}

interface ErrorTarget {
  threadId?: ThreadId;
  turnId?: TurnId;
  timelineItemId?: TimelineItemId;
  field?: string;
}

type ApiErrorCode =
  | "THREAD_NOT_FOUND"
  | "THREAD_MISMATCH"
  | "EMPTY_COMPOSER_DRAFT"
  | "NO_RELIABLE_THREAD_TARGET"
  | "NO_RELIABLE_STEER_TARGET"
  | "NO_RELIABLE_INTERRUPT_TARGET"
  | "INTERRUPT_NOT_CONFIRMED"
  | "INVALID_REQUEST"
  | "INVALID_TIMELINE_TRANSITION"
  | "TIMELINE_ITEM_NOT_FOUND"
  | "UNKNOWN_TIMELINE_ITEM_REJECTED"
  | "CODEX_REQUEST_REJECTED"
  | "CODEX_CONNECTION_UNAVAILABLE"
  | "CODEX_PROTOCOL_ERROR"
  | "RESTORE_FAILED"
  | "SYNC_FAILED"
  | "INTERNAL_ERROR";
```

### HTTP Mapping

| HTTP | Codes |
| ---: | --- |
| `400` | `INVALID_REQUEST`, `EMPTY_COMPOSER_DRAFT`, `INTERRUPT_NOT_CONFIRMED` |
| `404` | `THREAD_NOT_FOUND` |
| `409` | `THREAD_MISMATCH`, `NO_RELIABLE_THREAD_TARGET`, `NO_RELIABLE_STEER_TARGET`, `NO_RELIABLE_INTERRUPT_TARGET`, `INVALID_TIMELINE_TRANSITION`, `TIMELINE_ITEM_NOT_FOUND` |
| `422` | `UNKNOWN_TIMELINE_ITEM_REJECTED` |
| `502` | `CODEX_REQUEST_REJECTED`, `CODEX_PROTOCOL_ERROR` |
| `503` | `CODEX_CONNECTION_UNAVAILABLE`, `RESTORE_FAILED`, `SYNC_FAILED` |
| `500` | `INTERNAL_ERROR` |

### Domain Error Mapping

| Domain Error | ApiErrorCode | HTTP | retryable | Draft |
| --- | --- | ---: | --- | --- |
| `ThreadMismatch` | `THREAD_MISMATCH` | `409` | false | unchanged |
| `TimelineItemNotFound` | `TIMELINE_ITEM_NOT_FOUND` | `409` | true | unchanged |
| `UnknownTimelineItemRejected` | `UNKNOWN_TIMELINE_ITEM_REJECTED` | `422` | false | unchanged |
| `InvalidTimelineTransition` | `INVALID_TIMELINE_TRANSITION` | `409` | true | unchanged |
| `EmptyComposerDraft` | `EMPTY_COMPOSER_DRAFT` | `400` | false | unchanged |
| `NoReliableThreadTarget` | `NO_RELIABLE_THREAD_TARGET` | `409` | false | unchanged |
| `NoReliableSteerTarget` | `NO_RELIABLE_STEER_TARGET` | `409` | false | keep |
| `NoReliableInterruptTarget` | `NO_RELIABLE_INTERRUPT_TARGET` | `409` | false | keep |
| `InterruptNotConfirmed` | `INTERRUPT_NOT_CONFIRMED` | `400` | false | keep |

Codex JSON-RPC error 使用 `CODEX_REQUEST_REJECTED` 或 `CODEX_PROTOCOL_ERROR`，并保留 upstream `code/message/data` 到 `details.fields[].value`。

## SSE Events

```http
GET /api/conversation-view/threads/{threadId}/events
Accept: text/event-stream
```

Frame：

```text
id: <eventId>
event: <eventType>
data: <ConversationViewEvent JSON>
```

```ts
type ConversationViewEvent =
  | ConversationSnapshotEvent
  | TimelineItemAddedEvent
  | TimelineItemUpdatedEvent
  | AgentMessageDeltaEvent
  | TimelineItemCompletedEvent
  | TimelineFailureAddedEvent
  | ComposerUpdatedEvent
  | ThreadContextUpdatedEvent
  | PageStateChangedEvent
  | PageNoticeRaisedEvent
  | SyncStateChangedEvent
  | StreamHeartbeatEvent;

interface ConversationViewEventBase {
  eventId: string;
  threadId: ThreadId;
  occurredAt: ISODateTime;
}
```

```ts
interface ConversationSnapshotEvent extends ConversationViewEventBase {
  type: "conversation.snapshot";
  view: ConversationView;
}

interface TimelineItemAddedEvent extends ConversationViewEventBase {
  type: "timeline.itemAdded";
  item: TimelineItem;
  insertAfterId: TimelineItemId | null;
}

interface TimelineItemUpdatedEvent extends ConversationViewEventBase {
  type: "timeline.itemUpdated";
  item: TimelineItem;
}

interface AgentMessageDeltaEvent extends ConversationViewEventBase {
  type: "timeline.agentMessageDelta";
  itemId: TimelineItemId;
  turnId: TurnId;
  delta: string;
}

interface TimelineItemCompletedEvent extends ConversationViewEventBase {
  type: "timeline.itemCompleted";
  item: TimelineItem;
}

interface TimelineFailureAddedEvent extends ConversationViewEventBase {
  type: "timeline.failureAdded";
  item: FailureTimelineItem;
  deduped: boolean;
}

interface ComposerUpdatedEvent extends ConversationViewEventBase {
  type: "composer.updated";
  composer: ComposerView;
}

interface ThreadContextUpdatedEvent extends ConversationViewEventBase {
  type: "threadContext.updated";
  thread: ThreadContext;
}

interface PageStateChangedEvent extends ConversationViewEventBase {
  type: "pageState.changed";
  pageState: ConversationPageState;
}

interface PageNoticeRaisedEvent extends ConversationViewEventBase {
  type: "pageNotice.raised";
  notice: PageNotice;
}

interface SyncStateChangedEvent extends ConversationViewEventBase {
  type: "syncState.changed";
  sync: ConversationSyncState;
}

interface StreamHeartbeatEvent extends ConversationViewEventBase {
  type: "stream.heartbeat";
}
```

规则：

- `eventId` 在同一 `threadId` 内单调。
- snapshot 是全量替换。
- delta 只应用到已存在的 agent message item。
- completed/update event 的完整 item 是权威状态。
- `pageNotice.raised` 不进入 timeline。

### Reconnect

| Condition | Behavior |
| --- | --- |
| `Last-Event-ID` 可补齐 | 重放缺失 events，然后继续 live |
| `Last-Event-ID` 太旧或未知 | 发送 `conversation.snapshot` |
| `Last-Event-ID` 不属于该 thread | 忽略并发送 `conversation.snapshot` |
| event buffer 丢失 | 发送 `conversation.snapshot` |
| Codex connection disconnected | stream 可保持，发送 `syncState.changed` |
| Thread 不可见或不存在 | 返回 404 或关闭 stream |

## Idempotency

`clientRequestId` 幂等范围：

```text
threadId + commandName + clientRequestId
```

| Command | Rule |
| --- | --- |
| `RestoreConversation` | 重复请求返回当前或最近一次 restore 后的 `ConversationView` |
| `SyncConversation` | sync 正在进行时返回当前 view/syncing 状态 |
| `ChangeComposerDraft` | 同一 `threadId` draft 最终等于最后一次成功保存的 `text` |
| `SendUserInput` | 同一 id 不得产生第二个 `turn/start` |
| `SendSteerInput` | 同一 id 不得产生第二个 `turn/steer` |
| `InterruptTurn` | 同一 id 不得产生第二个 `turn/interrupt` |

`send` / `steer` accepted 后，同一 `clientRequestId` 重复请求不因为 draft 已清空而返回 `EMPTY_COMPOSER_DRAFT`。

## Authorization And Visibility

| Endpoint | Required Permission |
| --- | --- |
| `GET /api/conversation-view/current` | `conversation.current.read` |
| `GET /api/conversation-view/threads/{threadId}` | `conversation.read` |
| `POST /api/conversation-view/threads/{threadId}/restore` | `conversation.restore` |
| `POST /api/conversation-view/threads/{threadId}/sync` | `conversation.sync` |
| `GET /api/conversation-view/threads/{threadId}/events` | `conversation.events.subscribe` |
| `PUT /api/conversation-view/threads/{threadId}/draft` | `conversation.draft.write` |
| `POST /api/conversation-view/threads/{threadId}/commands/send` | `conversation.command.send` |
| `POST /api/conversation-view/threads/{threadId}/commands/steer` | `conversation.command.steer` |
| `POST /api/conversation-view/threads/{threadId}/commands/interrupt` | `conversation.command.interrupt` |

规则：

- 不可见或不存在的 `threadId` 统一返回 `THREAD_NOT_FOUND`。
- body 不允许覆盖 `threadId`。
- `expectedTurnId` 或 `turnId` 必须属于 path `threadId` 的当前可靠 active turn。
- command 不得自动改投到另一个 active Thread。
- SSE 只推送 path `threadId` 的 display events。
- `/current` 不执行 Thread switch；它只读取当前 selection 并投影为 `ConversationHostView`。

## Sorting And Pagination

第一版不提供 timeline filter、search、pagination 参数。

排序规则：

- `ConversationView.timeline` 按 Codex 历史或 live event 的发生顺序升序返回。
- 同一 turn 内按 item 发生顺序返回。
- live update 插入位置由 `TimelineItemAddedEvent.insertAfterId` 指定。
- 前端不得按 `occurredAt` 自行重排。

SSE 的 `Last-Event-ID` 不是 timeline pagination cursor。

## Versioning

本项目是 monorepo，当前不引入 URL version：

```http
/api/conversation-view/threads/{threadId}
```

`/api/conversation-view/current` 是 transitional endpoint，不作为最终稳定 selection contract。

稳定 contract：

- endpoint path
- request DTO required fields
- response DTO discriminated union `kind` / `type`
- `ApiError.code`
- `TimelineItem.kind`
- `ComposerAction.kind`
- SSE `event` name and `data.type`

前端 fallback：

- unknown `TimelineItem.kind` 按 `unknown` 展示。
- unknown `ThreadRunStatus` 禁用 composer。
- unknown `ComposerAction.kind` 禁用 composer。
- unknown SSE event 忽略。
- unknown `ApiError.code` 按不可重试错误展示 page notice。

## Handler Mapping

| Endpoint | Handler | Application Service |
| --- | --- | --- |
| `GET /api/conversation-view/current` | `getCurrentConversationHostView` | read current selection + `ConversationQueryService.getConversation(threadId)` when selected |
| `GET /api/conversation-view/threads/{threadId}` | `getConversationView` | `ConversationQueryService.getConversation(threadId)` |
| `POST /api/conversation-view/threads/{threadId}/restore` | `restoreConversation` | `ConversationRecoveryService.restore(threadRef)` + query |
| `POST /api/conversation-view/threads/{threadId}/sync` | `syncConversation` | `ConversationRecoveryService.sync(threadRef)` + query |
| `GET /api/conversation-view/threads/{threadId}/events` | `subscribeConversationEvents` | `ConversationEventStreamService.subscribe(threadId, lastEventId)` |
| `PUT /api/conversation-view/threads/{threadId}/draft` | `changeDraft` | `ComposerService.changeDraft(threadId, text)` + query composer |
| `POST /api/conversation-view/threads/{threadId}/commands/send` | `sendUserInput` | `ComposerService.send(threadId)` + query composer |
| `POST /api/conversation-view/threads/{threadId}/commands/steer` | `sendSteerInput` | `ComposerService.steer(threadId, expectedTurnId)` + query composer |
| `POST /api/conversation-view/threads/{threadId}/commands/interrupt` | `interruptTurn` | `ComposerService.interrupt(threadId, turnId, confirmed)` + query composer |

Handler 只负责 HTTP/SSE 边界、鉴权、DTO 解析和 error mapping。Codex protocol 字段、JSON-RPC request id、notification method 和 raw payload 只能在 ACL/adapter 边界处理。
