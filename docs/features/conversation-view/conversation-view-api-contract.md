# API Contract — Conversation View

> 由 [BDD](./conversation-view-bdd.md) + [Domain Model](./conversation-view-domain-model.md) 推导。
> 术语见 [Ubiquitous Language](./domain-artifacts/conversation-view-ubiquitous-language.md)。

## Consumers & Scope

- **唯一 consumer**: My-Code-X 自有前端(移动端友好 web chat)。无第三方。
- **多连接对等**: 同一用户多设备/多 tab 可同时连同一后端、订阅同一对话;所有连接对等,无独占/活跃设备概念。
- **前端 dumb**: 本地仅持 draft、展开/折叠、滚动位置(不跨端同步);权威投影在后端。

### 边界声明(刻意排除)

- `ApplyRecoveredHistory` / `ApplyAuthoritativeState` / `ApplyLiveUpdate` **不在本 contract**。它们是 `AgentCliInboundPort` 实现入口,由 ACL adapter 在 infra 侧调用,属另一份 ACL 契约。前端只见「命令 + 订阅流」。
- `ResumeCursor` **不暴露**。续接由后端 `ConversationResyncProcess` 内部完成,前端无感知(transport concern 留在后端)。
- `PrimaryActionButton` 动作**由前端派生**(TurnState + 有无输入 + AgentCliCapability)。后端不计算按钮态,只供原料,避免策略分散。
- `title` / `workingDirectory` 不在本 contract;属对话选择/管理 feature(本 feature Out of Scope)。

## Transport

| 方向 | 风格 | 说明 |
|---|---|---|
| 后端 → 前端 | **SSE** (`text/event-stream`) | 按对话订阅,首帧全量 snapshot,之后增量;广播给该对话所有连接 |
| 前端 → 后端 | **REST** (`POST`) | 低频请求-响应;命令保真透传原始输入 |

命令默认 `202 Accepted`(结果异步走 SSE),唯 `RespondToPendingInteraction` 同步裁决(先到先得需即时结果)。

无服务端幂等键:重复发送由前端「在途禁重复」本地锁兜底;Sync/LoadHistory 后端幂等忽略;interaction 响应由 `ResponseLock` 兜底。

---

## Use Cases

### Commands (ProductUser 发起)

| Use Case | Input | Output | Precondition | Domain Events |
|---|---|---|---|---|
| LoadConversationHistory | conversationId | 202 | — (后端按 Phase 裁决,声明式幂等) | ConversationHistoryRecoveryStarted |
| SyncConversation | conversationId | 202 | Phase ∈ {Synced, SyncFailed} | ConversationSyncStarted |
| SubmitNormalInput | conversationId, text | 202 / Failed | — | NormalInputAccepted |
| AppendInstruction | conversationId, text, turnId? | 202 / Failed | turn 进行中 + cli 支持追加 | InstructionAppended |
| RequestWorkInterrupt | conversationId, turnId? | 202 / Failed | turn 进行中 + cli 支持中断 | (无独立成功事件,靠 TurnState) |
| RespondToPendingInteraction | interactionId, connectionId, optionId, supplement? | 200 / 409 / 422 | InteractionState=Pending | PendingInteractionResponseAccepted / Rejected |

### Subscription (后端 → 前端,广播)

| Use Case | 承载 |
|---|---|
| 订阅对话投影 | SSE 流首帧 snapshot,后续 phase/message/turn/interaction/toast 增量 |

读路径只有订阅流一处:无独立 GET projection / GET pending-list / GET capability;这些都由 snapshot 帧承载(YAGNI,避免读路径分裂)。

---

## Endpoints

| 方法 | 路径 | Use Case | 成功响应 |
|---|---|---|---|
| `GET` (SSE) | `/conversations/{conversationId}/events` | 订阅投影 | 200 `text/event-stream` |
| `POST` | `/conversations/{conversationId}/history-recovery` | LoadConversationHistory | 202 |
| `POST` | `/conversations/{conversationId}/sync` | SyncConversation | 202 |
| `POST` | `/conversations/{conversationId}/inputs` | SubmitNormalInput | 202 |
| `POST` | `/conversations/{conversationId}/instructions` | AppendInstruction | 202 |
| `POST` | `/conversations/{conversationId}/interrupt` | RequestWorkInterrupt | 202 |
| `POST` | `/interactions/{interactionId}/response` | RespondToPendingInteraction | 200 |

`interaction response` 用顶层 `/interactions/{id}`:interaction 软关联对话(domain model:`conversationId` 仅软关联),按 id 直接裁决更贴合 `PendingInteraction` 的独立 aggregate 边界。

**`/history-recovery` 与 `/sync` 是一对声明式幂等命令,均不碰订阅连接**:前端无脑发,后端按当前 Phase 裁决,前端永不判断要不要恢复/同步。

- `/history-recovery` = 「确保这对话已加载」。后端按 Phase:`∅`(无投影)→ 从头调 agent cli native recovery;`RecoveryFailed` → 重试恢复;已 `Synced`/活跃(多连接后到)→ no-op,该连接订阅流自然拿到 snapshot。首次打开与失败重试发**同一命令**,无特殊情况。
- `/sync` = 「确保已对齐后端权威状态」(连接活但疑似过期:切后台/弱网恢复)。


---

## SSE Event Contract

订阅 `/conversations/{id}/events` 后,后端先推 `snapshot`,之后按需推增量。所有事件用 SSE `event:` 命名 + JSON `data:`。

### `snapshot` — 首帧 / 重新基线

每次新订阅、或 sync 对齐后重新基线时推送全量:

```jsonc
event: snapshot
data: {
  "conversationId": "conv-1",
  "connectionId": "conn-abc",                 // 后端分配,RespondToInteraction 须回传
  "phase": { "kind": "Synced" },              // 见 Phase 判别联合
  "agentCapability": {                        // 供前端派生 PrimaryActionButton
    "supportsInterrupt": true,
    "supportsAppend": false
  },
  "messages": [ /* Message[] */ ],            // 已按 sequence 有序
  "turns": [ /* Turn[] */ ],
  "pendingInteractions": [ /* PendingInteraction[] */ ]
}
```

### 增量事件

```jsonc
// 相位流转(含 Recovery/Sync banner、ProtocolBroken 终态)
event: phase-changed
data: { "phase": { "kind": "Syncing" } }

// 新信息按 sequence 进入列表(INV-3)
event: message-appended
data: { "message": { /* Message */ } }

// 已存在信息就地更新(INV-2,不新增列表项);判别联合见下
event: message-updated
data: { "stableKey": "...", "mode": "append",  "delta": { "fields": [ { "name": "text", "value": "...增量..." } ] } }
// 或
data: { "stableKey": "...", "mode": "replace", "message": { /* 整条 Message */ } }

// turn 边界/状态/时间就地更新(INV-6,边界由 agent 提供)
event: turn-changed
data: { "turn": { /* Turn */ } }

// pending interaction 生命周期(广播给所有连接)
event: interaction-raised
data: { "interaction": { /* PendingInteraction */ } }
event: interaction-resolved          // → Responded(先到先得,其他连接据此置不可操作)
data: { "interactionId": "..." }
event: interaction-invalidated       // → Invalidated(cause 不暴露,对外行为相同 INV-11)
data: { "interactionId": "..." }

// 无归属错误 / My-Code-X 自身错误 → toast(绝不入信息列表)
event: toast
data: { "message": "..." }
```

**`message-updated` 粒度**: `append` 推流式文本增量(reasoning/流式回复,移动端省流量);`nativeStatus` 变化或结构改变走 `replace` 整条。具体由 agent cli + 信息类型决定(domain model:AppendDelta | FullReplace)。

**滚动行为**: `message-appended` / `message-updated` 是否触发自动滚动,由前端按「当前是否在底部」本地决定(BDD),后端不参与。

---

## Response DTOs

### Phase (判别联合)

`reason` 仅在失败态出现 —— make impossible states unrepresentable。`resumeCursor` 不暴露。

```jsonc
phase =
  | { "kind": "HistoryRecovering" }                 // → 加载中 banner
  | { "kind": "RecoveryFailed",  "reason": string } // → 加载失败 + 重试按钮(无内容可读)
  | { "kind": "Synced" }
  | { "kind": "Syncing" }                            // → 同步中 banner(旧内容仍可读)
  | { "kind": "SyncFailed",      "reason": string } // → 同步失败 banner + 重试(旧内容仍可读)
  | { "kind": "ProtocolBroken",  "reason": string } // 终态,无重试同步出边(agent cli 恢复属另一 feature)
```

前端据此映射 BDD 文案:`Synced` 且 messages 空 → 显示「无可展示内容」;`∅`(未订阅) → 「开始工作」首屏。

### Message

```jsonc
Message {
  "stableKey": string,            // agent cli 固定键;identity(INV-2)
  "sequence": int,                // agent 给定发生顺序(INV-3)
  "classification": "NormalConversation" | "WorkProcess" | "Failure" | "Unrecognized",
  "nativeType": string | null,    // Unrecognized 可缺失 → 前端摘要显示 "Unknown type"
  "nativeStatus": string | null,  // 缺失=该 type 本无 status;纯文案,非产品状态依据
  "belongsToTurn": string | null, // 缺失=agent 未归入任何 turn
  "content": { "fields": [ { "name": string, "value": string } ] }
}
```

- `content.fields` 是结构化字段(字段名+字段内容)的有序列表,对应 Generic Field Rendering 的兜底原料。
- 四类 `classification` 是渲染样式开关,非可见文案:`NormalConversation` 走 markdown(代码块/表格/链接处理由前端);`WorkProcess`/`Unrecognized` 默认折叠摘要(摘要=nativeType + nativeStatus),展开走 Generic Field Rendering;`Failure` 醒目展示,空 content 时前端显示「Unknown error」。
- markdown 渲染、代码块复制、链接两段式展开、裸 URL、CJK/emoji 保真等均为**前端渲染职责**,不进 contract(content 只保真透传原文字段)。

### Turn

```jsonc
Turn {
  "turnId": string,                              // agent 提供;identity
  "state": "InProgress" | "Interrupting" | "Ended",
  "startTime": string | null,                    // ISO8601;best-effort,缺失则工具栏留空
  "endTime":   string | null                     // ISO8601;best-effort
}
```

TurnToolbar 的展示位置(首条用户信息下方 / 末条 agent 回复下方)、时间挑选、复制按钮均由前端按 BDD 规则派生;后端只提供 turn 边界与时间原料。

### PendingInteraction

`state` 只暴露 `kind` —— 不暴露 `by_connection` / `response` / `cause`(终态对外行为相同,INV-11)。

```jsonc
PendingInteraction {
  "interactionId": string,
  "conversationId": string,                       // 软关联所属对话
  "state": { "kind": "Pending" | "Responded" | "Invalidated" },
  "content": {
    "prompt": string,
    "options": [ { "id": string, "label": string, "requiresSupplement": bool } ]
  }
}
```

`label` 沿用 agent cli 提供的选项文案;`requiresSupplement` 驱动前端是否要求 SupplementText。

---

## Request DTOs

保真透传:`text` / `supplement` 原文不做任何规范化,UTF-8/CJK/emoji 不损。

```jsonc
POST /conversations/{id}/history-recovery   {}                                  // 无 body
POST /conversations/{id}/sync               {}                                  // 无 body
POST /conversations/{id}/inputs             { "text": string }
POST /conversations/{id}/instructions       { "text": string, "turnId": string? }
POST /conversations/{id}/interrupt          { "turnId": string? }
POST /interactions/{interactionId}/response { "connectionId": string,
                                              "optionId": string,
                                              "supplement": string? }
```

仅 `/response` 带 `connectionId`(ResponseLock 先到先得需连接身份);其余命令域逻辑不需要连接身份(YAGNI)。`turnId` 可选:agent 未提供时由后端按当前进行中 turn 中继。

---

## Error Contract

统一响应体:

```jsonc
{ "code": string, "message": string }   // message 沿用域错误 business meaning,可直接 toast
```

### 前端可见(域错误 → HTTP)

| 域错误 | HTTP | code | 前端处理 |
|---|---|---|---|
| ConversationProjectionNotFound | 404 | `conversation_not_found` | — |
| PendingInteractionNotFound | 404 | `interaction_not_found` | — |
| InvalidPhaseTransition | 409 | `invalid_phase_transition` | sync/load 重复触发时后端幂等 200 忽略,不抛 |
| InteractionAlreadyResolved | 409 | `interaction_already_resolved` | toast「已被处理」,置该 interaction 不可操作 |
| ResponseLockHeldByAnother | 409 | `response_lock_held` | toast「已被其他设备处理」,置不可操作 |
| MissingRequiredSupplement | 422 | `missing_required_supplement` | 提示需补充文字,interaction 恢复可响应 |
| InvalidResponseOption | 422 | `invalid_response_option` | 提示无效选项,恢复可响应 |
| Composer 中继技术失败 | 502 / 503 | `relay_failed` | toast,draft 保持不变,可重试 |

### 前端不可见(内部错误,只见结果)

`MessageOrderViolation`、`ResumeCursorGap`、`AgentCliProtocolViolation`、`RecoveredConversationStillRunning` 在 `AgentCliInboundPort` 内部抛出,前端**不直接收到错误码**,只通过 `phase-changed` 看到结果:

- MessageOrderViolation / ResumeCursorGap → 后端触发 ConversationResyncProcess → 前端看到 `Syncing` → `Synced`(可救,自愈)。
- AgentCliProtocolViolation / RecoveredConversationStillRunning → `ProtocolBroken` / `RecoveryFailed`(终态/失败态,前端显示对应 banner)。

这是 contract 的关键分离:**协议层/续接层错误不泄漏给前端**,前端只消费相位结果。

---

## Lifecycle / Reconnect / Idempotency

### 首次打开对话

1. 前端订阅 `/conversations/{id}/events`(纯读)+ 发 `POST /history-recovery`。两者无序,订阅只负责收流,recovery 命令负责确保已加载。
2. 后端按 Phase 裁决:无投影 → 触发 native recovery(经 AgentCliCommandPort,启动藏于 port 后)→ 推 `phase-changed: HistoryRecovering`;已活跃 → no-op。
3. 恢复完成 → 推 `snapshot`(phase=Synced);恢复失败 → `phase-changed: RecoveryFailed`,前端显示重试按钮 → 点击**重发同一个** `POST /history-recovery`(非特殊端点)。

多连接:后到的连接同样「订阅 + 发 /history-recovery」,后端见对话已活跃则 no-op,该连接的订阅流直接拿 snapshot。前端两端行为完全一致。


### 重连(SSE 断线)

SSE 标准重连 → 新订阅 → 后端推新 `snapshot`(已是权威状态)。后端 `ConversationResyncProcess` 内部完成对齐 + 续接 live update,**前端无感知 cursor**。BDD「输出期间重连后续接 live update」即由此承载。

### Sync(连接仍活但疑似过期)

切后台/弱网恢复后,前端发 `POST /sync` → 后端 `phase-changed: Syncing`(旧内容仍可读)→ 对齐后推新 `snapshot` 基线帧 + `phase-changed: Synced`。失败 → `SyncFailed`,前端 banner 重试 → 重发 `POST /sync`。

### 幂等 / 重复

- 无服务端幂等键。
- LoadHistory / Sync 是声明式幂等命令:后端按 Phase 裁决,已在目标态则 no-op;重复发送安全无副作用。
- Composer 命令重复:前端「在途禁重复」本地锁兜底(domain model 定为前端本地态)。
- interaction 响应重复:`ResponseLock` 先到先得裁决,后到 409。

---

## Authorization

本 feature **不含鉴权与传输安全**(BDD Out of Scope)。`connectionId` 仅用于 ResponseLock 裁决,非身份认证。鉴权由独立横切关注承载。

---

## Application Service → Handler 映射

| Handler / 入口 | Application Service |
|---|---|
| `POST /history-recovery` | LoadConversationHistoryService |
| `POST /sync` | SyncConversationService |
| `POST /inputs` | Composer 中继(SubmitNormalInput) |
| `POST /instructions` | Composer 中继(AppendInstruction) |
| `POST /interrupt` | Composer 中继(RequestWorkInterrupt) |
| `POST /response` | RespondToPendingInteractionService |
| SSE 推送(非 handler) | 由 Domain Events 经 projection 订阅 fan-out 到连接 |
| (内部,非前端 API) | ApplyRecoveredHistory / ApplyAuthoritativeState / ApplyLiveUpdate / InvalidatePendingInteractionsForConversation |

SSE 流不对应单个 application service:它是 Domain Events(ConversationAligned、MessageRecorded、PendingInteractionRaised 等)的读侧投影广播。







