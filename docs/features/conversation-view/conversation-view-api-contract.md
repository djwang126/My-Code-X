# API Contract — Conversation View

## Consumer

my-code-x 前端（移动 web），唯一消费者。

## Endpoints

| Method | Path | Style | 用途 |
|---|---|---|---|
| GET | `/agent/capabilities` | REST | 全局 agent 能力 |
| GET | `/conversations/{conversationId}/snapshot` | REST | 进入对话快照 |
| GET | `/conversations/{conversationId}/events` | SSE | 实时事件流 |
| POST | `/conversations/{conversationId}/inputs` | Command | 发送首条用户输入 |
| POST | `/conversations/{conversationId}/supplementary-instructions` | Command | 发送补充指令 |
| POST | `/conversations/{conversationId}/interrupt` | Command | 中断当前工作 |
| POST | `/pending-interactions/{interactionId}/response` | Command | 响应待响应交互 |

---

## Request

### GET /agent/capabilities

无参数。

### GET /conversations/{conversationId}/snapshot

Path: `conversationId` string, required.

### GET /conversations/{conversationId}/events

Path: `conversationId` string, required.
Header: `Last-Event-ID` string, optional (SSE 重连位置).

### POST /conversations/{conversationId}/inputs

Path: `conversationId` string, required.

```json
{ "markdownSource": "string, required, non-empty" }
```

### POST /conversations/{conversationId}/supplementary-instructions

Path: `conversationId` string, required.

```json
{ "markdownSource": "string, required, non-empty" }
```

### POST /conversations/{conversationId}/interrupt

Path: `conversationId` string, required. 无 body。

### POST /pending-interactions/{interactionId}/response

Path: `interactionId` string, required.

```json
{
  "selectedOption": "string, required",
  "textSupplement": "string, optional"
}
```

---

## Response

### GET /agent/capabilities → 200

```json
{
  "supportsSupplementaryInstruction": true,
  "supportsInterrupt": true
}
```

### GET /conversations/{conversationId}/snapshot → 200

```json
{
  "conversation": {
    "id": "string",
    "contentRestore": ContentRestoreStatus
  },
  "transcriptEntries": [TranscriptEntry],
  "turns": [Turn],
  "pendingInteractions": [Interaction],
  "cursor": "string (opaque, 用作 SSE Last-Event-ID)"
}
```

### POST /inputs & /supplementary-instructions → 200

两种 outcome 变体：

```json
{ "outcome": "Accepted" }
```

```json
{ "outcome": "SendFailed", "error": { "message": "string" } }
```

SendFailed 是业务数据，不走 HTTP 4xx。

### POST /interrupt → 204 No Content

### POST /pending-interactions/{iid}/response → 204 No Content

---

## Shared Types

### ContentRestoreStatus

- `{ "kind": "Restoring" }`
- `{ "kind": "Restored" }`
- `{ "kind": "RestoredEmpty" }`
- `{ "kind": "RestoreFailed" }`

### TranscriptEntry

```json
{
  "id": "string",
  "sequence": "number",
  "body": EntryBody
}
```

### EntryBody (discriminated union, field: `kind`)

| kind | fields |
|---|---|
| `UserInput` | `markdown: string` |
| `AgentReply` | `content: string`, `stream: "InProgress" \| "Completed"` |
| `WorkProgress` | `nativeType?: string`, `nativeStatus?: string`, `detail: object` |
| `Failure` | `message: string`, `detail: object` |
| `Unrecognized` | `nativeStatus?: string`, `detail: object` |

### Turn

```json
{
  "id": "string",
  "status": TurnStatus
}
```

**TurnStatus**:
- `{ "kind": "InProgress", "firstUserInputRef": "entryId", "userInputTime": "ISO8601" }`
- `{ "kind": "Completed", "firstUserInputRef": "entryId", "userInputTime": "ISO8601", "lastAgentReplyRef": "entryId", "lastReplyCompletedTime": "ISO8601" }`

### Interaction

```json
{
  "id": "string",
  "sequence": "number",
  "content": { "prompt": "string", "options": [InteractionOption] },
  "status": InteractionStatus
}
```

**InteractionOption**: `{ "id": "string", "label": "string", "requiresTextSupplement": bool }`

**InteractionStatus**:
- `{ "kind": "Pending" }`
- `{ "kind": "Resolved", "acceptedResponse": { "selectedOption": "string", "textSupplement"?: "string" } }`
- `{ "kind": "Expired" }`
- `{ "kind": "Cancelled" }`

---

## SSE Events

Stream: `GET /conversations/{conversationId}/events`

每条 event 格式: `event: <type>\nid: <cursor>\ndata: <JSON>\n\n`

| Event Type | Payload | 说明 |
|---|---|---|
| `transcript.entry-added` | `{ "entry": TranscriptEntry }` | 新 entry |
| `transcript.reply-delta` | `{ "entryId": "string", "delta": "string" }` | AgentReply 流式增量 |
| `transcript.entry-updated` | `{ "entryId": "string", "body": EntryBody }` | entry 状态变更 |
| `turn.started` | `{ "turn": Turn }` | Turn 开始 |
| `turn.completed` | `{ "turnId": "string", "lastAgentReplyRef": "string", "lastReplyCompletedTime": "ISO8601" }` | Turn 结束 |
| `interaction.raised` | `{ "interaction": Interaction }` | 新 pending interaction |
| `interaction.status-changed` | `{ "interactionId": "string", "status": InteractionStatus }` | interaction 终态 |
| `content-restore.status-changed` | `{ "status": ContentRestoreStatus }` | 恢复状态变更 |
| `agent-error` | `{ "message": "string" }` | 无归属 agent 错误，page banner |
| `resync-required` | `{}` | cursor 失效，前端必须重新 snapshot + 订阅 |

---

## Error Contract

### 统一结构

```json
{ "error": { "code": "string", "message": "string" } }
```

### Error Codes

| HTTP | code | 触发场景 |
|---|---|---|
| 404 | `conversation-not-found` | conversationId 无效 |
| 404 | `interaction-not-found` | interactionId 无效 |
| 409 | `conversation-busy` | C1: turn 进行中 |
| 409 | `conversation-idle` | C2/C3: turn 未进行 |
| 409 | `conversation-restoring` | C1: 内容恢复中 |
| 409 | `interaction-already-resolved` | C4: 已被响应 |
| 409 | `interaction-no-longer-pending` | C4: 已失效 |
| 422 | `empty-input` | C1/C2: markdownSource 为空 |
| 400 | `malformed-request` | JSON 解析失败 |
| 422 | `validation-failed` | 必填字段缺失 |
| 500 | `internal-error` | 服务内部异常 |

---

## Lifecycle Rules

1. 前端进入对话：先 GET snapshot → 用返回的 `cursor` 作 `Last-Event-ID` 订阅 SSE。
2. snapshot + SSE 无缝衔接，cursor 严格单调递增。
3. SSE 无 `Last-Event-ID`：只推连接建立后的新事件，不补发历史。
4. SSE `Last-Event-ID` cursor 过期：后端推送 `resync-required` 后关闭连接。
5. SSE 重连后不补发 reply delta：推一条 `transcript.entry-updated` 含完整 body。
6. busy/idle 由前端从 turns 列表派生（是否存在 `kind: "InProgress"` turn），不单独暴露。
7. 前端不得 block 等待 C1/C2 对应的 `transcript.entry-added`；该 event 异步到达。

## Idempotency & Retry

- C1/C2: 非幂等，不自动重试。
- C3: 天然幂等（重复中断走准入判断）。
- C4: 领域级 first-write-wins（重复返回 409）。
- 无 Idempotency-Key header。
- SSE 重连依赖浏览器 EventSource + Last-Event-ID。
