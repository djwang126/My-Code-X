# Codex Conversation Interface

本文解释 Codex app-server 中和 thread conversation 相关的接口形态、参数语义和使用方式。

本文可以为 feature 如何使用接口提供建议；具体产品能力、界面呈现、交互状态和 domain model 由对应 feature 文档定义。

## Source

本文基于本机相邻仓库 `../codex` 的 app-server 源码确认：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`

## 接口总表

客户端可能发送给 Codex 的接口：

- `initialize`
- `initialized`
- `thread/resume`
- `turn/start`
- `turn/steer`
- `turn/interrupt`
- `thread/unsubscribe`

Codex 可能发送给客户端的信息：

- 上述 request 的 success response。
- 上述 request 的 JSON-RPC error response。
- 当前 thread 相关的 server notification。
- 当前 thread 相关的 server request。

## 通用填写原则

- 参数名使用 Codex wire protocol 的 camelCase 名称。
- 只发送为了当前操作必须表达的参数，未明确覆盖的 runtime 配置不发送。
- `threadId` 来自目标 Codex `Thread.id`。
- `turnId` 来自目标 active turn 或 notification payload。
- `item.id` / `itemId` 用于合并 item lifecycle、delta、progress 和最终 item。
- `request id` 用于关联 action response 或 JSON-RPC error response。
- `method` 和 `ThreadItem.type` 是类型判断来源，不从正文文本猜测类型。
- My-Code-X 初始化 app-server 时启用 `experimentalApi: true`，因为当前实现会使用 experimental fields，例如 `persistExtendedHistory`，并且需要兼容 Codex 后续实验字段。
- 如需接收本文列出的完整 notification，`optOutNotificationMethods` 不填写或填写空数组。

## 连接初始化

### `initialize`

用途：

- 初始化 app-server 连接。
- 在它成功前不发送其他 request。

Params：

| 参数 | 填写 |
| --- | --- |
| `clientInfo.name` | 暂定为 `my-code-x`。 |
| `clientInfo.title` | 暂定为 `My-Code-X`。 |
| `clientInfo.version` | 暂定为0.1.0。 |
| `capabilities.experimentalApi` | `true`。 |
| `capabilities.optOutNotificationMethods` | 不填写或 `[]`。 |

Response：

- `userAgent`
- `codexHome`
- `platformFamily`
- `platformOs`

### `initialized`

用途：

- `initialize` success response 后发送，表示客户端已完成初始化。

Params：

- 无。

## 恢复或订阅 Thread

### `thread/resume`

用途：

- 打开目标已有 Codex `Thread`。
- 订阅该 thread 后续 live events。
- 使后续 request 可以在该 thread 上发送 turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。目标 `Thread.id`。 |
| `persistExtendedHistory` | `true`。让本次及后续会话尽量持久化更完整的 history。需要 `experimentalApi: true`。 |
| `cwd` | 默认不传。只有用户明确要求用当前 workspace 覆盖 thread 工作目录时才传。 |
| `model` | 默认不传。只有调用方明确选择模型覆盖时传。 |
| `modelProvider` | 默认不传。只有用户明确选择 provider 覆盖时传。 |
| `serviceTier` | 默认不传。只有用户明确选择 service tier 覆盖时传；如果要显式恢复默认值，按 Codex double-option 语义传 `null`。 |
| `approvalPolicy` | 默认不传。只有用户明确覆盖审批策略时传。 |
| `approvalsReviewer` | 默认不传。只有用户明确覆盖 reviewer 时传。 |
| `sandbox` | 默认不传。只有用户明确覆盖 legacy sandbox mode 时传。 |
| `permissions` | 默认不传。只有用户明确选择 permission profile 时传；不能和 `sandbox` 同时传。 |
| `config` | 默认不传。只有需要注入明确 runtime config 覆盖时传。 |
| `baseInstructions` | 默认不传。 |
| `developerInstructions` | 默认不传；若传 `null`，含义必须按 Codex 对应字段语义处理，不能当作空字符串。 |
| `personality` | 默认不传。 |
| `history` | 通常不传；只有调用方需要按 Codex 语义提供 history 时传。 |
| `path` | 通常不传；已有 `threadId` 时优先使用 `threadId`。 |

Response：

- `thread`
- `model`
- `modelProvider`
- `serviceTier`
- `cwd`
- `instructionSources`
- `approvalPolicy`
- `approvalsReviewer`
- `sandbox`
- `permissionProfile`
- `activePermissionProfile`
- `reasoningEffort`

Note：

- `thread/resume` 返回的历史通常是已经形成的 `ThreadItem`；live event 中出现过的中间态不一定存在于恢复结果中。

## Turn Requests

### `turn/start`

用途：

- 向目标 thread 发送用户输入并开始新 turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。目标 `Thread.id`。 |
| `input` | 必填。原始用户输入转换成 `UserInput[]`，不能删改用户文本。 |
| `cwd` | 默认不传。只有用户明确覆盖本 turn 及后续 turn 的 cwd 时传。 |
| `approvalPolicy` | 默认不传。只有用户明确覆盖审批策略时传。 |
| `approvalsReviewer` | 默认不传。只有用户明确覆盖 reviewer 时传。 |
| `sandboxPolicy` | 默认不传。只有用户明确覆盖 sandbox policy 时传。 |
| `permissions` | 默认不传。只有用户明确选择 permission profile 时传；不能和 `sandboxPolicy` 同时传。 |
| `model` | 默认不传。只有用户明确覆盖模型时传。 |
| `serviceTier` | 默认不传。只有用户明确覆盖 service tier 时传。 |
| `effort` | 默认不传。只有用户明确覆盖 reasoning effort 时传。 |
| `summary` | 默认不传。只有用户明确覆盖 reasoning summary 时传。 |
| `personality` | 默认不传。 |
| `outputSchema` | 默认不传。只有调用方需要结构化输出时传。 |
| `collaborationMode` | 默认不传。只有用户明确选择 collaboration mode 时传；需要 `experimentalApi: true`。 |
| `responsesapiClientMetadata` | 默认不传。 |
| `environments` | 默认不传。只有用户明确选择 turn environment 时传。 |

`input` 填写规则：

- 普通文本输入使用 `{ "type": "text", "text": <draft>, "textElements": [] }`。

Response：

- `turn`

Note：

- success response 表示请求被接受。

### `turn/steer`

用途：

- 向目标 thread 的 active regular turn 追加补充输入。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。目标 `Thread.id`。 |
| `expectedTurnId` | 必填。当前 active regular turn id。用于防止追加到错误 turn。 |
| `input` | 必填。和 `turn/start.input` 同样的 `UserInput[]`。 |
| `responsesapiClientMetadata` | 默认不传。 |

Response：

- `turnId`

Note：

- success response 表示补充输入被接受。
- 它不会产生新的 `turn/started`。

### `turn/interrupt`

用途：

- 请求取消目标 thread 的 active turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。目标 `Thread.id`。 |
| `turnId` | 必填。目标 active turn id；没有可靠 `turnId` 时无法构造有效 request。 |

Response：

- `{}`。

Note：

- success response 表示 cancellation request 被接受。
- 真正中断完成以后，会收到 `turn/completed`，其中 `turn.status = interrupted`。

### `thread/unsubscribe`

用途：

- 取消当前连接对旧 thread 的 live events 订阅。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。要取消订阅的旧 `Thread.id`。 |

Response：

- `status`：`notLoaded`、`notSubscribed` 或 `unsubscribed`。


## Codex 数据结构

### `Thread`

常见相关字段：

- `id`
- `preview`
- `name`
- `cwd`
- `status`
- `createdAt`
- `updatedAt`
- `turns`

Semantic Notes：

- `name` 和 `preview` 都可以作为 thread label 的来源，具体选择由 feature 决定。
- `cwd` 表示 thread 关联的工作目录。
- `status` 表示 thread 当前生命周期状态。
- `turns` 来自 `thread/resume` response，可作为历史 turn 数据来源。

### `ThreadStatus`

需要处理的状态：

- `notLoaded`
- `idle`
- `systemError`
- `active`

`active.activeFlags` 需要识别：

- `waitingOnApproval`
- `waitingOnUserInput`

Semantic Notes：

- `idle` 表示 thread 当前没有 active turn，客户端通常可以发起 `turn/start`。
- `active` 表示 thread 存在 active turn，客户端可结合 active turn id 构造 `turn/steer` 或 `turn/interrupt`。
- `waitingOnApproval` / `waitingOnUserInput` 表示 active turn 正在等待客户端侧参与。
- `systemError` 表示 thread 处于系统错误状态，客户端需要避免假设普通 turn request 仍可成功。

### `Turn`

常见相关字段：

- `id`
- `items`
- `status`
- `error`
- `startedAt`
- `completedAt`
- `durationMs`

Semantic Notes：

- `items` 用于历史恢复。
- live `turn/started` 和 `turn/completed` 中的 `items` 不作为完整 item 列表依赖。
- `status = failed` 时读取 `error` 作为失败信息。

### `ThreadItem`

普通对话相关 item：

- `userMessage`
  - 字段：`id`、`content`
  - 表示用户输入原文。
- `agentMessage`
  - 字段：`id`、`text`、`phase`、`memoryCitation`
  - 表示 Codex 回复，`text` 可按 Markdown 文本理解。

工作过程信息：

- `hookPrompt`
- `plan`
- `reasoning`
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

Semantic Notes：

- 工作过程 item 表示 Codex 在 turn 中执行的中间步骤或工具活动。
- 状态优先来自 item 自带字段，例如 `commandExecution.status`、`fileChange.status`、`mcpToolCall.status`、`dynamicToolCall.status`、`collabAgentToolCall.status`、`imageGeneration.status`。
- 建议保留未识别的 future `ThreadItem.type` 和原始 payload，方便兼容后续 protocol 扩展。

## Server Notifications

### Thread lifecycle

#### `thread/started`

Payload：

- `thread`

用途：

- 确认当前连接已订阅 thread live events。
- 提供最新 `thread` 数据。

#### `thread/status/changed`

Payload：

- `threadId`
- `status`

用途：

- 通知当前 thread status 已变化，可作为客户端状态缓存的更新来源。

#### `thread/name/updated`

Payload：

- `threadId`
- `threadName?`

用途：

- 通知 thread name 已变化。

#### `thread/closed`

Payload：

- `threadId`

用途：

- 通知当前 thread 已被 app-server 关闭。

### Turn lifecycle

#### `turn/started`

Payload：

- `threadId`
- `turn`

用途：

- 通知 live turn 已开始。
- `turn` 中包含该 turn 的 id、时间和状态字段。

#### `turn/completed`

Payload：

- `threadId`
- `turn`

用途：

- 通知 turn 已进入 terminal state。
- `turn.status = failed` 时，`turn.error` 是失败信息来源。
- `turn.status = interrupted` 时，表示取消请求已经反映到 turn 结果。

### Item lifecycle

#### `item/started`

Payload：

- `threadId`
- `turnId`
- `item`

用途：

- 通知某个 item 已开始。
- `item.type` 是理解 item 语义的主要来源。

#### `item/completed`

Payload：

- `threadId`
- `turnId`
- `item`

用途：

- 通知某个 item 已完成，并提供该 item 的最终对象。
- 对 `agentMessage`，最终权威文本是 `item.text`。

### Message streaming

#### `item/agentMessage/delta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 提供对应 `agentMessage` 的增量文本。
- `item/completed` 到达后，最终权威文本来自 `agentMessage.text`。

### Work progress streaming

#### `turn/plan/updated`

Payload：

- `threadId`
- `turnId`
- `explanation?`
- `plan`

用途：

- 提供结构化 plan 的最新值。
- `plan[].status` 是步骤状态来源。

#### `turn/diff/updated`

Payload：

- `threadId`
- `turnId`
- `diff`

用途：

- 提供当前 turn 聚合 unified diff 的最新快照。

#### `item/reasoning/summaryPartAdded`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `summaryIndex`

用途：

- 通知 reasoning summary 增加新的 section。

#### `item/reasoning/summaryTextDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `summaryIndex`
- `delta`

用途：

- 提供 reasoning summary 的增量文本。

#### `item/reasoning/textDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `contentIndex`
- `delta`

用途：

- 提供 raw reasoning 的增量文本。

#### `item/commandExecution/outputDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 提供命令输出增量。

#### `item/commandExecution/terminalInteraction`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `processId`
- `stdin`

用途：

- 提供 terminal interaction 记录。

#### `item/fileChange/outputDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 提供 file change 工具输出增量。

#### `item/fileChange/patchUpdated`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `changes`

用途：

- 提供 streaming patch snapshot 的最新值。

#### `item/mcpToolCall/progress`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `message`

用途：

- 提供 MCP tool progress。

#### `item/autoApprovalReview/started`

Payload：

- `threadId`
- `turnId`
- `reviewId`
- `targetItemId?`
- `review`
- `action`

用途：

- 通知 approval auto-review 已开始。

#### `item/autoApprovalReview/completed`

Payload：

- `threadId`
- `turnId`
- `reviewId`
- `targetItemId?`
- `decisionSource`
- `review`
- `action`

用途：

- 通知 approval auto-review 已完成。

### Hooks

#### `hook/started`

Payload：

- `threadId`
- `turnId?`
- `run`

用途：

- 通知 hook 正在运行。
- `run.status` 是状态来源。
- 没有 `turnId` 时，该 hook 归属于 thread-level。

#### `hook/completed`

Payload：

- `threadId`
- `turnId?`
- `run`

用途：

- 通知 hook 已完成、失败、blocked 或 stopped。
- `run.entries[]` 中的 `kind` 和 `text` 提供 hook 过程信息。
- 没有 `turnId` 时，该 hook 归属于 thread-level。

### Failure and Warning

#### `error`

Payload：

- `threadId`
- `turnId`
- `willRetry`
- `error`

用途：

- `willRetry = true`：表示 Codex 可能继续恢复或重试，不作为最终失败。
- `willRetry = false`：作为当前 turn 的失败候选。
- 最终失败以 `turn/completed.turn.status = failed` 为权威。

`error` 字段：

- `message`
- `codexErrorInfo`
- `additionalDetails`

#### `warning`

Payload：

- `threadId?`
- `message`

用途：

- 带 `threadId` 时归属于对应 thread。
- 不带 `threadId` 时属于连接级 warning。

#### `guardianWarning`

Payload：

- `threadId`
- `message`

用途：

- 表示当前 thread 存在 guardian warning。

#### `configWarning`

Payload：

- `summary`
- `details?`
- `path?`
- `range?`

用途：

- 表示连接级或配置级 warning。
- `path` 和 `range` 可用于定位相关配置。

#### `model/rerouted`

Payload：

- `threadId`
- `turnId`
- `fromModel`
- `toModel`
- `reason`

用途：

- 表示当前 turn 的 model routing 已变化。

#### `model/verification`

Payload：

- `threadId`
- `turnId`
- `verifications`

用途：

- 表示当前 turn 需要额外账户 verification。

#### `serverRequest/resolved`

Payload：

- `threadId`
- `requestId`

用途：

- 表示对应 server request 已被解析。

## Server Requests

Server Requests 表示 app-server 正在请求客户端侧参与，例如审批、补充输入、elicitation 或 tool call 响应。feature 可以选择完整实现响应流程，也可以只把它们作为状态来源；本文只说明接口形态，不规定界面行为。

### `item/commandExecution/requestApproval`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `approvalId?`
- `reason?`
- `networkApprovalContext?`
- `command?`
- `cwd?`
- `commandActions?`
- `additionalPermissions?`
- `proposedExecpolicyAmendment?`
- `proposedNetworkPolicyAmendments?`
- `availableDecisions?`

Semantic Notes：

- 该 request 归属于对应 `commandExecution` item。

### `item/fileChange/requestApproval`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `reason?`
- `grantRoot?`

Semantic Notes：

- 该 request 归属于对应 `fileChange` item。

### `item/tool/requestUserInput`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `questions`

Semantic Notes：

- 该 request 归属于对应 tool item。

### `mcpServer/elicitation/request`

Payload：

- `threadId`
- `turnId?`
- `serverName`
- request body

Semantic Notes：

- 有 `turnId` 时归属到当前 turn。
- 没有 `turnId` 时归属于 thread-level。

### `item/permissions/requestApproval`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `cwd`
- `reason?`
- `permissions`

Semantic Notes：

- 该 request 归属于对应 item。

### `item/tool/call`

Payload：

- `threadId`
- `turnId`
- `callId`
- `namespace?`
- `tool`
- `arguments`

Semantic Notes：

- 表示 app-server 发起 dynamic tool call，并等待客户端侧处理。

## Event Correlation Notes

- `threadId` 可用于区分不同 thread 的事件。
- `turnId` 可用于关联同一个 turn 的 lifecycle、item 和 error。
- `item.id` / `itemId` 可用于关联同一个 item 的 started、delta、progress 和 completed 事件。
- `item/started` 和 `item/completed` 都携带 item 对象；`item/completed` 中的对象通常是该 item 的最终形态。
- item-specific delta 只对应指定 `itemId`。
- `turn/completed` 表示 turn terminal state，不应假设其中 `items` 总是完整事件历史。
- 同一失败可能同时通过 `error` 和 `turn/completed.failed` 出现，客户端可以按 `threadId + turnId + message + codexErrorInfo` 去重或合并。
- 建议保留未知 enum、未知 `ThreadItem.type`、未知 notification method 和未知字段的原始 payload 或安全通用字段，以兼容未来 protocol 扩展。
