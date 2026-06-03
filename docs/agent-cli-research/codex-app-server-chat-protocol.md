# Codex App Server 聊天协议详解

本文档说明原生 Codex `codex app-server` 中与聊天相关的协议、线程生命周期、回合生命周期、事件流、历史恢复和审批逻辑。文档只覆盖原生 Codex app-server，不包含任何上层产品或 UI 适配逻辑。

本文基于本机相邻仓库 `../codex` 的 Rust 实现分析，主要事实来源：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/jsonrpc_lite.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v1.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/thread_history.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`
- `../codex/codex-rs/app-server/src/bespoke_event_handling.rs`
- `../codex/codex-rs/app-server/src/thread_state.rs`
- `../codex/codex-rs/app-server/src/thread_status.rs`
- `../codex/codex-rs/thread-store/src/types.rs`

## 1. 范围

本文回答两个问题：

1. 调用 `codex app-server` 时，客户端可以发送哪些聊天相关输入。
2. app-server 会返回哪些同步响应、异步通知、服务端反向请求，以及这些输出如何组合成一个完整聊天流。

本文刻意不覆盖这些内容：

- 上层 Web UI 如何保存状态。
- 上层 Web UI 如何渲染事件。
- 非聊天主线 API 的完整说明，例如 config、plugin、marketplace、filesystem、standalone `command/exec` 的全部细节。
- 原生 Codex 内部模型请求、prompt 拼装和后端 provider 实现。

本文中的“客户端”指连接到 `codex app-server` 的调用方。“服务端”指原生 Codex app-server 进程。

## 2. 传输层与 JSON-RPC 形状

### 2.1 stdio 是逐行 JSON

`codex app-server` 的 stdio transport 从 stdin 逐行读取 JSON，每行解析为一条消息；向 stdout 写出时，每条 JSON 后追加换行。

因此客户端必须：

- 每次发送一个完整 JSON 对象。
- 每个 JSON 对象后追加 `\n`。
- 持续读取 stdout，每行都是一个完整 JSON 对象。
- 不要依赖 `jsonrpc: "2.0"` 字段；原生协议定义里明确“不做真正 JSON-RPC 2.0”，既不发送也不期待这个字段。

### 2.2 基础消息类型

原生协议支持四种 JSON 对象。

客户端请求，带 `id`，期望服务端响应：

```json
{
  "id": 1,
  "method": "thread/start",
  "params": {}
}
```

客户端通知，不带 `id`，不期望响应：

```json
{
  "method": "initialized"
}
```

成功响应，带原请求 `id`：

```json
{
  "id": 1,
  "result": {}
}
```

错误响应，带原请求 `id`：

```json
{
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params"
  }
}
```

服务端通知，不带 `id`，例如 turn 事件：

```json
{
  "method": "turn/started",
  "params": {
    "threadId": "00000000-0000-0000-0000-000000000000",
    "turn": {
      "id": "turn_1",
      "items": [],
      "status": "inProgress",
      "error": null,
      "startedAt": 1760000000,
      "completedAt": null,
      "durationMs": null
    }
  }
}
```

服务端也可以向客户端发起反向 request，例如请求用户审批命令。它同样带 `id`，客户端必须用同一 `id` 返回 result：

```json
{
  "id": "approval_1",
  "method": "item/commandExecution/requestApproval",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "call_1",
    "approvalId": null,
    "reason": "Need to run tests",
    "networkApprovalContext": null,
    "command": "npm test",
    "cwd": "/repo",
    "commandActions": [],
    "proposedExecpolicyAmendment": null,
    "proposedNetworkPolicyAmendments": null,
    "availableDecisions": null
  }
}
```

客户端响应：

```json
{
  "id": "approval_1",
  "result": {
    "decision": "accept"
  }
}
```

## 3. 初始化握手

每个连接必须先初始化。标准顺序是：

```text
client -> initialize request
server -> initialize response
client -> initialized notification
client -> 其他 request
```

在初始化完成前发送其他请求，会被拒绝。重复发送 `initialize` 也会被拒绝。

### 3.1 `initialize`

请求：

```json
{
  "id": 0,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "my_client",
      "title": "My Client",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true,
      "optOutNotificationMethods": []
    }
  }
}
```

`InitializeParams` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `clientInfo.name` | string | 是 | 客户端标识。原生 README 特别说明该字段会用于 OpenAI Compliance Logs Platform 的客户端识别。 |
| `clientInfo.title` | string 或 null | 否 | 人类可读客户端名称。 |
| `clientInfo.version` | string | 是 | 客户端版本。 |
| `capabilities.experimentalApi` | boolean | 否，默认 false | 是否启用实验性 API 方法和字段。很多 thread/turn 字段带 experimental gate。 |
| `capabilities.optOutNotificationMethods` | string[] 或 null | 否 | 精确匹配的通知方法名黑名单。只抑制 notification，不抑制 request/response/error。 |

响应：

```json
{
  "id": 0,
  "result": {
    "userAgent": "codex_cli_rs/...",
    "codexHome": "/Users/me/.codex",
    "platformFamily": "unix",
    "platformOs": "macos"
  }
}
```

`InitializeResponse` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userAgent` | string | app-server 对上游服务使用的 user agent。 |
| `codexHome` | absolute path | 运行中 Codex 的 `$CODEX_HOME`。 |
| `platformFamily` | string | 平台族，例如 `unix`、`windows`。 |
| `platformOs` | string | OS，例如 `macos`、`linux`、`windows`。 |

### 3.2 `initialized`

`initialized` 是客户端 notification，无 params：

```json
{
  "method": "initialized"
}
```

这一步之后才进入正常 API 调用阶段。

## 4. 核心概念

### 4.1 Thread

Thread 是一次 Codex 对话。它可以持久化为 rollout/session 记录，也可以是 ephemeral in-memory thread。

一个 thread 包含多个 turn。`thread/start` 创建新 thread，`thread/resume` 重新打开已有 thread，`thread/fork` 从已有 thread 复制历史并创建新 thread。

### 4.2 Turn

Turn 是一次用户输入驱动的模型执行。通常开始于 `turn/start`，结束于 `turn/completed`。一个 turn 内会流式产生多个 item。

同一个 thread 正常情况下只有一个 active turn。`turn/steer` 不是新 turn，而是在当前 active regular turn 中追加用户输入。

### 4.3 ThreadItem

ThreadItem 是 turn 内的可渲染单元，也是恢复历史时能重建出的主要内容。常见类型包括：

- `userMessage`
- `agentMessage`
- `reasoning`
- `plan`
- `commandExecution`
- `fileChange`
- `mcpToolCall`
- `dynamicToolCall`
- `collabAgentToolCall`
- `webSearch`
- `imageView`
- `imageGeneration`
- `enteredReviewMode`
- `exitedReviewMode`
- `contextCompaction`

`item/started` 和 `item/completed` 中携带的是 `ThreadItem`。部分 item 还会有 delta 通知。

## 5. 生命周期总览

最小聊天生命周期：

```text
initialize
initialized
thread/start
thread/started notification
turn/start
turn/start response
turn/started notification
item/started notification
item/agentMessage/delta notification
item/completed notification
thread/tokenUsage/updated notification
turn/completed notification
```

注意：

- `turn/start` 的 response 只表示服务端接受请求并创建 turn，不表示模型已经开始输出。
- 模型开始执行时才会有 `turn/started`。
- 文本流式输出来自 `item/agentMessage/delta`。
- 最终完整 assistant 文本会在 `item/completed` 的 `agentMessage.text` 中出现。
- `turn/completed` 的 `turn.items` 当前通常仍为空；原生 README 明确建议依赖 `item/*` 通知维护 canonical item list。

## 6. Thread 数据结构

`Thread` wire shape：

```json
{
  "id": "thr_1",
  "forkedFromId": null,
  "preview": "Run tests",
  "ephemeral": false,
  "modelProvider": "openai",
  "createdAt": 1760000000,
  "updatedAt": 1760000123,
  "status": {
    "type": "idle"
  },
  "path": "/Users/me/.codex/sessions/2026/05/06/rollout-....jsonl",
  "cwd": "/repo",
  "cliVersion": "0.0.0",
  "source": "appServer",
  "agentNickname": null,
  "agentRole": null,
  "gitInfo": null,
  "name": null,
  "turns": []
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | thread id。 |
| `forkedFromId` | string 或 null | 如果由 `thread/fork` 创建，指向源 thread。 |
| `preview` | string | 通常是第一条用户消息；列表 UI 可用。 |
| `ephemeral` | boolean | 是否为内存临时 thread。为 true 时通常没有磁盘 path。 |
| `modelProvider` | string | provider id，例如 `openai`。 |
| `createdAt` | number | Unix 秒时间戳。 |
| `updatedAt` | number | Unix 秒时间戳。 |
| `status` | `ThreadStatus` | 当前运行状态。列表/读取时未加载 thread 默认为 `notLoaded`。 |
| `path` | string 或 null | rollout 文件路径。不稳定字段；ephemeral thread 为 null。 |
| `cwd` | absolute path | thread 捕获的工作目录。 |
| `cliVersion` | string | 创建该 thread 的 CLI 版本。 |
| `source` | `SessionSource` | 来源，例如 CLI、VSCode、exec、app-server、sub-agent。 |
| `agentNickname` | string 或 null | AgentControl spawn 出来的子 agent 昵称。 |
| `agentRole` | string 或 null | AgentControl spawn 出来的子 agent 角色。 |
| `gitInfo` | object 或 null | 创建时捕获的 git metadata。 |
| `name` | string 或 null | 用户可设置的 thread 名称。 |
| `turns` | `Turn[]` | 只在 `thread/resume`、`thread/fork`、`thread/rollback`、以及 `thread/read(includeTurns: true)` 中可能填充；其他响应/通知通常为空数组。 |

### 6.1 ThreadStatus

`ThreadStatus` 是 tagged/camelCase enum：

```json
{
  "type": "notLoaded"
}
```

```json
{
  "type": "idle"
}
```

```json
{
  "type": "systemError"
}
```

```json
{
  "type": "active",
  "activeFlags": ["waitingOnApproval", "waitingOnUserInput"]
}
```

语义：

| 状态 | 说明 |
| --- | --- |
| `{ "type": "notLoaded" }` | thread 没在 app-server 内存中运行。 |
| `{ "type": "idle" }` | thread 已加载，没有 active turn，没有等待中的审批/用户输入。 |
| `{ "type": "active", "activeFlags": [...] }` | thread 正在运行 turn，或有等待中的审批/用户输入。 |
| `{ "type": "systemError" }` | thread runtime 遇到系统错误。 |

`active.activeFlags`：

| flag | 说明 |
| --- | --- |
| `waitingOnApproval` | 存在服务端反向审批请求未完成。 |
| `waitingOnUserInput` | 存在 tool/requestUserInput 等用户输入请求未完成。 |

运行时实现里，状态由 loaded、running、pending permission requests、pending user input requests、system error 等事实推导，而不是单纯持久字段。

## 7. Turn 数据结构

`Turn` wire shape：

```json
{
  "id": "turn_1",
  "items": [],
  "status": "inProgress",
  "error": null,
  "startedAt": 1760000000,
  "completedAt": null,
  "durationMs": null
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | turn id。 |
| `items` | `ThreadItem[]` | 恢复/读取历史时可能填充；实时事件通常通过 `item/*` 维护。 |
| `status` | `completed` / `interrupted` / `failed` / `inProgress` | turn 状态。 |
| `error` | `TurnError` 或 null | 只有 `failed` 时通常有值。 |
| `startedAt` | number 或 null | Unix 秒。 |
| `completedAt` | number 或 null | Unix 秒。 |
| `durationMs` | number 或 null | turn 总耗时。 |

`TurnError`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message` | string | 用户可读错误信息。 |
| `codexErrorInfo` | object/string 或 null | 结构化错误分类。 |
| `additionalDetails` | string 或 null | 附加细节。 |

## 8. UserInput 数据结构

`turn/start` 和 `turn/steer` 的 `input` 是 tagged union。

文本：

```json
{
  "type": "text",
  "text": "Run tests",
  "textElements": []
}
```

远程图片：

```json
{
  "type": "image",
  "url": "https://example.com/screenshot.png"
}
```

本地图片：

```json
{
  "type": "localImage",
  "path": "/tmp/screenshot.png"
}
```

显式 skill：

```json
{
  "type": "skill",
  "name": "skill-creator",
  "path": "/Users/me/.codex/skills/skill-creator/SKILL.md"
}
```

app/plugin mention：

```json
{
  "type": "mention",
  "name": "Sample Plugin",
  "path": "plugin://sample@test"
}
```

`textElements` 用于 UI 定义的 text span。每个元素：

```json
{
  "byteRange": {
    "start": 0,
    "end": 5
  },
  "placeholder": "optional placeholder"
}
```

## 9. 客户端请求总表

本节列出聊天主线相关 request。所有 request 都是：

```json
{
  "id": 123,
  "method": "method/name",
  "params": {}
}
```

### 9.1 Thread lifecycle API

| method | 用途 | response | 主要通知 |
| --- | --- | --- | --- |
| `thread/start` | 新建 thread 并加载到内存。 | `ThreadStartResponse` | `thread/started`、可能有 `thread/status/changed` |
| `thread/resume` | 恢复已有 thread，使后续 turn 追加到它。 | `ThreadResumeResponse` | 可能 replay/发送状态与 token usage，已运行 thread 会原子订阅新事件 |
| `thread/fork` | 从已有 thread 复制历史创建新 thread。 | `ThreadForkResponse` | `thread/started` |
| `thread/list` | 分页列出持久化 thread。 | `ThreadListResponse` | 无固定事件 |
| `thread/loaded/list` | 列出当前内存中 loaded thread id。 | `ThreadLoadedListResponse` | 无固定事件 |
| `thread/read` | 只读读取已有 thread，不恢复为可继续对话。 | `ThreadReadResponse` | 无固定事件 |
| `thread/turns/list` | 分页读取某 thread 的 turn 历史。 | `ThreadTurnsListResponse` | 无固定事件 |
| `thread/archive` | 归档 thread。 | `{}` | `thread/archived` |
| `thread/unarchive` | 取消归档。 | `{ thread }` | `thread/unarchived` |
| `thread/unsubscribe` | 当前连接取消订阅 thread 事件。 | `{ status }` | 最后订阅者离开且空闲超时后可能 `thread/closed` |
| `thread/name/set` | 设置 thread 展示名。 | `{}` | `thread/name/updated` |
| `thread/metadata/update` | 更新持久化 metadata，目前主要是 gitInfo。 | `{ thread }` | 可能触发状态相关通知 |
| `thread/rollback` | 从内存上下文和持久历史中删除末尾 N 个 turn，并记录 rollback marker。 | `{ thread }` | 标准 thread/turn 相关事件，失败时可能 `error` |
| `thread/compact/start` | 请求对话历史压缩。 | `{}` | 标准 turn/item 事件，可能出现 `contextCompaction` |
| `thread/shellCommand` | 用户发起 `!` shell command。 | `{}` | 标准 turn/item 事件，含 `commandExecution` |
| `thread/inject_items` | 向 loaded thread 的模型可见历史追加 raw Responses API items，不启动用户 turn。 | `{}` | 无标准 turn 生命周期 |

### 9.2 Turn API

| method | 用途 | response | 主要通知 |
| --- | --- | --- | --- |
| `turn/start` | 向 thread 发送用户输入并开始 Codex 生成。 | `{ turn }` | `turn/started`、`item/*`、`thread/tokenUsage/updated`、`turn/completed` |
| `turn/steer` | 向当前 active regular turn 追加输入。 | `{ turnId }` | 不发 `turn/started`；后续继续走原 turn 的 item/delta/completed |
| `turn/interrupt` | 请求取消 active turn。 | `{}` | 最终 `turn/completed`，turn status 为 `interrupted` |

### 9.3 Review API

| method | 用途 | response | 主要通知 |
| --- | --- | --- | --- |
| `review/start` | 启动 Codex code review。 | `{ turn, reviewThreadId }` | 标准 turn/item 事件，含 `enteredReviewMode`、`exitedReviewMode` |

### 9.4 Realtime API

这些是实验性 API，需要 `experimentalApi: true`。

| method | 用途 | response | 主要通知 |
| --- | --- | --- | --- |
| `thread/realtime/start` | 启动 thread-scoped realtime session。 | `{}` | `thread/realtime/*` |
| `thread/realtime/appendAudio` | 追加输入音频 chunk。 | `{}` | `thread/realtime/*` |
| `thread/realtime/appendText` | 追加文本输入。 | `{}` | `thread/realtime/*` |
| `thread/realtime/stop` | 停止 realtime session。 | `{}` | `thread/realtime/closed` |
| `thread/realtime/listVoices` | 列出 realtime voices。 | `{ voices }` | 无固定事件 |

`thread/realtime/*` 通知是 ephemeral transport events，不是 `ThreadItem`，不会通过 `thread/read`、`thread/resume`、`thread/fork` 返回。

## 10. `thread/start`

用途：创建新的 Codex thread，打开持久化或 ephemeral runtime，订阅当前连接接收该 thread 的事件。

请求：

```json
{
  "id": 10,
  "method": "thread/start",
  "params": {
    "model": "gpt-5.1-codex",
    "modelProvider": "openai",
    "cwd": "/repo",
    "approvalPolicy": "never",
    "approvalsReviewer": "user",
    "sandbox": "workspace-write",
    "ephemeral": false
  }
}
```

主要 params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string 或 null | 指定模型；省略使用用户 config。 |
| `modelProvider` | string 或 null | 指定 provider；省略使用用户 config。 |
| `serviceTier` | `ServiceTier` 或 null | 服务层级。该字段使用 double-option 语义：省略表示不覆盖，显式 null 表示清除覆盖。 |
| `cwd` | string 或 null | thread 工作目录。 |
| `approvalPolicy` | `AskForApproval` 或 null | 审批策略。 |
| `approvalsReviewer` | `user` / `auto_review` / `guardian_subagent` | 审批请求交给谁处理。`guardian_subagent` 是兼容别名。 |
| `sandbox` | `read-only` / `workspace-write` / `danger-full-access` | legacy sandbox shorthand。 |
| `permissions` | object 或 null | 实验性权限 profile 选择。不能和 `sandbox` 同时发送。 |
| `config` | object 或 null | 额外 config override。 |
| `serviceName` | string 或 null | 服务名 override。 |
| `baseInstructions` | string 或 null | base instructions override。 |
| `developerInstructions` | string 或 null | developer instructions override。 |
| `personality` | enum 或 null | personality override。 |
| `ephemeral` | boolean 或 null | 为 true 时 thread 只在内存中，不 materialize 到磁盘，`thread.path` 为 null。 |
| `sessionStartSource` | `startup` / `clear` | session start hook 的来源。 |
| `environments` | array 或 null | 实验性 sticky execution environments。省略使用默认；空数组禁用；非空时第一个为当前环境。 |
| `dynamicTools` | array 或 null | 实验性 dynamic tool spec。 |
| `experimentalRawEvents` | boolean | 内部用途，开启 raw Responses API item event。 |
| `persistExtendedHistory` | boolean | 实验性，持久化更丰富 event surface，便于之后更完整恢复历史。不会回填旧历史。 |

响应：

```json
{
  "id": 10,
  "result": {
    "thread": {
      "id": "thr_1",
      "forkedFromId": null,
      "preview": "",
      "ephemeral": false,
      "modelProvider": "openai",
      "createdAt": 1760000000,
      "updatedAt": 1760000000,
      "status": {
        "type": "idle"
      },
      "path": "/Users/me/.codex/sessions/2026/05/06/rollout-....jsonl",
      "cwd": "/repo",
      "cliVersion": "0.0.0",
      "source": "appServer",
      "agentNickname": null,
      "agentRole": null,
      "gitInfo": null,
      "name": null,
      "turns": []
    },
    "model": "gpt-5.1-codex",
    "modelProvider": "openai",
    "serviceTier": null,
    "cwd": "/repo",
    "instructionSources": [],
    "approvalPolicy": "never",
    "approvalsReviewer": "user",
    "sandbox": {
      "type": "workspaceWrite",
      "writableRoots": ["/repo"],
      "networkAccess": true,
      "excludeTmpdirEnvVar": false,
      "excludeSlashTmp": false
    },
    "permissionProfile": null,
    "activePermissionProfile": null,
    "reasoningEffort": null
  }
}
```

响应字段：

| 字段 | 说明 |
| --- | --- |
| `thread` | 新建 thread。通常 `turns` 为空。 |
| `model` | 实际使用模型。 |
| `modelProvider` | 实际 provider。 |
| `serviceTier` | 实际 service tier。 |
| `cwd` | 解析后的绝对 cwd。 |
| `instructionSources` | 当前加载的 instruction source 文件。 |
| `approvalPolicy` | 实际审批策略。 |
| `approvalsReviewer` | 实际审批 reviewer。 |
| `sandbox` | legacy sandbox compatibility projection。 |
| `permissionProfile` | 实验性，完整 runtime permissions。 |
| `activePermissionProfile` | 实验性，产生 runtime permissions 的 profile identity/provenance。 |
| `reasoningEffort` | 实际 reasoning effort。 |

事件：

```json
{
  "method": "thread/started",
  "params": {
    "thread": {
      "id": "thr_1",
      "turns": []
    }
  }
}
```

`thread/start` 会自动让当前连接订阅该 thread 的 turn/item 事件。

## 11. `thread/resume`

用途：打开已有 thread，使后续 `turn/start` 追加到它。

请求：

```json
{
  "id": 11,
  "method": "thread/resume",
  "params": {
    "threadId": "thr_1",
    "excludeTurns": false
  }
}
```

主要 params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `threadId` | string | 首选恢复方式。 |
| `history` | `ResponseItem[]` 或 null | 不稳定，给 Codex Cloud 使用；指定时优先级最高。 |
| `path` | path 或 null | 不稳定，通过 rollout path 恢复；优先级高于 `threadId`。 |
| `model` / `modelProvider` / `serviceTier` / `cwd` | optional | 恢复时 config override。 |
| `approvalPolicy` / `approvalsReviewer` / `sandbox` / `permissions` | optional | 权限/审批 override。 |
| `config` | object 或 null | config override。 |
| `baseInstructions` / `developerInstructions` / `personality` | optional | 指令与 personality override。 |
| `excludeTurns` | boolean | 为 true 时只返回 thread metadata 和 live state，不填充 `thread.turns`。之后应使用 `thread/turns/list` 分页读取历史。 |
| `persistExtendedHistory` | boolean | 之后继续持久化更丰富历史。 |

优先级：

```text
history > path > threadId
```

响应与 `thread/start` 类似，但 `thread.turns` 可能包含重建出的历史 turn。

重要语义：

- `thread/resume` 会让 thread 进入可继续对话状态。
- 如果目标 thread 已经在内存中运行，app-server 会发送当前历史快照并原子订阅新事件，避免 resume response 与 live events 之间出现事件丢失窗口。
- 默认会返回重建后的 `thread.turns`。
- `excludeTurns: true` 可以避免大历史一次性返回，也会避免为了历史 token usage 重建 turns。
- 历史重建不是完全无损。默认持久化模式下不是所有 agent interactions 都会持久化。`persistExtendedHistory` 只影响之后，不会回填过去缺失的事件。

## 12. `thread/fork`

用途：从已有 thread 复制历史，创建一个新 thread id。常用于分支探索。

请求：

```json
{
  "id": 12,
  "method": "thread/fork",
  "params": {
    "threadId": "thr_1",
    "ephemeral": false,
    "excludeTurns": true
  }
}
```

主要 params 与 `thread/resume` 接近。特殊字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `threadId` | string | 源 thread。 |
| `path` | path 或 null | 不稳定，通过 rollout path 指定源。指定时忽略 `threadId`。 |
| `ephemeral` | boolean | fork 出来的 thread 是否只在内存中。 |
| `excludeTurns` | boolean | 为 true 时不在响应里填充 fork 后 thread 的 turns。 |

响应：

```json
{
  "id": 12,
  "result": {
    "thread": {
      "id": "thr_2",
      "forkedFromId": "thr_1",
      "turns": []
    },
    "model": "gpt-5.1-codex",
    "modelProvider": "openai",
    "serviceTier": null,
    "cwd": "/repo",
    "instructionSources": [],
    "approvalPolicy": "never",
    "approvalsReviewer": "user",
    "sandbox": {
      "type": "workspaceWrite",
      "writableRoots": ["/repo"],
      "networkAccess": true,
      "excludeTmpdirEnvVar": false,
      "excludeSlashTmp": false
    },
    "permissionProfile": null,
    "activePermissionProfile": null,
    "reasoningEffort": null
  }
}
```

语义：

- 返回的 `thread.forkedFromId` 指向源 thread。
- 如果源 thread 正在 turn 中，fork 不会继承一个未标记的 partial turn suffix；它会记录与 `turn/interrupt` 类似的 interruption marker。
- fork 后当前连接自动订阅新 thread 的事件。
- fork 会发 `thread/started`。

## 13. 读取、列表和分页

### 13.1 `thread/list`

用途：分页列出存储中的 thread。

请求：

```json
{
  "id": 20,
  "method": "thread/list",
  "params": {
    "cursor": null,
    "limit": 50,
    "sortKey": "updated_at",
    "sortDirection": "desc",
    "archived": false,
    "searchTerm": null
  }
}
```

Params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cursor` | string 或 null | 上一页返回的不透明 cursor。 |
| `limit` | number 或 null | 页大小。 |
| `sortKey` | `created_at` / `updated_at` 或 null | 排序字段，默认 created_at。 |
| `sortDirection` | `asc` / `desc` 或 null | 默认 desc。 |
| `modelProviders` | string[] 或 null | provider 过滤。存在但为空表示包括所有 provider。 |
| `sourceKinds` | array 或 null | 来源过滤。省略或空时默认 interactive sources。 |
| `archived` | boolean 或 null | true 只列归档；false/null 只列未归档。 |
| `cwd` | string / string[] / null | cwd 精确匹配过滤。 |
| `useStateDbOnly` | boolean | true 时只读 state DB，不扫描 JSONL 修复 metadata。 |
| `searchTerm` | string 或 null | thread title/preview 子串搜索。 |

Response：

```json
{
  "id": 20,
  "result": {
    "data": [],
    "nextCursor": null,
    "backwardsCursor": null
  }
}
```

返回的每个 `thread.status` 会包含 runtime status；未加载则为 `{ "type": "notLoaded" }`。

### 13.2 `thread/loaded/list`

用途：列出当前 app-server 进程中 loaded 的 thread id。

请求：

```json
{
  "id": 21,
  "method": "thread/loaded/list",
  "params": {
    "cursor": null,
    "limit": null
  }
}
```

Response：

```json
{
  "id": 21,
  "result": {
    "data": ["thr_1"],
    "nextCursor": null
  }
}
```

### 13.3 `thread/read`

用途：只读读取 thread，不恢复它，不让它变成可继续对话。

请求：

```json
{
  "id": 22,
  "method": "thread/read",
  "params": {
    "threadId": "thr_1",
    "includeTurns": true
  }
}
```

Params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `threadId` | string | 要读取的 thread。 |
| `includeTurns` | boolean | true 时从 rollout history 重建 turn/items。 |

Response：

```json
{
  "id": 22,
  "result": {
    "thread": {
      "id": "thr_1",
      "turns": []
    }
  }
}
```

对比：

| 方法 | 是否让 thread 可继续对话 | 是否可返回 turns |
| --- | --- | --- |
| `thread/read` | 否 | `includeTurns: true` 时可返回 |
| `thread/resume` | 是 | 默认返回，可 `excludeTurns` |

### 13.4 `thread/turns/list`

用途：分页读取某个 thread 的 turn 历史，不 resume thread。

请求：

```json
{
  "id": 23,
  "method": "thread/turns/list",
  "params": {
    "threadId": "thr_1",
    "cursor": null,
    "limit": 20,
    "sortDirection": "desc"
  }
}
```

Response：

```json
{
  "id": 23,
  "result": {
    "data": [],
    "nextCursor": null,
    "backwardsCursor": null
  }
}
```

语义：

- `data` 是 `Turn[]`。
- `nextCursor` 为 null 表示没有更多。
- `backwardsCursor` 用于反向翻页，原生注释说明可以用相反 `sortDirection` 搭配该 cursor，包括 anchor turn 以避免漏掉更新。

## 14. 其他 Thread 操作

### 14.1 `thread/name/set`

请求：

```json
{
  "id": 30,
  "method": "thread/name/set",
  "params": {
    "threadId": "thr_1",
    "name": "Investigate failing tests"
  }
}
```

响应：

```json
{
  "id": 30,
  "result": {}
}
```

通知：

```json
{
  "method": "thread/name/updated",
  "params": {
    "threadId": "thr_1",
    "threadName": "Investigate failing tests"
  }
}
```

thread 名称不要求唯一；按名称查找时原生逻辑取最近更新的 thread。

### 14.2 `thread/archive`

请求：

```json
{
  "id": 31,
  "method": "thread/archive",
  "params": {
    "threadId": "thr_1"
  }
}
```

响应：

```json
{
  "id": 31,
  "result": {}
}
```

通知：

```json
{
  "method": "thread/archived",
  "params": {
    "threadId": "thr_1"
  }
}
```

归档时会尝试同时移动 spawned descendant thread 的 rollout 文件，并对每个归档成功的 thread 发通知。

### 14.3 `thread/unarchive`

请求：

```json
{
  "id": 32,
  "method": "thread/unarchive",
  "params": {
    "threadId": "thr_1"
  }
}
```

响应：

```json
{
  "id": 32,
  "result": {
    "thread": {
      "id": "thr_1",
      "turns": []
    }
  }
}
```

通知：

```json
{
  "method": "thread/unarchived",
  "params": {
    "threadId": "thr_1"
  }
}
```

### 14.4 `thread/unsubscribe`

请求：

```json
{
  "id": 33,
  "method": "thread/unsubscribe",
  "params": {
    "threadId": "thr_1"
  }
}
```

响应：

```json
{
  "id": 33,
  "result": {
    "status": "unsubscribed"
  }
}
```

`status`：

| 值 | 说明 |
| --- | --- |
| `notLoaded` | thread 不在内存中。 |
| `notSubscribed` | 当前连接本来没有订阅。 |
| `unsubscribed` | 成功取消订阅。 |

如果这是最后一个 subscriber，原生 README 说明服务端会保持 thread loaded；当 30 分钟没有 subscriber 且没有 thread activity 后才 unload，并发 `thread/closed`。

### 14.5 `thread/metadata/update`

请求：

```json
{
  "id": 34,
  "method": "thread/metadata/update",
  "params": {
    "threadId": "thr_1",
    "gitInfo": {
      "sha": "abc123",
      "branch": "main",
      "originUrl": null
    }
  }
}
```

`gitInfo` 字段是 patch 语义：

- 省略某字段：不修改。
- 设置为 `null`：清除。
- 设置为 string：替换。

响应：

```json
{
  "id": 34,
  "result": {
    "thread": {
      "id": "thr_1",
      "gitInfo": {
        "sha": "abc123",
        "branch": "main",
        "originUrl": null
      },
      "turns": []
    }
  }
}
```

### 14.6 `thread/rollback`

请求：

```json
{
  "id": 35,
  "method": "thread/rollback",
  "params": {
    "threadId": "thr_1",
    "numTurns": 1
  }
}
```

语义：

- `numTurns` 必须大于等于 1。
- 只修改 Codex 内存上下文和持久 rollout 中的历史标记。
- 不会回滚 agent 已经在文件系统中做出的本地文件修改。
- 客户端如果需要撤销文件改动，必须另外处理。

响应：

```json
{
  "id": 35,
  "result": {
    "thread": {
      "id": "thr_1",
      "turns": []
    }
  }
}
```

`thread.turns` 会填充 rollback 后的历史。原生注释提醒，这里的 `ThreadItem` 可能是 lossy 的，因为并非所有 agent interaction 都会持久化。

### 14.7 `thread/compact/start`

请求：

```json
{
  "id": 36,
  "method": "thread/compact/start",
  "params": {
    "threadId": "thr_1"
  }
}
```

响应立即返回：

```json
{
  "id": 36,
  "result": {}
}
```

实际 compaction 进度通过标准 turn/item 事件流表现。可能出现：

```json
{
  "method": "item/completed",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_2",
    "item": {
      "type": "contextCompaction",
      "id": "item_1"
    }
  }
}
```

旧通知 `thread/compacted` 已 deprecated，应优先使用 `contextCompaction` item。

### 14.8 `thread/shellCommand`

用途：执行用户发起的 `!` shell command。

请求：

```json
{
  "id": 37,
  "method": "thread/shellCommand",
  "params": {
    "threadId": "thr_1",
    "command": "git status --short"
  }
}
```

响应：

```json
{
  "id": 37,
  "result": {}
}
```

语义：

- `command` 是 shell command string，不是 argv。
- 会保留 pipes、redirects、quoting 等 shell 语法。
- 原生 schema 注释明确：该命令以 unsandboxed full access 运行，不继承 thread sandbox policy。
- 进度通过标准 turn/item 事件流发送，通常包括 `commandExecution` item 和 `item/commandExecution/outputDelta`。

### 14.9 `thread/inject_items`

用途：向 loaded thread 的模型可见历史追加 raw Responses API items，不启动 user turn。

请求：

```json
{
  "id": 38,
  "method": "thread/inject_items",
  "params": {
    "threadId": "thr_1",
    "items": [
      {
        "type": "message",
        "role": "assistant",
        "content": [
          {
            "type": "output_text",
            "text": "Previously computed context."
          }
        ]
      }
    ]
  }
}
```

响应：

```json
{
  "id": 38,
  "result": {}
}
```

用途边界：

- 这是低层 escape hatch。
- 输入是 raw Responses API item JSON，不是 `ThreadItem`。
- 不会触发一个新的用户 turn。

## 15. `turn/start`

用途：向 thread 添加用户输入并开始 Codex generation。

请求：

```json
{
  "id": 40,
  "method": "turn/start",
  "params": {
    "threadId": "thr_1",
    "input": [
      {
        "type": "text",
        "text": "Run tests and fix failures",
        "textElements": []
      }
    ],
    "cwd": "/repo",
    "approvalPolicy": "untrusted",
    "sandboxPolicy": {
      "type": "workspaceWrite",
      "writableRoots": ["/repo"],
      "networkAccess": true
    },
    "model": "gpt-5.1-codex",
    "effort": "medium",
    "summary": "concise",
    "personality": "friendly"
  }
}
```

Params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `threadId` | string | 目标 thread。 |
| `input` | `UserInput[]` | 用户输入。可包含文本、图片、skill、mention。 |
| `responsesapiClientMetadata` | object 或 null | 实验性，turn-scoped Responses API client metadata。 |
| `environments` | array 或 null | 实验性，turn-scoped environments。省略继承 thread sticky environments；空数组禁用；非空覆盖本 turn。 |
| `cwd` | path 或 null | 覆盖本 turn 及后续 turns 的工作目录。 |
| `approvalPolicy` | `AskForApproval` 或 null | 覆盖本 turn 及后续 turns 的审批策略。 |
| `approvalsReviewer` | `ApprovalsReviewer` 或 null | 覆盖本 turn 及后续 turns 的审批 reviewer。 |
| `sandboxPolicy` | `SandboxPolicy` 或 null | 覆盖本 turn 及后续 turns 的 legacy sandbox policy。 |
| `permissions` | object 或 null | 实验性，选择 named permissions profile；不能与 `sandboxPolicy` 同时发送。 |
| `model` | string 或 null | 覆盖本 turn 及后续 turns 的模型。 |
| `serviceTier` | `ServiceTier` 或 null | 覆盖本 turn 及后续 turns 的 service tier。 |
| `effort` | `ReasoningEffort` 或 null | 覆盖本 turn 及后续 turns 的 reasoning effort。 |
| `summary` | `ReasoningSummary` 或 null | 覆盖本 turn 及后续 turns 的 reasoning summary。 |
| `personality` | enum 或 null | 覆盖本 turn 及后续 turns 的 personality。 |
| `outputSchema` | JSON Schema 或 null | 只约束当前 turn 的最终 assistant message。 |
| `collaborationMode` | object 或 null | 实验性预设协作模式。优先于 model、reasoning effort、developer instructions。 |

响应：

```json
{
  "id": 40,
  "result": {
    "turn": {
      "id": "turn_1",
      "items": [],
      "status": "inProgress",
      "error": null,
      "startedAt": null,
      "completedAt": null,
      "durationMs": null
    }
  }
}
```

注意：

- response 中的 `turn` 是初始对象，`items` 通常为空。
- 真正开始运行时会发 `turn/started`。
- 后续 item 和 delta 必须从 notification stream 读取。

典型事件流：

```json
{
  "method": "turn/started",
  "params": {
    "threadId": "thr_1",
    "turn": {
      "id": "turn_1",
      "items": [],
      "status": "inProgress",
      "error": null,
      "startedAt": 1760000000,
      "completedAt": null,
      "durationMs": null
    }
  }
}
```

```json
{
  "method": "item/started",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "item": {
      "type": "agentMessage",
      "id": "msg_1",
      "text": "",
      "phase": null,
      "memoryCitation": null
    }
  }
}
```

```json
{
  "method": "item/agentMessage/delta",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "msg_1",
    "delta": "Tests are failing because..."
  }
}
```

```json
{
  "method": "item/completed",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "item": {
      "type": "agentMessage",
      "id": "msg_1",
      "text": "Tests are failing because...",
      "phase": "final",
      "memoryCitation": null
    }
  }
}
```

```json
{
  "method": "turn/completed",
  "params": {
    "threadId": "thr_1",
    "turn": {
      "id": "turn_1",
      "items": [],
      "status": "completed",
      "error": null,
      "startedAt": 1760000000,
      "completedAt": 1760000030,
      "durationMs": 30000
    }
  }
}
```

## 16. `turn/steer`

用途：向已经 in-flight 的 regular turn 追加用户输入，不创建新 turn。

请求：

```json
{
  "id": 41,
  "method": "turn/steer",
  "params": {
    "threadId": "thr_1",
    "expectedTurnId": "turn_1",
    "input": [
      {
        "type": "text",
        "text": "Actually focus on the failing test first.",
        "textElements": []
      }
    ]
  }
}
```

Params：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `threadId` | string | 目标 thread。 |
| `input` | `UserInput[]` | 追加输入。 |
| `responsesapiClientMetadata` | object 或 null | 实验性，turn-scoped metadata。 |
| `expectedTurnId` | string | 必填。必须等于当前 active turn id。 |

响应：

```json
{
  "id": 41,
  "result": {
    "turnId": "turn_1"
  }
}
```

失败条件：

- 没有 active turn。
- `expectedTurnId` 与当前 active turn 不匹配。
- 当前 active turn 不是 steerable regular turn，例如 review turn 或 manual compact turn。

失败时常见 structured error 是 `ActiveTurnNotSteerable { turnKind }`，`turnKind` 可能是 `review` 或 `compact`。

## 17. `turn/interrupt`

用途：请求取消正在运行的 turn。

请求：

```json
{
  "id": 42,
  "method": "turn/interrupt",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1"
  }
}
```

响应：

```json
{
  "id": 42,
  "result": {}
}
```

语义：

- response 只表示 cancellation request 被接受。
- 真正完成取消以后，服务端会发送 `turn/completed`。
- 被中断的 turn 最终 `status` 是 `interrupted`。
- `turn/interrupt` 不会终止后台 terminals；需要显式调用 `thread/backgroundTerminals/clean` 才会清理后台 terminal。

最终通知示例：

```json
{
  "method": "turn/completed",
  "params": {
    "threadId": "thr_1",
    "turn": {
      "id": "turn_1",
      "items": [],
      "status": "interrupted",
      "error": null,
      "startedAt": 1760000000,
      "completedAt": 1760000005,
      "durationMs": 5000
    }
  }
}
```

## 18. `review/start`

用途：启动 Codex 自动 code review。它的响应形状接近 `turn/start`，并通过普通 turn/item 事件流输出。

请求：

```json
{
  "id": 50,
  "method": "review/start",
  "params": {
    "threadId": "thr_1",
    "delivery": "inline",
    "target": {
      "type": "uncommittedChanges"
    }
  }
}
```

`target`：

| type | 字段 | 说明 |
| --- | --- | --- |
| `uncommittedChanges` | 无 | review staged、unstaged、untracked files。 |
| `baseBranch` | `branch` | review 当前分支与 base branch 的差异。 |
| `commit` | `sha`, `title?` | review 指定 commit。 |
| `custom` | `instructions` | 自定义 reviewer prompt。 |

`delivery`：

| 值 | 说明 |
| --- | --- |
| `inline` | 默认。review 作为当前 thread 的新 turn 运行，`reviewThreadId` 等于原 `threadId`。 |
| `detached` | fork 出新 review thread，在新 thread 中运行 review；会额外发新 thread 的 `thread/started`。 |

响应：

```json
{
  "id": 50,
  "result": {
    "turn": {
      "id": "turn_review_1",
      "items": [
        {
          "type": "userMessage",
          "id": "turn_review_1",
          "content": [
            {
              "type": "text",
              "text": "Review current changes",
              "textElements": []
            }
          ]
        }
      ],
      "status": "inProgress",
      "error": null,
      "startedAt": null,
      "completedAt": null,
      "durationMs": null
    },
    "reviewThreadId": "thr_1"
  }
}
```

事件流中会出现：

```json
{
  "method": "item/started",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_review_1",
    "item": {
      "type": "enteredReviewMode",
      "id": "item_1",
      "review": "current changes"
    }
  }
}
```

review 结束时：

```json
{
  "method": "item/completed",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_review_1",
    "item": {
      "type": "exitedReviewMode",
      "id": "item_2",
      "review": "Looks solid overall...\n\n- finding..."
    }
  }
}
```

`exitedReviewMode.review` 是已经格式化好的 plain text，包含整体说明和 findings 列表，客户端可直接渲染。

## 19. ThreadItem 详解

所有 `ThreadItem` 都有 `type`。多数 item 还有 `id`，用于和 delta 通知的 `itemId` 对齐。

### 19.1 `userMessage`

```json
{
  "type": "userMessage",
  "id": "item_1",
  "content": [
    {
      "type": "text",
      "text": "Run tests",
      "textElements": []
    }
  ]
}
```

表示用户输入。`content` 是 `UserInput[]`。

### 19.2 `agentMessage`

```json
{
  "type": "agentMessage",
  "id": "msg_1",
  "text": "Done.",
  "phase": "final",
  "memoryCitation": null
}
```

字段：

| 字段 | 说明 |
| --- | --- |
| `text` | 已累计的 assistant 文本。 |
| `phase` | 消息阶段，可能为 null。 |
| `memoryCitation` | memory 引用信息，可能为 null。 |

实时文本通过 `item/agentMessage/delta` 追加。最终以 `item/completed` 的完整 `agentMessage.text` 为准。

### 19.3 `reasoning`

```json
{
  "type": "reasoning",
  "id": "reasoning_1",
  "summary": ["I’m checking the failing tests."],
  "content": []
}
```

字段：

| 字段 | 说明 |
| --- | --- |
| `summary` | 可展示 reasoning summary。 |
| `content` | raw reasoning blocks，主要用于某些 open source models。 |

相关 delta：

- `item/reasoning/summaryPartAdded`
- `item/reasoning/summaryTextDelta`
- `item/reasoning/textDelta`

### 19.4 `plan`

```json
{
  "type": "plan",
  "id": "plan_1",
  "text": "1. Inspect tests\n2. Fix failure"
}
```

`plan` item 是 proposed plan 文本。另有 `turn/plan/updated` 可用于结构化 plan UI。

`item/plan/delta` 是实验性流式 plan 文本。原生注释提醒：不要假设拼接后的 deltas 一定等于 completed plan item content。

### 19.5 `commandExecution`

```json
{
  "type": "commandExecution",
  "id": "cmd_1",
  "command": "npm test",
  "cwd": "/repo",
  "processId": "proc_1",
  "source": "agent",
  "status": "inProgress",
  "commandActions": [],
  "aggregatedOutput": null,
  "exitCode": null,
  "durationMs": null
}
```

字段：

| 字段 | 说明 |
| --- | --- |
| `command` | 命令字符串。 |
| `cwd` | 工作目录。 |
| `processId` | 底层 PTY process id，如果有。 |
| `source` | `agent`、`userShell`、`unifiedExecStartup`、`unifiedExecInteraction`。 |
| `status` | `inProgress`、`completed`、`failed`、`declined`。 |
| `commandActions` | 对命令的 best-effort 解析，供 UI 展示风险/动作。 |
| `aggregatedOutput` | 最终聚合输出。 |
| `exitCode` | 退出码。 |
| `durationMs` | 执行耗时。 |

相关 delta：

```json
{
  "method": "item/commandExecution/outputDelta",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "cmd_1",
    "delta": "stdout chunk"
  }
}
```

### 19.6 `fileChange`

```json
{
  "type": "fileChange",
  "id": "patch_1",
  "changes": [
    {
      "path": "src/app.rs",
      "kind": "update",
      "diff": "--- a/src/app.rs\n+++ b/src/app.rs\n..."
    }
  ],
  "status": "completed"
}
```

`changes[].kind`：

- `add`
- `delete`
- `update`，可带 `movePath`

`status`：

- `inProgress`
- `completed`
- `failed`
- `declined`

相关事件：

- `item/fileChange/outputDelta`
- `item/fileChange/patchUpdated`
- `turn/diff/updated`

`turn/diff/updated` 是 turn 级聚合 diff 快照，客户端可直接作为“本 turn 全部修改”的最新视图，不需要自己拼多个 fileChange。

### 19.7 `mcpToolCall`

```json
{
  "type": "mcpToolCall",
  "id": "mcp_1",
  "server": "github",
  "tool": "search",
  "status": "completed",
  "arguments": {},
  "mcpAppResourceUri": null,
  "result": {
    "content": [],
    "structuredContent": null,
    "_meta": null
  },
  "error": null,
  "durationMs": 1234
}
```

`status`：

- `inProgress`
- `completed`
- `failed`

进度通知：

```json
{
  "method": "item/mcpToolCall/progress",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "mcp_1",
    "message": "Fetching..."
  }
}
```

### 19.8 `dynamicToolCall`

```json
{
  "type": "dynamicToolCall",
  "id": "dyn_1",
  "namespace": "custom",
  "tool": "my_tool",
  "arguments": {},
  "status": "completed",
  "contentItems": [
    {
      "type": "inputText",
      "text": "result"
    }
  ],
  "success": true,
  "durationMs": 100
}
```

dynamic tool call 的执行可能通过服务端反向 request `item/tool/call` 交给客户端处理。

### 19.9 `collabAgentToolCall`

```json
{
  "type": "collabAgentToolCall",
  "id": "collab_1",
  "tool": "spawnAgent",
  "status": "completed",
  "senderThreadId": "thr_1",
  "receiverThreadIds": ["thr_child"],
  "prompt": "Investigate tests",
  "model": null,
  "reasoningEffort": null,
  "agentsStates": {
    "thr_child": {
      "status": "running",
      "message": null
    }
  }
}
```

`tool`：

- `spawnAgent`
- `sendInput`
- `resumeAgent`
- `wait`
- `closeAgent`

`status`：

- `inProgress`
- `completed`
- `failed`

### 19.10 `webSearch`

```json
{
  "type": "webSearch",
  "id": "search_1",
  "query": "codex app server",
  "action": {
    "type": "search",
    "query": "codex app server",
    "queries": null
  }
}
```

`action` 可能是：

- `search`
- `openPage`
- `findInPage`
- `other`

### 19.11 `imageView`

```json
{
  "type": "imageView",
  "id": "img_1",
  "path": "/repo/screenshot.png"
}
```

表示 agent 调用了 image viewer。

### 19.12 `imageGeneration`

```json
{
  "type": "imageGeneration",
  "id": "image_gen_1",
  "status": "completed",
  "revisedPrompt": null,
  "result": "...",
  "savedPath": "/repo/out.png"
}
```

表示 agent 发起图片生成。

### 19.13 `enteredReviewMode` / `exitedReviewMode`

进入 review：

```json
{
  "type": "enteredReviewMode",
  "id": "review_enter_1",
  "review": "current changes"
}
```

退出 review：

```json
{
  "type": "exitedReviewMode",
  "id": "review_exit_1",
  "review": "Looks solid overall..."
}
```

### 19.14 `contextCompaction`

```json
{
  "type": "contextCompaction",
  "id": "compact_1"
}
```

表示对话历史发生 compaction，可能是自动发生，也可能来自 `thread/compact/start`。

## 20. 服务端通知总表

### 20.1 Thread notifications

| method | params | 说明 |
| --- | --- | --- |
| `thread/started` | `{ thread }` | thread 被启动/恢复/fork 并可订阅事件。 |
| `thread/status/changed` | `{ threadId, status }` | loaded/running/approval/user-input/system-error 状态变化。 |
| `thread/archived` | `{ threadId }` | thread 被归档。 |
| `thread/unarchived` | `{ threadId }` | thread 被取消归档。 |
| `thread/closed` | `{ threadId }` | loaded thread 被关闭/unload。 |
| `thread/name/updated` | `{ threadId, threadName? }` | thread 名称更新。 |
| `thread/goal/updated` | `{ threadId, turnId?, goal }` | 实验性，goal 更新。 |
| `thread/goal/cleared` | `{ threadId }` | 实验性，goal 清除。 |
| `thread/tokenUsage/updated` | `{ threadId, turnId, tokenUsage }` | token usage 快照更新。 |

### 20.2 Turn notifications

| method | params | 说明 |
| --- | --- | --- |
| `turn/started` | `{ threadId, turn }` | turn 开始运行。 |
| `turn/completed` | `{ threadId, turn }` | turn 结束，status 为 `completed`、`interrupted` 或 `failed`。 |
| `turn/diff/updated` | `{ threadId, turnId, diff }` | 本 turn 的聚合 unified diff 更新。 |
| `turn/plan/updated` | `{ threadId, turnId, explanation?, plan }` | 结构化 plan 更新。 |

`turn/plan/updated.plan[]`：

```json
{
  "step": "Run tests",
  "status": "inProgress"
}
```

`status` 是：

- `pending`
- `inProgress`
- `completed`

### 20.3 Item lifecycle notifications

| method | params | 说明 |
| --- | --- | --- |
| `item/started` | `{ threadId, turnId, item }` | 一个 item 开始。 |
| `item/completed` | `{ threadId, turnId, item }` | 一个 item 完成，通常可视为该 item 最终权威状态。 |
| `item/autoApprovalReview/started` | `{ threadId, turnId, reviewId, targetItemId?, review, action }` | 不稳定，auto-review 开始。 |
| `item/autoApprovalReview/completed` | `{ threadId, turnId, reviewId, targetItemId?, decisionSource, review, action }` | 不稳定，auto-review 完成。 |

### 20.4 Item delta/progress notifications

| method | params | 说明 |
| --- | --- | --- |
| `item/agentMessage/delta` | `{ threadId, turnId, itemId, delta }` | assistant 文本增量。 |
| `item/plan/delta` | `{ threadId, turnId, itemId, delta }` | 实验性 plan 文本增量。 |
| `item/reasoning/summaryPartAdded` | `{ threadId, turnId, itemId, summaryIndex }` | reasoning summary 新 section。 |
| `item/reasoning/summaryTextDelta` | `{ threadId, turnId, itemId, delta, summaryIndex }` | reasoning summary 文本增量。 |
| `item/reasoning/textDelta` | `{ threadId, turnId, itemId, delta, contentIndex }` | raw reasoning 文本增量。 |
| `item/commandExecution/outputDelta` | `{ threadId, turnId, itemId, delta }` | command stdout/stderr 文本增量。 |
| `item/commandExecution/terminalInteraction` | `{ threadId, turnId, itemId, processId, stdin }` | terminal interaction。 |
| `item/fileChange/outputDelta` | `{ threadId, turnId, itemId, delta }` | file change 工具输出增量。 |
| `item/fileChange/patchUpdated` | `{ threadId, turnId, itemId, changes }` | streaming patch structured snapshot。 |
| `item/mcpToolCall/progress` | `{ threadId, turnId, itemId, message }` | MCP 工具进度消息。 |

### 20.5 Model/runtime notifications

| method | params | 说明 |
| --- | --- | --- |
| `error` | `{ error, willRetry, threadId, turnId }` | turn 中错误。可能先于 terminal `turn/completed`。 |
| `warning` | `{ threadId?, message }` | 非致命 runtime warning。 |
| `model/rerouted` | `{ threadId, turnId, fromModel, toModel, reason }` | 后端将请求 reroute 到其他模型。 |
| `model/verification` | `{ threadId, turnId, verifications }` | 账户需要额外 verification。 |
| `serverRequest/resolved` | `{ threadId, requestId }` | 服务端反向请求已被客户端响应并在 thread listener 顺序中 resolved。 |

### 20.6 Realtime notifications

这些是实验性、thread-scoped、ephemeral events：

| method | params | 说明 |
| --- | --- | --- |
| `thread/realtime/started` | `{ threadId, sessionId, version }` | realtime 启动。 |
| `thread/realtime/itemAdded` | `{ threadId, item }` | 上游 realtime raw non-audio item。 |
| `thread/realtime/transcript/delta` | `{ threadId, role, delta }` | transcript delta。 |
| `thread/realtime/transcript/done` | `{ threadId, role, text }` | transcript final text。 |
| `thread/realtime/outputAudio/delta` | `{ threadId, audio }` | 输出音频 chunk。 |
| `thread/realtime/sdp` | `{ threadId, sdp }` | WebRTC remote answer SDP。 |
| `thread/realtime/error` | `{ threadId, message }` | realtime 错误。 |
| `thread/realtime/closed` | `{ threadId, reason }` | realtime 关闭。 |

## 21. Token usage

`thread/tokenUsage/updated`：

```json
{
  "method": "thread/tokenUsage/updated",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "tokenUsage": {
      "total": {
        "totalTokens": 1000,
        "inputTokens": 700,
        "cachedInputTokens": 100,
        "outputTokens": 300,
        "reasoningOutputTokens": 50
      },
      "last": {
        "totalTokens": 400,
        "inputTokens": 300,
        "cachedInputTokens": 50,
        "outputTokens": 100,
        "reasoningOutputTokens": 20
      },
      "modelContextWindow": 200000
    }
  }
}
```

字段：

| 字段 | 说明 |
| --- | --- |
| `total` | thread 累计 token usage。 |
| `last` | 最近一次模型请求 token usage。 |
| `modelContextWindow` | 当前模型 context window，可能为 null。 |

`total` 和 `last` 都包含：

- `totalTokens`
- `inputTokens`
- `cachedInputTokens`
- `outputTokens`
- `reasoningOutputTokens`

## 22. 服务端反向请求

服务端反向请求是 app-server 发送给客户端、需要客户端 response 的 request。它们带 `id`，客户端必须返回同一 `id` 的 result。

### 22.1 总表

| method | params | 客户端 response | 说明 |
| --- | --- | --- | --- |
| `item/commandExecution/requestApproval` | `CommandExecutionRequestApprovalParams` | `{ decision }` | 命令执行审批。 |
| `item/fileChange/requestApproval` | `FileChangeRequestApprovalParams` | `{ decision }` | 文件修改审批。 |
| `item/tool/requestUserInput` | `ToolRequestUserInputParams` | `{ answers }` | 工具调用请求用户输入，实验性。 |
| `mcpServer/elicitation/request` | `McpServerElicitationRequestParams` | `{ action, content, _meta }` | MCP elicitation。 |
| `item/permissions/requestApproval` | `PermissionsRequestApprovalParams` | `{ permissions, scope, strictAutoReview? }` | 权限请求审批。 |
| `item/tool/call` | `DynamicToolCallParams` | `{ contentItems, success }` | 请求客户端执行 dynamic tool call。 |
| `account/chatgptAuthTokens/refresh` | `ChatgptAuthTokensRefreshParams` | `{ ... }` | 外部 host app 刷新 ChatGPT auth tokens。 |
| `applyPatchApproval` | v1 legacy | `{ decision }` | legacy patch 审批。 |
| `execCommandApproval` | v1 legacy | `{ decision }` | legacy exec 审批。 |

### 22.2 命令审批

服务端请求：

```json
{
  "id": "req_1",
  "method": "item/commandExecution/requestApproval",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "cmd_1",
    "approvalId": null,
    "reason": "Need network access",
    "networkApprovalContext": null,
    "command": "npm install",
    "cwd": "/repo",
    "commandActions": [],
    "proposedExecpolicyAmendment": null,
    "proposedNetworkPolicyAmendments": null,
    "availableDecisions": null
  }
}
```

Params：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `itemId` | 对应 `commandExecution` item。 |
| `approvalId` | 可选；zsh exec bridge 子命令审批时可与 parent `itemId` 区分。 |
| `reason` | 可选审批原因。 |
| `networkApprovalContext` | 管理网络审批上下文。 |
| `command` | 命令字符串，可能为 null。 |
| `cwd` | 工作目录，可能为 null。 |
| `commandActions` | best-effort parsed command actions。 |
| `additionalPermissions` | 实验性，命令请求的额外权限。 |
| `proposedExecpolicyAmendment` | 建议加入 execpolicy，未来类似命令可不再提示。 |
| `proposedNetworkPolicyAmendments` | 建议加入网络策略。 |
| `availableDecisions` | 实验性，服务端建议客户端展示的 decision 列表。 |

客户端响应：

```json
{
  "id": "req_1",
  "result": {
    "decision": "accept"
  }
}
```

`CommandExecutionApprovalDecision` 的 wire 值：

| 值 | 说明 |
| --- | --- |
| `accept` | 批准本次命令。 |
| `acceptForSession` | 批准本次命令，并把相似审批放入 session-scoped approval cache。 |
| `{ "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ... } }` | 批准并应用 proposed execpolicy amendment。 |
| `{ "applyNetworkPolicyAmendment": { "network_policy_amendment": ... } }` | 应用持久网络策略 amendment。 |
| `decline` | 拒绝命令，但 turn 继续。 |
| `cancel` | 拒绝命令，并立即中断 turn。 |

响应后服务端可能发：

```json
{
  "method": "serverRequest/resolved",
  "params": {
    "threadId": "thr_1",
    "requestId": "req_1"
  }
}
```

### 22.3 文件修改审批

服务端请求：

```json
{
  "id": "req_2",
  "method": "item/fileChange/requestApproval",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "patch_1",
    "reason": "Need write access",
    "grantRoot": "/repo"
  }
}
```

客户端响应：

```json
{
  "id": "req_2",
  "result": {
    "decision": "accept"
  }
}
```

`FileChangeApprovalDecision` 的 wire 值：

| 值 | 说明 |
| --- | --- |
| `accept` | 批准本次文件修改。 |
| `acceptForSession` | 批准本次修改，并允许同一 session 中相同文件的后续修改不再提示。 |
| `decline` | 拒绝文件修改，但 turn 继续。 |
| `cancel` | 拒绝文件修改，并立即中断 turn。 |

### 22.4 请求用户输入

服务端请求：

```json
{
  "id": "req_3",
  "method": "item/tool/requestUserInput",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "tool_1",
    "questions": [
      {
        "id": "choice",
        "header": "选择",
        "question": "请选择下一步",
        "isOther": false,
        "isSecret": false,
        "options": [
          {
            "label": "继续",
            "description": "继续当前方案"
          }
        ]
      }
    ]
  }
}
```

客户端响应：

```json
{
  "id": "req_3",
  "result": {
    "answers": {
      "choice": {
        "answers": ["继续"]
      }
    }
  }
}
```

### 22.5 MCP elicitation

服务端请求可能是 form：

```json
{
  "id": "req_4",
  "method": "mcpServer/elicitation/request",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "serverName": "example",
    "mode": "form",
    "_meta": null,
    "message": "Please provide input",
    "requestedSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  }
}
```

也可能是 url：

```json
{
  "id": "req_5",
  "method": "mcpServer/elicitation/request",
  "params": {
    "threadId": "thr_1",
    "turnId": null,
    "serverName": "example",
    "mode": "url",
    "_meta": null,
    "message": "Open this URL",
    "url": "https://example.com",
    "elicitationId": "elicit_1"
  }
}
```

客户端响应：

```json
{
  "id": "req_4",
  "result": {
    "action": "accept",
    "content": {},
    "_meta": null
  }
}
```

`action`：

- `accept`
- `decline`
- `cancel`

### 22.6 Permissions approval

服务端请求：

```json
{
  "id": "req_6",
  "method": "item/permissions/requestApproval",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "perm_1",
    "cwd": "/repo",
    "reason": "Need write permission",
    "permissions": {}
  }
}
```

客户端响应：

```json
{
  "id": "req_6",
  "result": {
    "permissions": {},
    "scope": "turn",
    "strictAutoReview": null
  }
}
```

`scope`：

- `turn`
- `session`

### 22.7 Dynamic tool call

服务端请求：

```json
{
  "id": "req_7",
  "method": "item/tool/call",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "callId": "dyn_1",
    "namespace": "custom",
    "tool": "lookup",
    "arguments": {
      "query": "abc"
    }
  }
}
```

客户端响应：

```json
{
  "id": "req_7",
  "result": {
    "contentItems": [
      {
        "type": "inputText",
        "text": "result"
      }
    ],
    "success": true
  }
}
```

`contentItems[]`：

- `{ "type": "inputText", "text": string }`
- `{ "type": "inputImage", "imageUrl": string }`

## 23. 审批策略与沙箱

### 23.1 AskForApproval

`approvalPolicy` 使用 kebab-case/string 或 granular object。

可见值：

| wire 值 | Rust variant | 说明 |
| --- | --- | --- |
| `untrusted` | `UnlessTrusted` | legacy/默认语义之一：不可信场景需要审批。 |
| `on-failure` | `OnFailure` | 失败后请求审批。 |
| `on-request` | `OnRequest` | 模型主动请求时审批。 |
| `never` | `Never` | 不请求审批。 |
| object | `Granular` | 实验性 granular config。 |

Granular：

```json
{
  "granular": {
    "sandbox_approval": true,
    "rules": true,
    "skill_approval": false,
    "request_permissions": false,
    "mcp_elicitations": true
  }
}
```

### 23.2 ApprovalsReviewer

| 值 | 说明 |
| --- | --- |
| `user` | 默认，审批请求直接交给客户端/用户。 |
| `auto_review` | 交给 auto-review subagent 判断。 |
| `guardian_subagent` | legacy alias，仍可接受。 |

### 23.3 SandboxMode

`thread/start.sandbox` 可用：

- `read-only`
- `workspace-write`
- `danger-full-access`

对于新客户端，原生注释倾向于使用实验性 `permissions` / `permissionProfile` 理解精确 runtime permissions；`sandbox` 和 response 中的 `sandbox` 是兼容投影。

## 24. 错误模型

错误分三层：

1. JSON-RPC error：请求在协议层、参数层、权限层被拒绝。
2. `error` notification：turn 运行中发生错误，可能仍会 retry。
3. `turn/completed` with `status: "failed"`：turn terminal failure。

`error` notification：

```json
{
  "method": "error",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "willRetry": false,
    "error": {
      "message": "Context window exceeded",
      "codexErrorInfo": "contextWindowExceeded",
      "additionalDetails": null
    }
  }
}
```

`CodexErrorInfo` 常见分类：

| 值 | 说明 |
| --- | --- |
| `contextWindowExceeded` | 上下文窗口超限。 |
| `usageLimitExceeded` | 用量限制。 |
| `serverOverloaded` | 服务端过载。 |
| `cyberPolicy` | cyber safety policy。 |
| `httpConnectionFailed` | 上游 HTTP 失败，可带 `httpStatusCode`。 |
| `responseStreamConnectionFailed` | 连接 Responses SSE stream 失败，可带 `httpStatusCode`。 |
| `responseStreamDisconnected` | turn 中途 SSE stream 断开，可带 `httpStatusCode`。 |
| `responseTooManyFailedAttempts` | responses retry 达上限，可带 `httpStatusCode`。 |
| `internalServerError` | 内部错误。 |
| `unauthorized` | 鉴权失败。 |
| `badRequest` | 请求错误。 |
| `threadRollbackFailed` | rollback 失败。 |
| `sandboxError` | 沙箱错误。 |
| `activeTurnNotSteerable` | 当前 active turn 不能 steer，例如 review/compact。 |
| `other` | 未分类。 |

`activeTurnNotSteerable` shape：

```json
{
  "activeTurnNotSteerable": {
    "turnKind": "review"
  }
}
```

具体 serde 表达由 generated schema 决定。消费端应容忍 enum 未来新增值。

## 25. 历史持久化与恢复

### 25.1 存储来源

原生 Codex 会把会话保存为 rollout/session JSONL。常见路径：

```text
~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl
```

thread-store 中的核心概念：

- `CreateThreadParams`：创建持久化 thread。
- `ResumeThreadParams`：重新打开已有 thread 的持久化 writer。
- `StoredThread`：列表/读取/恢复使用的 thread metadata。
- `StoredThreadHistory`：按 replay order 保存的 rollout items。

### 25.2 持久化模式

`ThreadEventPersistenceMode`：

| 值 | 说明 |
| --- | --- |
| `Limited` | legacy minimal replay surface。 |
| `Extended` | 更丰富 event surface，用于 app-server history reconstruction。 |

`thread/start`、`thread/resume`、`thread/fork` 都有 `persistExtendedHistory` 实验性字段。它影响之后写入的历史，不会把旧 rollout 中未保存的事件补回来。

### 25.3 历史重建规则

`ThreadHistoryBuilder` 将 persisted `RolloutItem[]` 重建成 `Turn[]`。

重要规则：

- 优先使用 `TurnStartedEvent.turn_id` 作为 canonical turn id。
- `TurnStarted` 会结束当前 turn，打开一个 explicit `inProgress` turn。
- `TurnComplete` 会将匹配 turn 标记为 `completed` 并完成它。
- `TurnAborted` 会将匹配 turn 标记为 `interrupted`。
- `ErrorEvent` 如果影响 turn status，会把当前 turn 标为 `failed` 并写入 `TurnError`。
- `ThreadRolledBack` 会删除末尾 N 个 turns，并重算后续 item id index。
- 旧 rollout 中如果没有 explicit turn boundary，会按 user message / agent message / tool event 尽量合成 turn。
- 空 turn 通常会被丢弃，除非它是 explicit turn 或含 compaction marker。

### 25.4 历史为什么可能 lossy

`ThreadItem` 是 UI/客户端友好的重建结果，不等于 rollout 里所有原始事件的完整无损投影。

可能丢失或简化的内容：

- 某些默认 limited persistence 下未保存的 tool progress。
- 某些 streaming delta 的中间态。
- 某些内部事件。
- realtime audio/text 事件，因为 realtime 本来就不是 `ThreadItem`。

如果客户端需要避免一次性拉大量 turns：

1. `thread/resume` 使用 `excludeTurns: true`。
2. 调 `thread/turns/list` 分页读取历史。
3. 对 live events 继续从当前连接的 notification stream 合并。

## 26. Realtime API

Realtime 是实验性 thread-scoped session。

启动 text realtime：

```json
{
  "id": 60,
  "method": "thread/realtime/start",
  "params": {
    "threadId": "thr_1",
    "outputModality": "text",
    "prompt": "You are on a call.",
    "sessionId": null,
    "transport": {
      "type": "websocket"
    },
    "voice": null
  }
}
```

启动 WebRTC audio realtime：

```json
{
  "id": 61,
  "method": "thread/realtime/start",
  "params": {
    "threadId": "thr_1",
    "outputModality": "audio",
    "prompt": null,
    "sessionId": null,
    "transport": {
      "type": "webrtc",
      "sdp": "v=0\r\no=..."
    },
    "voice": null
  }
}
```

响应：

```json
{
  "id": 61,
  "result": {}
}
```

WebRTC remote answer 通过通知返回：

```json
{
  "method": "thread/realtime/sdp",
  "params": {
    "threadId": "thr_1",
    "sdp": "v=0\r\no=..."
  }
}
```

追加文本：

```json
{
  "id": 62,
  "method": "thread/realtime/appendText",
  "params": {
    "threadId": "thr_1",
    "text": "Hello"
  }
}
```

追加音频：

```json
{
  "id": 63,
  "method": "thread/realtime/appendAudio",
  "params": {
    "threadId": "thr_1",
    "audio": {
      "data": "base64...",
      "sampleRate": 24000,
      "numChannels": 1,
      "samplesPerChannel": 480,
      "itemId": null
    }
  }
}
```

停止：

```json
{
  "id": 64,
  "method": "thread/realtime/stop",
  "params": {
    "threadId": "thr_1"
  }
}
```

关键区别：

- Realtime events 不进入 `thread.turns`。
- Realtime events 不通过 `ThreadHistoryBuilder` 恢复。
- 客户端如果要展示 realtime transcript，需要自己在 live session 内维护。

## 27. 端到端示例：最小聊天

客户端发送：

```json
{"id":0,"method":"initialize","params":{"clientInfo":{"name":"example_client","title":"Example Client","version":"0.1.0"},"capabilities":{"experimentalApi":true,"optOutNotificationMethods":[]}}}
```

服务端：

```json
{"id":0,"result":{"userAgent":"codex_cli_rs/...","codexHome":"/Users/me/.codex","platformFamily":"unix","platformOs":"macos"}}
```

客户端：

```json
{"method":"initialized"}
```

客户端：

```json
{"id":1,"method":"thread/start","params":{"cwd":"/repo","approvalPolicy":"never","sandbox":"workspace-write"}}
```

服务端 response：

```json
{"id":1,"result":{"thread":{"id":"thr_1","forkedFromId":null,"preview":"","ephemeral":false,"modelProvider":"openai","createdAt":1760000000,"updatedAt":1760000000,"status":{"type":"idle"},"path":"/Users/me/.codex/sessions/2026/05/06/rollout.jsonl","cwd":"/repo","cliVersion":"0.0.0","source":"appServer","agentNickname":null,"agentRole":null,"gitInfo":null,"name":null,"turns":[]},"model":"gpt-5.1-codex","modelProvider":"openai","serviceTier":null,"cwd":"/repo","instructionSources":[],"approvalPolicy":"never","approvalsReviewer":"user","sandbox":{"type":"workspaceWrite","writableRoots":["/repo"],"networkAccess":true,"excludeTmpdirEnvVar":false,"excludeSlashTmp":false},"permissionProfile":null,"activePermissionProfile":null,"reasoningEffort":null}}
```

服务端 notification：

```json
{"method":"thread/started","params":{"thread":{"id":"thr_1","turns":[]}}}
```

客户端：

```json
{"id":2,"method":"turn/start","params":{"threadId":"thr_1","input":[{"type":"text","text":"Say hello","textElements":[]}]}}
```

服务端 response：

```json
{"id":2,"result":{"turn":{"id":"turn_1","items":[],"status":"inProgress","error":null,"startedAt":null,"completedAt":null,"durationMs":null}}}
```

服务端通知流：

```json
{"method":"turn/started","params":{"threadId":"thr_1","turn":{"id":"turn_1","items":[],"status":"inProgress","error":null,"startedAt":1760000001,"completedAt":null,"durationMs":null}}}
```

```json
{"method":"item/started","params":{"threadId":"thr_1","turnId":"turn_1","item":{"type":"agentMessage","id":"msg_1","text":"","phase":null,"memoryCitation":null}}}
```

```json
{"method":"item/agentMessage/delta","params":{"threadId":"thr_1","turnId":"turn_1","itemId":"msg_1","delta":"Hello"}}
```

```json
{"method":"item/completed","params":{"threadId":"thr_1","turnId":"turn_1","item":{"type":"agentMessage","id":"msg_1","text":"Hello","phase":"final","memoryCitation":null}}}
```

```json
{"method":"turn/completed","params":{"threadId":"thr_1","turn":{"id":"turn_1","items":[],"status":"completed","error":null,"startedAt":1760000001,"completedAt":1760000003,"durationMs":2000}}}
```

客户端应维护：

- thread registry：由 `thread/start` response 和 `thread/started` 初始化。
- active turn：由 `turn/start` response 先建，`turn/started` 补 startedAt。
- item map/list：由 `item/started` 创建，delta 追加，`item/completed` 覆盖最终状态。
- turn terminal state：由 `turn/completed` 设置。

## 28. 端到端示例：resume + 分页历史

客户端：

```json
{
  "id": 100,
  "method": "thread/resume",
  "params": {
    "threadId": "thr_1",
    "excludeTurns": true
  }
}
```

服务端：

```json
{
  "id": 100,
  "result": {
    "thread": {
      "id": "thr_1",
      "turns": []
    },
    "model": "gpt-5.1-codex",
    "modelProvider": "openai",
    "serviceTier": null,
    "cwd": "/repo",
    "instructionSources": [],
    "approvalPolicy": "never",
    "approvalsReviewer": "user",
    "sandbox": {
      "type": "workspaceWrite",
      "writableRoots": ["/repo"],
      "networkAccess": true,
      "excludeTmpdirEnvVar": false,
      "excludeSlashTmp": false
    },
    "permissionProfile": null,
    "activePermissionProfile": null,
    "reasoningEffort": null
  }
}
```

然后分页：

```json
{
  "id": 101,
  "method": "thread/turns/list",
  "params": {
    "threadId": "thr_1",
    "limit": 20,
    "sortDirection": "desc"
  }
}
```

服务端：

```json
{
  "id": 101,
  "result": {
    "data": [
      {
        "id": "turn_1",
        "items": [
          {
            "type": "userMessage",
            "id": "item_1",
            "content": [
              {
                "type": "text",
                "text": "Say hello",
                "textElements": []
              }
            ]
          },
          {
            "type": "agentMessage",
            "id": "item_2",
            "text": "Hello",
            "phase": "final",
            "memoryCitation": null
          }
        ],
        "status": "completed",
        "error": null,
        "startedAt": 1760000001,
        "completedAt": 1760000003,
        "durationMs": 2000
      }
    ],
    "nextCursor": null,
    "backwardsCursor": null
  }
}
```

## 29. 端到端示例：审批流

当 turn 中 agent 想执行命令，服务端可能先发 item：

```json
{
  "method": "item/started",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "item": {
      "type": "commandExecution",
      "id": "cmd_1",
      "command": "npm test",
      "cwd": "/repo",
      "processId": null,
      "source": "agent",
      "status": "inProgress",
      "commandActions": [],
      "aggregatedOutput": null,
      "exitCode": null,
      "durationMs": null
    }
  }
}
```

服务端请求审批：

```json
{
  "id": "approval_1",
  "method": "item/commandExecution/requestApproval",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "cmd_1",
    "approvalId": null,
    "reason": null,
    "networkApprovalContext": null,
    "command": "npm test",
    "cwd": "/repo",
    "commandActions": [],
    "proposedExecpolicyAmendment": null,
    "proposedNetworkPolicyAmendments": null,
    "availableDecisions": null
  }
}
```

客户端批准：

```json
{
  "id": "approval_1",
  "result": {
    "decision": "accept"
  }
}
```

服务端按 listener 顺序确认 resolved：

```json
{
  "method": "serverRequest/resolved",
  "params": {
    "threadId": "thr_1",
    "requestId": "approval_1"
  }
}
```

命令输出：

```json
{
  "method": "item/commandExecution/outputDelta",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "itemId": "cmd_1",
    "delta": "test output..."
  }
}
```

最终命令 item：

```json
{
  "method": "item/completed",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "item": {
      "type": "commandExecution",
      "id": "cmd_1",
      "command": "npm test",
      "cwd": "/repo",
      "processId": null,
      "source": "agent",
      "status": "completed",
      "commandActions": [],
      "aggregatedOutput": "test output...",
      "exitCode": 0,
      "durationMs": 12345
    }
  }
}
```

## 30. 客户端实现建议

协议消费端建议按这些规则构建状态：

1. 用 request `id` 匹配 response/error。
2. 用 `threadId` 分区维护 thread state。
3. 用 `turnId` 维护 active turn 和历史 turns。
4. 用 `item.id` / `itemId` 维护每个 turn 内的 item。
5. `item/started` 创建或 upsert item。
6. item-specific delta 只追加到对应 item 的临时 buffer。
7. `item/completed` 覆盖该 item 的最终对象。
8. `turn/completed` 只作为 turn terminal 状态，不要依赖其中 `items` 完整。
9. 收到服务端反向 request 时暂停对应 UI 操作，返回同 `id` response。
10. 对所有 enum 保持前向兼容，未知值不要让整个连接崩溃。

## 31. 维护方式

协议可能随原生 Codex 更新。维护本文时优先检查：

1. `app-server-protocol/src/protocol/common.rs`：method、notification、server request 的 wire 名称。
2. `app-server-protocol/src/protocol/v2.rs`：主 schema，尤其 Thread/Turn/ThreadItem、params/response/notification payload。
3. `app-server-protocol/src/protocol/v1.rs`：initialize 和 legacy APIs。
4. `app-server/src/codex_message_processor.rs`：请求如何实际处理。
5. `app-server/src/bespoke_event_handling.rs`：core event 如何转成 app-server notifications。
6. `app-server-protocol/src/protocol/thread_history.rs`：rollout history 如何重建 turns。
7. `thread-store/src/types.rs`：持久化 thread metadata 和历史读取参数。

原生仓库可以生成 schema：

```bash
codex app-server generate-ts --out DIR
codex app-server generate-json-schema --out DIR
```

当 schema 与本文冲突时，以原生 Rust 类型和生成 schema 为准。
