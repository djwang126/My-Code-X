# Codex App Server Pending Interaction 协议详解

本文档说明原生 Codex `codex app-server` 中 server-initiated JSON-RPC request 的协议、生命周期、请求类型、响应结构、清理语义和相关 runtime item 关系。文档只覆盖原生 Codex app-server，不包含 My-Code-X 上层 UI 适配逻辑。

在 Codex app-server 代码里，这类请求不是一个独立名为 `PendingInteraction` 的 wire type。它们是服务端主动发给客户端的 `ServerRequest`。客户端收到后需要用同一个 JSON-RPC `id` 返回 `result` 或 `error`。本文为了方便讨论，把“仍在等待客户端响应的 `ServerRequest`”称为 pending interaction。

本文基于本机相邻仓库 `../codex` 的 Rust 实现分析，主要事实来源：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v1.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server/src/outgoing_message.rs`
- `../codex/codex-rs/app-server/src/bespoke_event_handling.rs`
- `../codex/codex-rs/app-server/src/message_processor.rs`
- `../codex/codex-rs/app-server/src/dynamic_tools.rs`
- `../codex/codex-rs/app-server/src/thread_state.rs`

## 1. 范围

本文回答这些问题：

1. app-server 会向客户端主动发哪些 `ServerRequest`。
2. 每种 request 的 method、params、response shape 是什么。
3. request 如何与 `threadId`、`turnId`、`itemId`、`callId` 关联。
4. request resolved、turn transition、连接 resume 和错误响应的原生语义是什么。
5. request 与 `item/started`、`item/completed`、`serverRequest/resolved` 等通知的顺序关系是什么。

本文刻意不覆盖：

- 上层 UI 如何展示审批框、表单或按钮。
- 客户端如何把这些请求聚合为自己的 domain model。
- Codex TUI 或其他客户端的具体视觉实现。
- My-Code-X 的 pending interaction contract 或 presenter 设计。

本文中的“客户端”指连接到 `codex app-server` 的调用方。“服务端”指原生 Codex app-server 进程。

## 2. 协议总览

`ServerRequest` 是服务端主动发起的 JSON-RPC request。当前协议里包含 9 类：

| method | 稳定性 | 主要用途 | response |
| --- | --- | --- | --- |
| `item/commandExecution/requestApproval` | v2 | 请求用户审批一次命令执行、网络访问或命令级额外权限。 | `{ decision }` |
| `item/fileChange/requestApproval` | v2 | 请求用户审批一次文件修改。 | `{ decision }` |
| `item/tool/requestUserInput` | v2 experimental | 工具向用户询问一个或多个问题。 | `{ answers }` |
| `mcpServer/elicitation/request` | v2 | MCP server 向用户请求结构化输入或 URL 授权。 | `{ action, content, _meta }` |
| `item/permissions/requestApproval` | v2 | `request_permissions` 工具请求额外权限。 | `{ permissions, scope, strictAutoReview }` |
| `item/tool/call` | v2 experimental | 服务端请求客户端执行 dynamic tool call。 | `{ contentItems, success }` |
| `account/chatgptAuthTokens/refresh` | v2 | 外部 ChatGPT auth token 失效时请求客户端刷新 token。 | `{ accessToken, chatgptAccountId, chatgptPlanType }` |
| `applyPatchApproval` | v1 deprecated | legacy API 的 patch approval。 | `{ decision }` |
| `execCommandApproval` | v1 deprecated | legacy API 的 command approval。 | `{ decision }` |

对应协议入口：

```rust
server_request_definitions! {
    CommandExecutionRequestApproval => "item/commandExecution/requestApproval" { ... }
    FileChangeRequestApproval => "item/fileChange/requestApproval" { ... }
    ToolRequestUserInput => "item/tool/requestUserInput" { ... }
    McpServerElicitationRequest => "mcpServer/elicitation/request" { ... }
    PermissionsRequestApproval => "item/permissions/requestApproval" { ... }
    DynamicToolCall => "item/tool/call" { ... }
    ChatgptAuthTokensRefresh => "account/chatgptAuthTokens/refresh" { ... }
    ApplyPatchApproval { ... }
    ExecCommandApproval { ... }
}
```

Wire message 形态：

```json
{
  "id": 42,
  "method": "item/commandExecution/requestApproval",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "itemId": "call-1"
  }
}
```

客户端响应形态：

```json
{
  "id": 42,
  "result": {
    "decision": "accept"
  }
}
```

客户端也可以返回 JSON-RPC error。不同 request 对 error 有不同 fallback，详见后文。

## 3. 基础生命周期

### 3.1 发送 request

服务端通过 `OutgoingMessageSender::send_request` 发送 request：

1. 服务端分配一个递增 integer `RequestId`。
2. 服务端把 request 存入 `request_id_to_callback`。
3. 服务端把 JSON-RPC request 写给一个或多个连接。
4. 业务逻辑等待一个 oneshot receiver。
5. 客户端用同一个 `id` 返回 `result` 或 `error`。
6. 服务端取出 callback，恢复对应业务流程。

Thread-scoped request 会记录 `thread_id`，用于后续按 thread 查询、取消和 replay。非 thread-scoped request，例如 `account/chatgptAuthTokens/refresh`，不会绑定某个 thread。

### 3.2 resolved 通知

多数 thread-scoped pending interaction 在服务端收到客户端响应后，会发：

```json
{
  "method": "serverRequest/resolved",
  "params": {
    "threadId": "thread-1",
    "requestId": 42
  }
}
```

`serverRequest/resolved` 的用途是通知客户端：这个 pending request 已经完成或被服务端清理。它是 notification，不是 response。

服务端在 thread listener 的串行上下文里发送 `serverRequest/resolved`，目的是保证 resolved notification 与对应 request 在同一 thread 的事件顺序可控。

注意：

- `serverRequest/resolved.requestId` 是原始 JSON-RPC request 的 `id`。
- `serverRequest/resolved` 只携带 `threadId` 和 `requestId`。
- 客户端不能把 `serverRequest/resolved` 当作业务成功或失败结果；真正业务结果要看对应 request 的 response 处理以及后续 `item/completed`。

### 3.3 turn transition 清理

当 turn start、turn complete、turn interrupt 等状态变化使 pending request 不再有效时，服务端会取消 thread 上未完成的 pending server request。内部 error data 使用：

```json
{
  "reason": "turnTransition"
}
```

服务端业务 handler 通常把这种 error 识别为正常清理，并直接返回，不再提交业务结果。对客户端而言，后续会看到 `serverRequest/resolved`，表示 pending request 已被清除。

### 3.4 pending request replay

服务端会保存 thread-scoped pending requests。客户端 resume 一个正在运行的 thread 时，app-server 会把该 thread 当前仍 pending 的 requests 重新发给新订阅连接：

```text
handle_pending_thread_resume_request
  -> replay_requests_to_connection_for_thread
```

Replay 按 request id 排序。Replay 的 request 保留原始 `id`、`method` 和 `params`。客户端仍应使用同一个 `id` 响应。

### 3.5 request 与 conversation item 的关系

Pending interaction 本身不是 `ThreadItem`。但某些 request 会围绕 runtime item 发送：

- command approval 通常对应一个 `commandExecution` item。
- file change approval 通常对应一个 `fileChange` item。
- dynamic tool call 对应一个 `dynamicToolCall` item。

这些 item 的最终状态以 `item/completed` 或对应 final event 为准。Approval request 的 response 只是解锁或拒绝某个动作，不是最终执行结果。

## 4. `item/commandExecution/requestApproval`

用途：请求客户端审批一次命令执行。它也可表达网络访问审批、命令级额外权限审批、execpolicy amendment 和 network policy amendment。

### 4.1 触发来源

核心事件是 `EventMsg::ExecApprovalRequest`。app-server 将 core approval event 转成 v2 request。

常规命令审批时，服务端通常先发 `item/started`，创建或更新一个 `commandExecution` item，然后发 approval request。

网络-only approval 时，request 可能没有 `command`、`cwd`、`commandActions`，而是带 `networkApprovalContext`。

### 4.2 params

```ts
type CommandExecutionRequestApprovalParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  approvalId?: string | null;
  reason?: string | null;
  networkApprovalContext?: NetworkApprovalContext | null;
  command?: string | null;
  cwd?: AbsolutePathBuf | null;
  commandActions?: CommandAction[] | null;
  additionalPermissions?: AdditionalPermissionProfile | null;
  proposedExecpolicyAmendment?: ExecPolicyAmendment | null;
  proposedNetworkPolicyAmendments?: NetworkPolicyAmendment[] | null;
  availableDecisions?: CommandExecutionApprovalDecision[] | null;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `itemId` | 通常是命令 call id。用于关联 `commandExecution` item。 |
| `approvalId` | 可选 callback id。普通 shell / unified exec approval 为 null；zsh-exec-bridge subcommand approval 可能有独立 UUID。 |
| `reason` | 可选解释，例如请求网络访问或额外权限的原因。 |
| `networkApprovalContext` | 网络审批上下文。存在时表示这是 managed-network approval prompt。 |
| `command` | 展示用命令字符串。网络-only prompt 可为空。 |
| `cwd` | 命令工作目录。网络-only prompt 可为空。 |
| `commandActions` | best-effort parsed command actions，用于友好展示命令意图。 |
| `additionalPermissions` | experimental。该命令请求的额外 sandbox 权限。 |
| `proposedExecpolicyAmendment` | 可选持久 execpolicy amendment，让未来匹配命令不再提示。 |
| `proposedNetworkPolicyAmendments` | 可选 network policy amendment 列表，例如允许或拒绝 host。 |
| `availableDecisions` | experimental。服务端希望客户端展示的可选 decision 顺序。 |

`NetworkApprovalContext`：

```ts
type NetworkApprovalContext = {
  host: string;
  protocol: "http" | "https" | "socks5Tcp" | "socks5Udp";
};
```

`CommandAction`：

```ts
type CommandAction =
  | { type: "read"; command: string; name: string; path: AbsolutePathBuf }
  | { type: "listFiles"; command: string; path: string | null }
  | { type: "search"; command: string; query: string | null; path: string | null }
  | { type: "unknown"; command: string };
```

`ExecPolicyAmendment` 当前 wire type 是 string array：

```ts
type ExecPolicyAmendment = string[];
```

`NetworkPolicyAmendment`：

```ts
type NetworkPolicyAmendment = {
  host: string;
  action: "allow" | "deny";
};
```

### 4.3 response

```ts
type CommandExecutionRequestApprovalResponse = {
  decision: CommandExecutionApprovalDecision;
};
```

`CommandExecutionApprovalDecision`：

```ts
type CommandExecutionApprovalDecision =
  | "accept"
  | "acceptForSession"
  | { "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ExecPolicyAmendment } }
  | { "applyNetworkPolicyAmendment": { "network_policy_amendment": NetworkPolicyAmendment } }
  | "decline"
  | "cancel";
```

Decision 语义：

| decision | 原生语义 |
| --- | --- |
| `accept` | 批准本次命令。 |
| `acceptForSession` | 批准本次命令，并让同一个 session-scoped approval cache 内未来匹配请求不再提示。 |
| `acceptWithExecpolicyAmendment` | 批准本次命令，并应用 proposed execpolicy amendment。 |
| `applyNetworkPolicyAmendment` | 应用用户选择的 network policy rule。`allow` 通常继续；`deny` 会使 command item 进入 declined。 |
| `decline` | 拒绝本次命令，agent 继续 turn。 |
| `cancel` | 拒绝本次命令，并立即中断 turn。 |

响应示例：

```json
{
  "id": 42,
  "result": {
    "decision": "accept"
  }
}
```

```json
{
  "id": 42,
  "result": {
    "decision": {
      "acceptWithExecpolicyAmendment": {
        "execpolicy_amendment": ["npm test"]
      }
    }
  }
}
```

```json
{
  "id": 42,
  "result": {
    "decision": {
      "applyNetworkPolicyAmendment": {
        "network_policy_amendment": {
          "host": "example.com",
          "action": "allow"
        }
      }
    }
  }
}
```

### 4.4 错误和非法响应兜底

如果客户端返回的 `result` 不能反序列化为 `CommandExecutionRequestApprovalResponse`，服务端 fallback 为：

```json
{
  "decision": "decline"
}
```

如果客户端返回 JSON-RPC error：

- turn transition error：服务端视为正常清理，直接返回。
- 其他 error：服务端按 denied / failed 处理。

如果 approval 被拒绝、取消或失败，app-server 可能主动补一个 `item/completed`，把 `commandExecution` item 标为 `declined` 或 `failed`。如果批准，最终 item completion 通常来自后续命令执行结果。

### 4.5 subcommand approval

普通 shell / unified exec approval：

- `approvalId` 为 null。
- `itemId` 指向当前 command item。

zsh-exec-bridge subcommand approval：

- `approvalId` 是独立 opaque callback id。
- 多个 approval callback 可属于同一个父 `itemId`。
- 回给 core 的 `ExecApproval.id` 使用 `approvalId`；没有 `approvalId` 时使用 `itemId`。

## 5. `item/fileChange/requestApproval`

用途：请求客户端审批一次文件修改。

### 5.1 触发来源

核心事件是 `EventMsg::ApplyPatchApprovalRequest`。v2 API 中，app-server 会把 patch approval 映射为 `fileChange` item 和 `item/fileChange/requestApproval`。

由于 core 仍可能以 patch approval event 表达文件修改，app-server 当前会复用 `call_id` 作为 `fileChange` item id。

### 5.2 顺序

典型顺序：

1. `item/started`，item type 为 `fileChange`，包含 proposed changes，status 为 `inProgress`。
2. `item/fileChange/requestApproval` request。
3. 客户端返回 `{ decision }`。
4. `serverRequest/resolved`。
5. 后续 `item/completed`，status 为 `completed`、`failed` 或 `declined`。

### 5.3 params

```ts
type FileChangeRequestApprovalParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  reason?: string | null;
  grantRoot?: string | null;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `itemId` | file change item id。当前通常来自 patch `call_id`。 |
| `reason` | 可选解释，例如请求额外写权限。 |
| `grantRoot` | unstable。agent 请求在 session 期间允许写入的 root。 |

### 5.4 response

```ts
type FileChangeRequestApprovalResponse = {
  decision: FileChangeApprovalDecision;
};
```

`FileChangeApprovalDecision`：

```ts
type FileChangeApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "decline"
  | "cancel";
```

Decision 语义：

| decision | 原生语义 |
| --- | --- |
| `accept` | 批准本次文件修改。 |
| `acceptForSession` | 批准本次文件修改，并允许同 session 中未来对同类文件变化复用 approval。 |
| `decline` | 拒绝本次修改，agent 继续 turn。 |
| `cancel` | 拒绝本次修改，并立即中断 turn。 |

响应示例：

```json
{
  "id": 43,
  "result": {
    "decision": "accept"
  }
}
```

### 5.5 错误和非法响应兜底

如果客户端返回的 `result` 不能反序列化，服务端 fallback 为：

```json
{
  "decision": "decline"
}
```

如果客户端返回 JSON-RPC error：

- turn transition error：服务端视为正常清理，直接返回。
- 其他 error：服务端按 denied / failed 处理，并可能把 `fileChange` item 标为 `failed`。

Decline 和 cancel 会让服务端补发 declined completion。Accept 通常等待实际 patch apply end event 产生最终结果。

## 6. `item/permissions/requestApproval`

用途：内置 `request_permissions` tool 请求用户授予额外权限。该 request 与 command execution approval 里的 `additionalPermissions` payload 形状相近，但它是独立工具请求。

### 6.1 触发来源

核心事件是 `EventMsg::RequestPermissions`。app-server 读取 request 中的 `cwd`；如果 request 未提供 `cwd`，使用当前 conversation config 的 `cwd`。

如果 session approval policy 使用 granular 并禁用了 `request_permissions`，core 可能自动拒绝此工具调用，不发 `item/permissions/requestApproval`。

### 6.2 params

```ts
type PermissionsRequestApprovalParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  cwd: AbsolutePathBuf;
  reason: string | null;
  permissions: RequestPermissionProfile;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `itemId` | permission request call id。 |
| `cwd` | 用于解析 project-root permissions 和相对 deny globs 的工作目录。 |
| `reason` | 请求权限的原因。 |
| `permissions` | 请求的权限 profile。客户端只能授予其 subset。 |

`RequestPermissionProfile`：

```ts
type RequestPermissionProfile = {
  network: AdditionalNetworkPermissions | null;
  fileSystem: AdditionalFileSystemPermissions | null;
};
```

`AdditionalNetworkPermissions`：

```ts
type AdditionalNetworkPermissions = {
  enabled: boolean | null;
};
```

`AdditionalFileSystemPermissions`：

```ts
type AdditionalFileSystemPermissions = {
  read: AbsolutePathBuf[] | null;
  write: AbsolutePathBuf[] | null;
  globScanMaxDepth?: number;
  entries?: FileSystemSandboxEntry[];
};
```

`read` 和 `write` 是 legacy fields，协议注释说明未来会被 `entries` 替代。

`FileSystemSandboxEntry`：

```ts
type FileSystemSandboxEntry = {
  path: FileSystemPath;
  access: "read" | "write" | "none";
};
```

`FileSystemPath`：

```ts
type FileSystemPath =
  | { type: "path"; path: AbsolutePathBuf }
  | { type: "glob_pattern"; pattern: string }
  | { type: "special"; value: FileSystemSpecialPath };
```

示例 request：

```json
{
  "id": 61,
  "method": "item/permissions/requestApproval",
  "params": {
    "threadId": "thr_123",
    "turnId": "turn_123",
    "itemId": "call_123",
    "cwd": "/Users/me/project",
    "reason": "Select a workspace root",
    "permissions": {
      "fileSystem": {
        "read": null,
        "write": ["/Users/me/project"],
        "entries": [
          {
            "path": {
              "type": "path",
              "path": "/Users/me/project"
            },
            "access": "write"
          }
        ]
      },
      "network": null
    }
  }
}
```

### 6.3 response

```ts
type PermissionsRequestApprovalResponse = {
  permissions: GrantedPermissionProfile;
  scope: "turn" | "session";
  strictAutoReview?: boolean;
};
```

`GrantedPermissionProfile`：

```ts
type GrantedPermissionProfile = {
  network?: AdditionalNetworkPermissions;
  fileSystem?: AdditionalFileSystemPermissions;
};
```

响应示例：

```json
{
  "id": 61,
  "result": {
    "scope": "session",
    "permissions": {
      "fileSystem": {
        "write": ["/Users/me/project"]
      }
    }
  }
}
```

### 6.4 授权 subset 语义

服务端只接受原始请求的 subset：

- response 中遗漏的权限视为 denied。
- response 中不属于原 request 的权限会被忽略。
- 服务端会对 requested permissions 和 granted permissions 做 intersection。
- 如果最终 grant 为空，则相当于没有授予额外权限。

`scope`：

| 值 | 说明 |
| --- | --- |
| `turn` | 只对当前 turn 有效。默认值。 |
| `session` | 对同 session 的后续 turn 也有效。 |

`strictAutoReview`：

- 表示在同一 turn 内，后续命令即使正常可 sandboxed execution，也要先经过 review。
- 只支持 `scope: "turn"`。
- 如果客户端返回 `scope: "session"` 且 `strictAutoReview: true`，服务端记录错误并返回空权限、turn scope、`strict_auto_review: false`。

### 6.5 错误和非法响应兜底

如果客户端返回 JSON-RPC error 或 response 无法反序列化，服务端 fallback 为：

```json
{
  "permissions": {},
  "scope": "turn",
  "strictAutoReview": false
}
```

turn transition error 仍视为正常清理，服务端不提交 permission response。

## 7. `item/tool/requestUserInput`

用途：工具向用户询问一个或多个问题。该 API 标注为 experimental。

### 7.1 触发来源

核心事件是 `EventMsg::RequestUserInput`。app-server 把 core questions 转为 `ToolRequestUserInputQuestion[]`，发送 `item/tool/requestUserInput`。

### 7.2 params

```ts
type ToolRequestUserInputParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  questions: ToolRequestUserInputQuestion[];
};
```

`ToolRequestUserInputQuestion`：

```ts
type ToolRequestUserInputQuestion = {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: ToolRequestUserInputOption[] | null;
};
```

`ToolRequestUserInputOption`：

```ts
type ToolRequestUserInputOption = {
  label: string;
  description: string;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `itemId` | request user input 的 call id。 |
| `questions` | 一次请求可包含多个问题。 |
| `questions[].id` | 问题 id。response 的 answers map 使用这个 id。 |
| `questions[].header` | 问题短标题。 |
| `questions[].question` | 问题正文。 |
| `questions[].isOther` | 是否允许 / 表示 other answer。 |
| `questions[].isSecret` | 输入是否为 secret。 |
| `questions[].options` | 可选选项列表；为 null 时通常表示自由输入。 |

### 7.3 response

```ts
type ToolRequestUserInputResponse = {
  answers: Record<string, ToolRequestUserInputAnswer>;
};
```

`ToolRequestUserInputAnswer`：

```ts
type ToolRequestUserInputAnswer = {
  answers: string[];
};
```

响应示例：

```json
{
  "id": 70,
  "result": {
    "answers": {
      "account": {
        "answers": ["work"]
      },
      "confirm": {
        "answers": ["Yes"]
      }
    }
  }
}
```

### 7.4 错误和非法响应兜底

如果客户端返回 JSON-RPC error、channel 关闭或 response 无法反序列化，服务端 fallback 为：

```json
{
  "answers": {}
}
```

turn transition error 视为正常清理，不提交 fallback answer。

收到有效 response 后，服务端提交：

```text
Op::UserInputAnswer {
  id: event_turn_id,
  response
}
```

注意这里提交给 core 的 `id` 是当前 event turn id，不是 question id；question id 位于 response 的 answers map 内部。

## 8. `mcpServer/elicitation/request`

用途：MCP server 发起 elicitation，请客户端让用户完成结构化输入或 URL 授权。

### 8.1 触发来源

核心事件是 `EventMsg::ElicitationRequest`。app-server 把 core MCP elicitation request 转成 typed v2 request。

如果 core request 中没有 `turn_id`，app-server 会尝试从当前 active turn snapshot 补一个 `turnId`。因此 wire 上：

- `turnId` 可能是 string。
- `turnId` 也可能是 null。
- `turnId` 是 app-server correlation，不是 MCP elicitation 自身 identity 的一部分。

如果 app-server 无法解析 typed MCP elicitation schema，会直接向 core 提交 cancel，不向客户端发送 request。

### 8.2 params

```ts
type McpServerElicitationRequestParams = {
  threadId: string;
  turnId: string | null;
  serverName: string;
} & (
  | {
      mode: "form";
      _meta: JsonValue | null;
      message: string;
      requestedSchema: McpElicitationSchema;
    }
  | {
      mode: "url";
      _meta: JsonValue | null;
      message: string;
      url: string;
      elicitationId: string;
    }
);
```

公共字段：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | app-server best-effort correlation。可为 null。 |
| `serverName` | 发起 elicitation 的 MCP server 名称。 |
| `mode` | `form` 或 `url`。 |
| `_meta` | MCP metadata。 |
| `message` | MCP server 给用户的提示文本。 |

### 8.3 form mode

Form mode 请求结构化输入：

```json
{
  "id": 80,
  "method": "mcpServer/elicitation/request",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "serverName": "github",
    "mode": "form",
    "_meta": null,
    "message": "Choose repository",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "title": "Repository"
        }
      },
      "required": ["repo"]
    }
  }
}
```

`McpElicitationSchema` 对齐 MCP 2025-11-25 `ElicitRequestFormParams.requestedSchema`：

```ts
type McpElicitationSchema = {
  "$schema"?: string;
  type: "object";
  properties: Record<string, McpElicitationPrimitiveSchema>;
  required?: string[];
};
```

支持的 primitive schema：

| schema | 关键字段 |
| --- | --- |
| string | `type: "string"`, `title?`, `description?`, `minLength?`, `maxLength?`, `format?`, `default?` |
| number / integer | `type: "number"` 或 `"integer"`, `minimum?`, `maximum?`, `default?` |
| boolean | `type: "boolean"`, `default?` |
| enum single-select | `type: "string"` 加 `enum`，或 `oneOf` const options |
| enum multi-select | `type: "array"` 加 `items.enum` 或 `items.anyOf` const options |

String format wire 值：

| format | 说明 |
| --- | --- |
| `email` | email string |
| `uri` | URI string |
| `date` | date string |
| `date-time` | date-time string |

MCP tool approval elicitation 的 form `_meta` 可能包含：

- `codex_approval_kind: "mcp_tool_call"`
- `persist: "session"`
- `persist: "always"`
- `persist: ["session", "always"]`

这些 metadata 表示客户端可提供 session-scoped 或 persistent approval choice。具体业务语义由 MCP approval flow 消费。

### 8.4 url mode

URL mode 请求用户访问 URL：

```json
{
  "id": 81,
  "method": "mcpServer/elicitation/request",
  "params": {
    "threadId": "thread-1",
    "turnId": null,
    "serverName": "github",
    "mode": "url",
    "_meta": null,
    "message": "Authorize GitHub",
    "url": "https://github.com/login/oauth/authorize?...",
    "elicitationId": "elicitation-123"
  }
}
```

`elicitationId` 是 URL elicitation 的标识，由 MCP request 提供。

### 8.5 response

```ts
type McpServerElicitationRequestResponse = {
  action: "accept" | "decline" | "cancel";
  content: JsonValue | null;
  _meta: JsonValue | null;
};
```

Action 语义：

| action | 说明 |
| --- | --- |
| `accept` | 用户接受，并可携带结构化 `content`。 |
| `decline` | 用户拒绝，不中断整体 turn 的强语义由 core 决定。通常 `content` 为 null。 |
| `cancel` | 用户取消。通常 `content` 为 null。 |

Form accept 示例：

```json
{
  "id": 80,
  "result": {
    "action": "accept",
    "content": {
      "repo": "owner/name"
    },
    "_meta": null
  }
}
```

Decline 示例：

```json
{
  "id": 80,
  "result": {
    "action": "decline",
    "content": null,
    "_meta": null
  }
}
```

### 8.6 错误和非法响应兜底

服务端通过 `mcp_server_elicitation_response_from_client_result` 处理响应：

| 情况 | fallback |
| --- | --- |
| response 反序列化失败 | `{ action: "decline", content: null, _meta: null }` |
| 客户端 JSON-RPC error | `{ action: "decline", content: null, _meta: null }` |
| oneshot receiver 关闭 | `{ action: "decline", content: null, _meta: null }` |
| turn transition error | `{ action: "cancel", content: null, _meta: null }` |

然后服务端提交：

```text
Op::ResolveElicitation {
  server_name,
  request_id,
  decision,
  content,
  meta
}
```

这里的 `request_id` 是 MCP request id，不是 app-server JSON-RPC request id。

## 9. `item/tool/call`

用途：dynamic tool call。服务端请求客户端执行一个由客户端提供的 tool，并返回可作为模型输入的内容。该 API 是 experimental。

### 9.1 启用条件

Dynamic tools 通过 `thread/start` 的 `dynamicTools` 注册，相关 API 标注为 experimental。客户端需要在 `initialize.params.capabilities.experimentalApi` 中开启 experimental API。

### 9.2 顺序

当 dynamic tool 被调用时，服务端的典型顺序：

1. `item/started`，item type 为 `dynamicToolCall`，status 为 `inProgress`，包含 `tool` 和 `arguments`。
2. `item/tool/call` request。
3. 客户端返回 `{ contentItems, success }`。
4. core 处理 `Op::DynamicToolResponse`。
5. `item/completed`，item type 为 `dynamicToolCall`，包含最终 status、`contentItems`、`success`。

### 9.3 params

```ts
type DynamicToolCallParams = {
  threadId: string;
  turnId: string;
  callId: string;
  namespace: string | null;
  tool: string;
  arguments: JsonValue;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `threadId` | 所属 thread。 |
| `turnId` | 所属 turn。 |
| `callId` | dynamic tool call id。 |
| `namespace` | tool namespace，可为 null。 |
| `tool` | tool 名称。 |
| `arguments` | tool 参数，任意 JSON value。 |

示例：

```json
{
  "id": 60,
  "method": "item/tool/call",
  "params": {
    "threadId": "thr_123",
    "turnId": "turn_123",
    "callId": "call_123",
    "namespace": null,
    "tool": "lookup_ticket",
    "arguments": {
      "id": "ABC-123"
    }
  }
}
```

### 9.4 response

```ts
type DynamicToolCallResponse = {
  contentItems: DynamicToolCallOutputContentItem[];
  success: boolean;
};
```

`DynamicToolCallOutputContentItem`：

```ts
type DynamicToolCallOutputContentItem =
  | { type: "inputText"; text: string }
  | { type: "inputImage"; imageUrl: string };
```

响应示例：

```json
{
  "id": 60,
  "result": {
    "contentItems": [
      {
        "type": "inputText",
        "text": "Ticket ABC-123 is open."
      },
      {
        "type": "inputImage",
        "imageUrl": "data:image/png;base64,AAA"
      }
    ],
    "success": true
  }
}
```

### 9.5 错误和非法响应兜底

`dynamic_tools::on_call_response` 的 fallback：

| 情况 | fallback |
| --- | --- |
| response 反序列化失败 | `contentItems: [{ type: "inputText", text: "dynamic tool response was invalid" }]`, `success: false` |
| 客户端 JSON-RPC error | `contentItems: [{ type: "inputText", text: "dynamic tool request failed" }]`, `success: false` |
| oneshot receiver 关闭 | 同上 |
| turn transition error | 直接返回，不提交 fallback response |

与 approval / elicitation 不同，`item/tool/call` 的 response 被转换为 core dynamic tool response，再由 core 产生最终 `dynamicToolCall` item completion。

## 10. `account/chatgptAuthTokens/refresh`

用途：当 app-server 使用外部 ChatGPT auth，并且后端请求收到 unauthorized 时，服务端请求客户端刷新 ChatGPT auth tokens。

### 10.1 触发来源

`ExternalAuthRefreshBridge` 实现 `ExternalAuth::refresh`。当 core 需要刷新 auth 时，bridge 发送 `account/chatgptAuthTokens/refresh`。

该 request 不是 thread-scoped request。它通过全局 outgoing sender 发送，pending callback 不记录 thread id。

### 10.2 timeout

auth refresh 有固定 timeout：

```text
EXTERNAL_AUTH_REFRESH_TIMEOUT = 10s
```

如果 10 秒内没有收到客户端 response，服务端会 cancel request，并返回 IO error：

```text
auth refresh request timed out after 10s
```

### 10.3 params

```ts
type ChatgptAuthTokensRefreshParams = {
  reason: ChatgptAuthTokensRefreshReason;
  previousAccountId?: string | null;
};
```

`ChatgptAuthTokensRefreshReason`：

```ts
type ChatgptAuthTokensRefreshReason = "unauthorized";
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `reason` | 刷新原因。目前只有 `unauthorized`。 |
| `previousAccountId` | Codex 之前使用的 workspace/account id。可能为 null。 |

示例：

```json
{
  "id": 90,
  "method": "account/chatgptAuthTokens/refresh",
  "params": {
    "reason": "unauthorized",
    "previousAccountId": "workspace_123"
  }
}
```

### 10.4 response

```ts
type ChatgptAuthTokensRefreshResponse = {
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType: string | null;
};
```

响应示例：

```json
{
  "id": 90,
  "result": {
    "accessToken": "eyJ...",
    "chatgptAccountId": "workspace_123",
    "chatgptPlanType": "plus"
  }
}
```

### 10.5 错误和非法响应

如果客户端返回 JSON-RPC error，服务端把 error code/message 包装成 IO error。

如果 response 不能反序列化为 `ChatgptAuthTokensRefreshResponse`，服务端返回反序列化错误。

该 request 没有 thread-level `serverRequest/resolved` notification。

## 11. v1 deprecated `applyPatchApproval`

用途：legacy APIs `SendUserTurn` / `SendUserMessage` 下的 patch approval。新 `turn/start` flow 使用 `item/fileChange/requestApproval`。

### 11.1 params

```ts
type ApplyPatchApprovalParams = {
  conversationId: ThreadId;
  callId: string;
  fileChanges: Record<string, FileChange>;
  reason: string | null;
  grantRoot: string | null;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `conversationId` | legacy name。语义等同 thread id。 |
| `callId` | patch apply call id。 |
| `fileChanges` | path 到 `FileChange` 的 map。 |
| `reason` | 可选解释。 |
| `grantRoot` | 可选 session write root。 |

### 11.2 response

```ts
type ApplyPatchApprovalResponse = {
  decision: ReviewDecision;
};
```

`ReviewDecision`：

```ts
type ReviewDecision =
  | "approved"
  | { "approved_execpolicy_amendment": { "proposed_execpolicy_amendment": ExecPolicyAmendment } }
  | "approved_for_session"
  | { "network_policy_amendment": { "network_policy_amendment": NetworkPolicyAmendment } }
  | "denied"
  | "timed_out"
  | "abort";
```

Patch approval 实际通常使用：

- `approved`
- `approved_for_session`
- `denied`
- `abort`

`timed_out` 是 core review decision 的通用 variant。

## 12. v1 deprecated `execCommandApproval`

用途：legacy APIs `SendUserTurn` / `SendUserMessage` 下的 command approval。新 `turn/start` flow 使用 `item/commandExecution/requestApproval`。

### 12.1 params

```ts
type ExecCommandApprovalParams = {
  conversationId: ThreadId;
  callId: string;
  approvalId: string | null;
  command: string[];
  cwd: string;
  reason: string | null;
  parsedCmd: ParsedCommand[];
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `conversationId` | legacy name。语义等同 thread id。 |
| `callId` | command call id。 |
| `approvalId` | 可选 callback id。 |
| `command` | argv 数组，不是 joined string。 |
| `cwd` | 工作目录。 |
| `reason` | 可选解释。 |
| `parsedCmd` | best-effort parsed command。 |

### 12.2 response

```ts
type ExecCommandApprovalResponse = {
  decision: ReviewDecision;
};
```

`ReviewDecision` 与 `applyPatchApproval` 相同。

Legacy approval 的 response value 使用 snake_case variant，例如：

```json
{
  "id": 12,
  "result": {
    "decision": "approved"
  }
}
```

```json
{
  "id": 12,
  "result": {
    "decision": "approved_for_session"
  }
}
```

## 13. common permission payload

`item/commandExecution/requestApproval.additionalPermissions`、`item/permissions/requestApproval.permissions` 和 `item/permissions/requestApproval` response 都复用类似的 permission profile shape。

### 13.1 network

```json
{
  "network": {
    "enabled": true
  }
}
```

`enabled: true` 表示请求或授予 network access。`enabled: false` 或 null 不是“请求启用网络”的语义。

### 13.2 fileSystem legacy read/write

```json
{
  "fileSystem": {
    "read": ["/repo"],
    "write": ["/repo/output"]
  }
}
```

这些是 legacy fields。协议仍导出它们，但注释说明未来会改用 `entries`。

### 13.3 fileSystem entries

```json
{
  "fileSystem": {
    "entries": [
      {
        "path": {
          "type": "path",
          "path": "/repo/output"
        },
        "access": "write"
      },
      {
        "path": {
          "type": "glob_pattern",
          "pattern": "docs/**/*.md"
        },
        "access": "read"
      }
    ]
  }
}
```

`FileSystemSpecialPath` 支持：

| kind | 说明 |
| --- | --- |
| `root` | filesystem root。 |
| `minimal` | minimal filesystem view。 |
| `project_roots` | project roots，可带 `subpath`。 |
| `tmpdir` | platform tmpdir。 |
| `slash_tmp` | `/tmp`。 |
| `unknown` | 未知 special path，带原始 path 和可选 subpath。 |

## 14. 与 notifications 的关系

### 14.1 `serverRequest/resolved`

相关 request：

| request | 是否通常发 `serverRequest/resolved` |
| --- | --- |
| `item/commandExecution/requestApproval` | 是 |
| `item/fileChange/requestApproval` | 是 |
| `item/tool/requestUserInput` | 是 |
| `mcpServer/elicitation/request` | 是 |
| `item/permissions/requestApproval` | 是 |
| `item/tool/call` | 发送 request 后由 dynamic tool response flow 处理；当前 handler 不显式走同一段 resolved helper |
| `account/chatgptAuthTokens/refresh` | 否，非 thread-scoped |
| `applyPatchApproval` | legacy path，取决于 legacy sender flow |
| `execCommandApproval` | legacy path，取决于 legacy sender flow |

`serverRequest/resolved` 不携带 request method，也不携带业务结果。

### 14.2 `item/started` 和 `item/completed`

`ServerRequest` 不等于 item。常见关系：

| request | 相关 item |
| --- | --- |
| `item/commandExecution/requestApproval` | `commandExecution` |
| `item/fileChange/requestApproval` | `fileChange` |
| `item/tool/call` | `dynamicToolCall` |
| `item/tool/requestUserInput` | request 本身不保证有独立 visible item；`itemId` 是 tool call id。 |
| `mcpServer/elicitation/request` | 当前协议 TODO：当 core 能关联 elicitation 与 MCP tool call 时，未来可能暴露 associated item id；当前没有。 |
| `item/permissions/requestApproval` | `itemId` 是 permission request call id。 |

客户端要以后续 item final event 为执行结果权威，不要把 approval response 当作最终 tool/command/file result。

## 15. capabilities 和 experimental 字段

`initialize.params.capabilities.experimentalApi` 会影响 experimental API 和字段。

明确标注 experimental 的内容：

| API 或字段 | 说明 |
| --- | --- |
| `item/tool/requestUserInput` | request user input flow。 |
| `item/tool/call` | dynamic tool call flow。 |
| `item/commandExecution/requestApproval.additionalPermissions` | command-level additional permissions。 |
| `item/commandExecution/requestApproval.availableDecisions` | 服务端提供的 decision 列表。 |

app-server 对不支持 experimental API 的连接会 strip 某些 experimental fields，例如 `additionalPermissions`。协议层也会拒绝未开启 capability 的 experimental methods。

客户端在实现时应以实际收到的 payload 为准：

- `availableDecisions` 不一定存在。
- `additionalPermissions` 不一定存在。
- command approval 可只有 `networkApprovalContext`，没有 `command`。
- MCP elicitation `turnId` 可为 null。

## 16. 错误处理汇总

| request | 非 turn-transition JSON-RPC error | invalid result fallback |
| --- | --- | --- |
| `item/commandExecution/requestApproval` | denied / failed | `decision: "decline"` |
| `item/fileChange/requestApproval` | denied / failed | `decision: "decline"` |
| `item/permissions/requestApproval` | empty permissions, `scope: "turn"` | empty permissions, `scope: "turn"` |
| `item/tool/requestUserInput` | empty answers | empty answers |
| `mcpServer/elicitation/request` | `action: "decline"` | `action: "decline"` |
| `item/tool/call` | failed text content item | failed text content item |
| `account/chatgptAuthTokens/refresh` | IO error | deserialize error |

Turn transition error 是特殊清理信号：

```json
{
  "reason": "turnTransition"
}
```

多数 thread-scoped handlers 对它的处理是直接返回，不提交 fallback result。

## 17. 实现注意事项

这些是原生协议事实，不是 UI 设计建议：

1. `ServerRequest.id` 是响应 correlation 的唯一依据。
2. `method` 决定 params 和 result schema。
3. `threadId`、`turnId`、`itemId` 不是所有 request 都有。
4. v1 deprecated APIs 使用 `conversationId`，v2 APIs 使用 `threadId`。
5. `mcpServer/elicitation/request.turnId` 是 nullable。
6. `account/chatgptAuthTokens/refresh` 是 global auth request，没有 thread-level resolved notification。
7. `serverRequest/resolved` 表示 request 被 resolved 或 cleared，不表示用户批准。
8. 同一个 thread resume 时，服务端可能 replay 仍 pending 的 request。
9. 对 command 和 file approvals，最终 item 状态以 `item/completed` 为准。
10. 对 permissions request，服务端会 intersect requested 和 granted permissions。
11. 对 command approval，应优先尊重 `availableDecisions`，但该字段可能不存在。
12. 对 command approval，`approvalId` 存在时它才是提交给 core 的 approval callback id；否则使用 `itemId`。

## 18. 最小 wire examples

### 18.1 command approval

```json
{
  "id": 1,
  "method": "item/commandExecution/requestApproval",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "itemId": "call-1",
    "approvalId": null,
    "reason": null,
    "command": "npm test",
    "cwd": "/repo",
    "commandActions": [
      {
        "type": "unknown",
        "command": "npm test"
      }
    ],
    "availableDecisions": ["accept", "decline", "cancel"]
  }
}
```

```json
{
  "id": 1,
  "result": {
    "decision": "accept"
  }
}
```

### 18.2 file change approval

```json
{
  "id": 2,
  "method": "item/fileChange/requestApproval",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "itemId": "patch-1",
    "reason": "Need write access",
    "grantRoot": "/repo"
  }
}
```

```json
{
  "id": 2,
  "result": {
    "decision": "acceptForSession"
  }
}
```

### 18.3 request user input

```json
{
  "id": 3,
  "method": "item/tool/requestUserInput",
  "params": {
    "threadId": "thread-1",
    "turnId": "turn-1",
    "itemId": "call-2",
    "questions": [
      {
        "id": "env",
        "header": "Environment",
        "question": "Which environment should be used?",
        "isOther": false,
        "isSecret": false,
        "options": [
          {
            "label": "staging",
            "description": "Use staging."
          },
          {
            "label": "production",
            "description": "Use production."
          }
        ]
      }
    ]
  }
}
```

```json
{
  "id": 3,
  "result": {
    "answers": {
      "env": {
        "answers": ["staging"]
      }
    }
  }
}
```

### 18.4 MCP elicitation

```json
{
  "id": 4,
  "method": "mcpServer/elicitation/request",
  "params": {
    "threadId": "thread-1",
    "turnId": null,
    "serverName": "github",
    "mode": "url",
    "_meta": null,
    "message": "Authorize GitHub",
    "url": "https://github.com/login/oauth/authorize",
    "elicitationId": "elicitation-123"
  }
}
```

```json
{
  "id": 4,
  "result": {
    "action": "accept",
    "content": null,
    "_meta": null
  }
}
```

### 18.5 server request resolved

```json
{
  "method": "serverRequest/resolved",
  "params": {
    "threadId": "thread-1",
    "requestId": 4
  }
}
```

