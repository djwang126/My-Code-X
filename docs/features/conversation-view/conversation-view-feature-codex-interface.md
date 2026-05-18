# Conversation View Codex Interface

本文整理 Conversation View 为满足 feature description 可能需要使用的 Codex app-server 接口、参数和填写规则。

本文不定义 My-Code-X 的 UI 组件、domain model、草稿保存、重连策略或完整 Pending interaction 处理流程。

## Source

本文基于本机相邻仓库 `../codex` 的 app-server 源码确认：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`

## 接口总表

Conversation View 发送给 Codex 的接口：

- `initialize`
- `initialized`
- `thread/resume`
- `turn/start`
- `turn/steer`
- `turn/interrupt`
- `thread/unsubscribe`

Conversation View 接收并投影的 Codex 信息：

- 上述 request 的 success response。
- 上述 request 的 JSON-RPC error response。
- 当前 thread 相关的 server notification。
- 当前 thread 相关的 server request。

## 通用填写原则

- 参数名使用 Codex wire protocol 的 camelCase 名称。
- 只发送为了当前操作必须表达的参数，未明确覆盖的 runtime 配置不发送。
- `threadId` 永远来自当前选中的 Codex `Thread.id`。
- `turnId` 永远来自当前 active turn 或 notification payload。
- `item.id` / `itemId` 用于合并 item lifecycle、delta、progress 和最终 item。
- `request id` 用于关联 action response 或 JSON-RPC error response。
- `method` 和 `ThreadItem.type` 是类型判断来源，不从正文文本猜测类型。
- My-Code-X 初始化 app-server 时启用 `experimentalApi: true`，因为当前实现会使用 experimental fields，例如 `persistExtendedHistory`，并且需要兼容 Codex 后续实验字段。
- `optOutNotificationMethods` 不填写或填写空数组；Conversation View 不能主动屏蔽当前文档列出的 notification。

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

## 打开当前 Thread

### `thread/resume`

用途：

- 打开当前选中的已有 Codex `Thread`。
- 订阅该 thread 后续 live events。
- 使 Composer 可以继续在该 thread 上发送 turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。当前选中的 `Thread.id`。 |
| `persistExtendedHistory` | `true`。让本次及后续会话尽量持久化更完整的 history。需要 `experimentalApi: true`。 |
| `cwd` | 默认不传。只有用户明确要求用当前 workspace 覆盖 thread 工作目录时才传。 |
| `model` | 默认不传。只有用户在 My-Code-X 中明确选择模型覆盖时传。 |
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
| `history` | 常规 Conversation View 不传。 |
| `path` | 常规 Conversation View 不传，优先用 `threadId`。 |

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

- 历史重建可能比 live event 少一些中间态；恢复历史时以最终 `ThreadItem` 形态展示。

## Composer 操作

### `turn/start`

用途：

- 当前 thread 空闲时，发送用户输入并开始新 turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。当前选中的 `Thread.id`。 |
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
| `outputSchema` | 默认不传。Conversation View 普通聊天不强制结构化输出。 |
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

- 当前 thread 正在执行 active regular turn，且用户有输入内容时，追加补充指令。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。当前选中的 `Thread.id`。 |
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

- 当前 thread 正在工作，且用户选择中断时，请求取消 active turn。

Params：

| 参数 | 填写 |
| --- | --- |
| `threadId` | 必填。当前选中的 `Thread.id`。 |
| `turnId` | 必填。当前 active turn id；拿不到可靠 `turnId` 时禁用中断按钮。 |

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

Conversation View 使用这些字段：

- `id`
- `preview`
- `name`
- `cwd`
- `status`
- `createdAt`
- `updatedAt`
- `turns`

Note：

- 页面标题优先使用 `name`，没有时使用 `preview`。
- 页面顶部 workspace 使用 `cwd`。
- Composer 可用性和页面状态可参考 `status` 。
- `turns` 来自 `thread/resume` response，作为初始历史输入使用。

### `ThreadStatus`

需要处理的状态：

- `notLoaded`
- `idle`
- `systemError`
- `active`

`active.activeFlags` 需要识别：

- `waitingOnApproval`
- `waitingOnUserInput`

Projection：

- `idle`：可以 `turn/start`。
- `active`：可以根据 Composer 内容选择 `turn/steer` 或 `turn/interrupt`。
- `waitingOnApproval` / `waitingOnUserInput`：显示 thread 正在等待用户或审批，当前 feature 只展示状态。
- `systemError`：展示明显异常状态，并禁用发送。

### `Turn`

Conversation View 使用这些字段：

- `id`
- `items`
- `status`
- `error`
- `startedAt`
- `completedAt`
- `durationMs`

Projection：

- `items` 用于历史恢复。
- live `turn/started` 和 `turn/completed` 中的 `items` 不作为完整 item 列表依赖。
- `status = failed` 时读取 `error` 作为失败信息。

### `ThreadItem`

普通对话内容：

- `userMessage`
  - 字段：`id`、`content`
  - 展示用户输入原文。
- `agentMessage`
  - 字段：`id`、`text`、`phase`、`memoryCitation`
  - 展示 Codex 回复，`text` 支持 Markdown 阅读。

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

Projection：

- 工作过程 item 默认紧凑展示，可展开查看字段详情。
- 状态优先使用 item 自带字段，例如 `commandExecution.status`、`fileChange.status`、`mcpToolCall.status`、`dynamicToolCall.status`、`collabAgentToolCall.status`、`imageGeneration.status`。
- 未识别的 future `ThreadItem.type` 进入 unknown fallback，不能丢弃。

## Server Notifications

### Thread lifecycle

#### `thread/started`

Payload：

- `thread`

用途：

- 确认当前连接已订阅 thread live events。
- 更新顶部上下文和 thread status。

#### `thread/status/changed`

Payload：

- `threadId`
- `status`

用途：

- 更新当前 thread 是否 idle、active、waiting 或 systemError。
- 决定 Composer 的发送、追加和中断状态。

#### `thread/name/updated`

Payload：

- `threadId`
- `threadName?`

用途：

- 更新页面顶部标题。

#### `thread/closed`

Payload：

- `threadId`

用途：

- 当前 thread 被 app-server 关闭时，标记内容可能不是最新。

### Turn lifecycle

#### `turn/started`

Payload：

- `threadId`
- `turn`

用途：

- 创建或补全 live turn。
- 记录 `startedAt` 和 `status = inProgress`。

#### `turn/completed`

Payload：

- `threadId`
- `turn`

用途：

- 设置 turn terminal state。
- `turn.status = failed` 时，`turn.error` 是失败信息来源。
- `turn.status = interrupted` 时，确认中断完成。

### Item lifecycle

#### `item/started`

Payload：

- `threadId`
- `turnId`
- `item`

用途：

- 创建或 upsert timeline item。
- `item.type` 决定普通消息、工作过程或 unknown fallback。

#### `item/completed`

Payload：

- `threadId`
- `turnId`
- `item`

用途：

- 用最终 `item` 覆盖同 `threadId + turnId + item.id` 的临时状态。
- 对 `agentMessage`，最终权威文本是 `item.text`。

### Message streaming

#### `item/agentMessage/delta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 追加到对应 `agentMessage` 的临时文本 buffer。
- `item/completed` 到达后，以最终 `agentMessage.text` 覆盖临时 buffer。

### Work progress streaming

#### `turn/plan/updated`

Payload：

- `threadId`
- `turnId`
- `explanation?`
- `plan`

用途：

- 展示结构化 plan。
- `plan[].status` 是步骤状态来源。

#### `turn/diff/updated`

Payload：

- `threadId`
- `turnId`
- `diff`

用途：

- 展示当前 turn 聚合 unified diff 的最新快照。

#### `item/reasoning/summaryPartAdded`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `summaryIndex`

用途：

- 为 reasoning summary 创建新的 section。

#### `item/reasoning/summaryTextDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `summaryIndex`
- `delta`

用途：

- 追加 reasoning summary 文本。

#### `item/reasoning/textDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `contentIndex`
- `delta`

用途：

- 追加 raw reasoning 文本。

#### `item/commandExecution/outputDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 追加命令输出。

#### `item/commandExecution/terminalInteraction`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `processId`
- `stdin`

用途：

- 展示 terminal interaction 记录。

#### `item/fileChange/outputDelta`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `delta`

用途：

- 追加 file change 工具输出。

#### `item/fileChange/patchUpdated`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `changes`

用途：

- 更新 streaming patch snapshot。

#### `item/mcpToolCall/progress`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `message`

用途：

- 展示 MCP tool progress。

#### `item/autoApprovalReview/started`

Payload：

- `threadId`
- `turnId`
- `reviewId`
- `targetItemId?`
- `review`
- `action`

用途：

- 展示 approval auto-review 开始状态。

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

- 展示 approval auto-review 完成状态。

### Hooks

#### `hook/started`

Payload：

- `threadId`
- `turnId?`
- `run`

用途：

- 展示 hook 运行中状态。
- `run.status` 是状态来源。
- 没有 `turnId` 时，作为 thread-level work progress 展示。

#### `hook/completed`

Payload：

- `threadId`
- `turnId?`
- `run`

用途：

- 展示 hook 完成、失败、blocked 或 stopped 状态。
- `run.entries[]` 中的 `kind` 和 `text` 进入工作过程详情。
- 没有 `turnId` 时，作为 thread-level work progress 展示。

### Failure and notice

#### `error`

Payload：

- `threadId`
- `turnId`
- `willRetry`
- `error`

用途：

- `willRetry = true`：展示恢复中或重试中提示，不作为最终失败。
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

- 带当前 `threadId` 时作为页面 notice。
- 不带 `threadId` 时，只有它影响当前连接可用性才展示。

#### `guardianWarning`

Payload：

- `threadId`
- `message`

用途：

- 作为当前 thread 的高优先级 notice。

#### `configWarning`

Payload：

- `summary`
- `details?`
- `path?`
- `range?`

用途：

- 作为连接级或配置级 notice 展示。
- 不进入 timeline。

#### `model/rerouted`

Payload：

- `threadId`
- `turnId`
- `fromModel`
- `toModel`
- `reason`

用途：

- 作为非阻塞 notice 或 work progress detail。

#### `model/verification`

Payload：

- `threadId`
- `turnId`
- `verifications`

用途：

- 提示当前 turn 需要额外账户 verification。

#### `serverRequest/resolved`

Payload：

- `threadId`
- `requestId`

用途：

- 清除对应 server request 的等待状态。

## Server Requests

完整 Pending interaction UI 和 response action 不在本 feature scope 内。Conversation View 仍需要接收当前 thread 相关 server request，用于展示 Codex 正在等待什么，并避免用户误判为卡死。

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

Projection：

- 归属到对应 `commandExecution` item 的等待状态。

### `item/fileChange/requestApproval`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `reason?`
- `grantRoot?`

Projection：

- 归属到对应 `fileChange` item 的等待状态。

### `item/tool/requestUserInput`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `questions`

Projection：

- 归属到对应 tool item 的等待用户输入状态。

### `mcpServer/elicitation/request`

Payload：

- `threadId`
- `turnId?`
- `serverName`
- request body

Projection：

- 有 `turnId` 时归属到当前 turn。
- 没有 `turnId` 时作为 thread-level pending 状态。

### `item/permissions/requestApproval`

Payload：

- `threadId`
- `turnId`
- `itemId`
- `cwd`
- `reason?`
- `permissions`

Projection：

- 归属到对应 item 的权限等待状态。

### `item/tool/call`

Payload：

- `threadId`
- `turnId`
- `callId`
- `namespace?`
- `tool`
- `arguments`

Projection：

- 作为 dynamic tool call 等待状态展示。

## 合并规则

- 用 `threadId` 分区维护 Conversation View state。
- 用 `turnId` 维护 turn。
- 用 `item.id` / `itemId` 维护每个 turn 内的 item。
- `item/started` 创建或 upsert item。
- item-specific delta 只更新对应 item 的临时 buffer。
- `item/completed` 覆盖该 item 的最终对象。
- `turn/completed` 只设置 turn terminal state，不依赖其中 `items` 完整。
- 同一失败同时通过 `error` 和 `turn/completed.failed` 出现时，按 `threadId + turnId + message + codexErrorInfo` 去重或合并。
- 所有未知 enum、未知 `ThreadItem.type`、未知 notification method 和未知字段都保留原始 payload 或安全通用字段，进入 unknown fallback 或 notice。

## 可展示内容判断

- `userMessage` 和 `agentMessage` 是普通对话内容。
- work progress item、failure item、unknown item 也是可展示内容。
- 空 turn 不单独让页面变成“有内容”，除非它包含可展示 item、pending 状态或 error。

## Composer 可用性

- 没有当前 `threadId`：禁用发送、追加和中断。
- `thread.status = idle`：允许 `turn/start`。
- `thread.status = active` 且有 active regular `turnId`：允许 `turn/steer` 或 `turn/interrupt`。
- `thread.status = systemError`：禁用 Composer action。
- 历史恢复中、连接不可用或当前状态不明确：禁用 Composer action，但保留草稿。
