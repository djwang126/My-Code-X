# Conversation View Codex Interface

本文整理 Conversation View 为满足 feature description 需要用到的 Codex app-server 聊天接口。

本文不定义 My-Code-X feature detail、domain model 或 UI 组件设计。

## 文档边界

Conversation View 用到的 Codex 接口包括两类：

- My-Code-X 主动发送给 Codex 的 request / notification。
- Codex 返回给 My-Code-X 的 response、error、notification、server request。

本文里的 input 指“Conversation View 功能实现需要纳入设计的 Codex 协议信息”，包括发送侧和接收侧。

不在本文定义：

- Web client toast、modal、timeline item 等输出形态。
- Composer 草稿保存策略。
- 连接重试、恢复中、内容可能过期等 My-Code-X runtime 机制。
- 从普通文本内容中猜测出来的类型。

## 接口总表

### 发送给 Codex 的接口

Conversation View 需要用到这些 client request / notification：

- `initialize`
  - app-server 连接初始化。
  - 不是 Conversation View 专属，但没有它后续聊天接口不可用。
- `initialized`
  - 初始化完成 notification。
  - 不是 Conversation View 专属，但属于聊天连接前置条件。
- `thread/resume`
  - 打开已有 thread，使当前 Conversation View 可以继续对话并订阅后续事件。
- `thread/read`
  - 只读读取 thread 历史，不恢复为可继续对话状态。
- `thread/turns/list`
  - 分页读取历史 turns。
- `turn/start`
  - 当前 Codex 空闲时，发送用户输入并开始新 turn。
- `turn/steer`
  - 当前 Codex 正在工作时，追加用户补充指令到 active regular turn。
- `turn/interrupt`
  - 当前 Codex 正在工作时，请求中断 active turn。
- server request response
  - 对 Codex 发来的审批、用户输入、elicitation、dynamic tool call 等 server request 返回结果。
  - 完整 Pending interaction 处理流程不在本 feature scope，但接口方向需要在本文列出。

Conversation View 可能间接依赖但不由本文定义的接口：

- `thread/list`
  - 可用于 thread 选择器或外层 app shell 提供当前选中 thread。
- `thread/start`
  - 可用于创建新 thread。当前 feature description 只要求“没有选中 Thread 的状态”和“绑定当前选中 Thread”，不要求 Conversation View 内创建新 thread。
- `thread/unsubscribe`
  - 可用于离开页面或切换 thread 时取消订阅。

### Codex 返回给 Conversation View 的接口

- Codex response 中返回的 `Thread`、`Turn`、`ThreadItem`。
- Codex notification stream 中的 thread、turn、item、runtime notification。
- 当前 Conversation View 发出的 request 对应的 success response 或 JSON-RPC error response。
- 服务端反向 request 中会影响当前 thread 可见状态的信息。

## 通用关联字段

所有可进入当前 Conversation View 的 Codex 信息都应优先按这些字段归属：

- `threadId`
  - 判断是否属于当前选中的 Codex `Thread`。
- `turnId`
  - 判断是否属于当前 turn timeline。
- `item.id` / `itemId`
  - 合并 live item、delta、progress 和最终 item。
- request `id`
  - 关联 action response / JSON-RPC error response。
- Codex `method` 或 `ThreadItem.type`
  - 作为类型来源，不从正文文本推断。

## 历史输入

功能目标：

页面需要恢复当前 Codex `Thread` 的历史内容，并能分页读取大历史。

需要接收的 Codex 信息：

- `thread/resume` request
  - 用于打开已有 thread 并订阅 live events。
  - 关键 params：`threadId`、`path`、`excludeTurns`、`persistExtendedHistory`。
- `thread/resume` response
  - 用于恢复并订阅一个可继续对话的 thread。
  - response 中的 `thread.turns` 可能包含重建历史。
- `thread/read` request
  - 用于只读读取历史。
  - 关键 params：`threadId`、`includeTurns`。
- `thread/read(includeTurns: true)` response
  - 用于只读读取历史，不让 thread 进入可继续对话状态。
- `thread/turns/list` request
  - 用于分页读取历史。
  - 关键 params：`threadId`、`cursor`、`limit`、`sortDirection`。
- `thread/turns/list` response
  - 用于分页读取 `Turn[]` 历史。
- `Thread`
  - 用于页面顶部上下文和 thread 状态。
  - 关键字段：`id`、`preview`、`name`、`cwd`、`status`、`updatedAt`、`createdAt`。
- `Turn`
  - 用于 turn 分组、状态和时间信息。
  - 关键字段：`id`、`items`、`status`、`error`、`startedAt`、`completedAt`、`durationMs`。
- `ThreadItem[]`
  - 用于恢复 timeline 内容。

注意：

- `ThreadItem` 是历史重建结果，协议明确说明可能 lossy。
- 历史中的 streaming delta 中间态通常不能恢复，恢复后应以 `ThreadItem` 最终形态展示。

## Message reading

功能目标：

用户需要看到自己发送的内容和 Codex 回复的内容，并能看到 Codex 回复的实时变化和最终结果。

需要接收的 Codex 信息：

- `turn/start` request
  - 当前 Codex 空闲时，由 Composer 发送用户输入。
  - 关键 params：`threadId`、`input`。
  - 可选 params：`cwd`、`approvalPolicy`、`approvalsReviewer`、`sandboxPolicy`、`permissions`、`model`、`serviceTier`、`effort`、`summary`、`personality`、`outputSchema`、`collaborationMode`。
- `turn/start` response
  - 返回初始 `Turn`，表示请求被接受。
  - response 中 `turn.items` 通常为空。
- `turn/steer` request
  - 当前 Codex 正在工作且用户有输入内容时，向 active regular turn 追加输入。
  - 关键 params：`threadId`、`expectedTurnId`、`input`。
- `turn/steer` response
  - 返回 `{ turnId }`，表示补充输入被接受。
  - 不会产生新的 `turn/started`。
- `ThreadItem.type = userMessage`
  - 用于展示用户输入。
  - 原始输入来自 `content: UserInput[]`。
- `ThreadItem.type = agentMessage`
  - 用于展示 Codex 回复。
  - 正文来自 `text`。
- `item/started`
  - 当 `params.item.type = userMessage` 或 `agentMessage` 时，用于 live 创建 message item。
- `item/agentMessage/delta`
  - 用于更新正在生成中的 Codex 回复。
  - 通过 `threadId + turnId + itemId` 关联到对应 `agentMessage`。
- `item/completed`
  - 当 `params.item.type = agentMessage` 时，`item.text` 是该回复的最终权威文本。
  - 当 `params.item.type = userMessage` 时，表示该用户输入 item 的最终结构。
- `turn/started`
  - 用于建立或补全 live turn 的开始状态和 `startedAt`。
- `turn/completed`
  - 用于确认 turn terminal state 和 `completedAt`。

投影规则：

- 每轮对话的第一条用户消息应从该 turn 的 `userMessage` item 顺序中识别。
- 每轮对话的最后一条 Codex 回复应从该 turn 的 `agentMessage` item 顺序中识别。
- 不应依赖 `turn/completed.turn.items` 查找最终 message。协议说明 live `turn/completed.turn.items` 通常为空。
- 最终 assistant 文本以 `item/completed` 中的完整 `agentMessage.text` 为准。
- `turn/steer` 成功后不产生新 turn；后续 user input 如果进入历史，应继续按同一 active turn 内的 `userMessage` item 展示。

## Work progress reading

功能目标：

用户需要看到 Codex 的工作过程，例如计划、工具调用、工具结果、文件变更、网页搜索等。

需要接收的 Codex 信息：

- 历史和 live 中以下 `ThreadItem.type`：
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
- `item/started`
  - 用于创建工作过程 item。
- `item/completed`
  - 用于覆盖 item 最终权威状态。
- `item/plan/delta`
  - 用于 plan 文本流式更新。
- `turn/plan/updated`
  - 用于结构化 plan 状态展示。
- `item/reasoning/summaryPartAdded`
  - 用于 reasoning summary 新 section。
- `item/reasoning/summaryTextDelta`
  - 用于 reasoning summary 文本增量。
- `item/reasoning/textDelta`
  - 用于 raw reasoning 文本增量。
- `item/commandExecution/outputDelta`
  - 用于命令输出增量。
- `item/commandExecution/terminalInteraction`
  - 用于 terminal interaction 记录。
- `item/fileChange/outputDelta`
  - 用于 file change 工具输出增量。
- `item/fileChange/patchUpdated`
  - 用于 streaming patch structured snapshot。
- `turn/diff/updated`
  - 用于本 turn 聚合 unified diff 最新视图。
- `item/mcpToolCall/progress`
  - 用于 MCP 工具进度消息。
- `item/autoApprovalReview/started`
  - 用于 auto-review 过程记录。
- `item/autoApprovalReview/completed`
  - 用于 auto-review 结果记录。

状态字段：

- Codex 没有统一的 work progress `status` 字段。
- 只有部分 `ThreadItem` 带各自的 `status`，例如：
  - `commandExecution.status`
  - `fileChange.status`
  - `mcpToolCall.status`
  - `dynamicToolCall.status`
  - `collabAgentToolCall.status`
  - `imageGeneration.status`
- `turn/plan/updated.plan[].status` 可用于结构化计划步骤状态。

投影规则：

- 摘要优先使用 Codex 原生 `type`、`method`、`status`、`tool`、`command`、`query` 等字段。
- 复杂对象进入通用详情展示，不从普通文本中二次解析类型。
- delta/progress 只能更新已归属的 item 或 turn；无法归属时进入 unknown fallback 或 notice。

## Unknown information fallback

功能目标：

当 Codex 产生 My-Code-X 暂时不能专门理解的信息时，用户仍然能看到来源和细节，避免信息丢失。

需要接收的 Codex 信息：

- 未识别的 `ThreadItem.type`。
- 未识别的 notification `method`。
- 已识别 `ThreadItem` 或 notification 中未知的 enum 值。
- 已识别 `ThreadItem` 或 notification 中暂不专门渲染的字段。

需要保留的字段：

- `method`
- `ThreadItem.type`
- `threadId`
- `turnId`
- `item.id` / `itemId`
- status-like 字段，如果存在
- 原始 payload 或可安全展示的通用字段结构

投影规则：

- 能归属到当前 `threadId + turnId` 的未知信息进入 timeline。
- 只能归属到当前 `threadId`、不能归属到具体 `turnId` 的未知信息进入页面 notice 或 thread-level compact 信息。
- 不能归属到当前 thread 的未知信息不进入当前 Conversation View。
- 未知信息不应被当作失败信息展示。

## Failure reading

功能目标：

用户需要看到当前工作中的明确失败，以及可用于排查的错误信息。

需要接收的 Codex 信息：

- 当前 Conversation View 发出的 request 对应的 JSON-RPC error response
  - 包括 `thread/resume`、`thread/read`、`thread/turns/list`、`turn/start`、`turn/steer`、`turn/interrupt` 等。
  - request error 首先是对应操作的失败反馈，不天然等于 timeline failure。
- `error` notification
  - shape：`{ threadId, turnId, willRetry, error }`。
  - `error.message` 是优先展示文本。
  - `error.codexErrorInfo` 和 `error.additionalDetails` 用于排查详情。
- `turn/completed`
  - 当 `turn.status = failed` 时，表示 turn terminal failure。
  - `turn.error` 是失败原因来源。
- `Turn.error`
  - 字段：`message`、`codexErrorInfo`、`additionalDetails`。

投影规则：

- `willRetry = false` 的 `error` notification 可以作为当前 turn 的明确失败候选。
- `willRetry = true` 的 `error` notification 不应作为最终失败展示；它表示 Codex 可能仍在自动恢复。
- `turn/completed.status = failed` 是 terminal failure 的权威状态。
- 同一失败同时通过 `error` notification 和 `turn/completed.failed` 出现时，应按 `threadId + turnId + message + codexErrorInfo` 去重或合并。
- 如果 `error` notification 没有 `turnId`，但有当前 `threadId`，应优先作为 notice；只有能可靠关联 active turn 时才进入 timeline failure。
- JSON-RPC error response 只表示 request 被拒绝，不天然等于 timeline failure。

## Recovering / retry feedback

功能目标：

用户需要知道 Codex 遇到了问题但仍可能自动恢复，不应误判为最终失败。

需要接收的 Codex 信息：

- `error` notification with `willRetry = true`
  - 用于展示临时恢复或重试状态。
- 后续同一 `threadId + turnId` 的正常 notification
  - 用于让恢复提示消失或降级。
- 后续 `error` notification with `willRetry = false`
  - 用于转入失败候选。
- 后续 `turn/completed.status = failed`
  - 用于转入 terminal failure。
- 后续 `turn/completed.status = completed` 或 `interrupted`
  - 用于结束恢复提示。

后续正常 notification 包括：

- `item/started`
- `item/completed`
- item delta/progress notification
- `turn/plan/updated`
- `turn/diff/updated`
- `thread/tokenUsage/updated`

投影规则：

- Recovering / retry feedback 是 Failure reading 和 Live update 的辅助状态，不是独立 timeline 内容类型。
- 多个连续 `willRetry = true` error 应保留最新状态，避免重复干扰用户。

## Conversation View notice

功能目标：

用户需要看到不能放进主阅读流、也不能明确归属到当前工作位置的提示、错误或警告。

需要接收的 Codex 信息：

- 当前 Conversation View 发出的 request 对应的 JSON-RPC error response。
  - 包括历史读取失败、发送失败、追加失败、中断失败。
- `warning` notification
  - shape：`{ threadId?, message }`。
- 无法归属到具体 `turnId` 的 `error` notification。
- `thread/status/changed`
  - 当 status 表达 `systemError` 或影响当前页面可操作状态时。
- `model/rerouted`
  - 可作为非阻塞提示或工作过程信息。
- `model/verification`
  - 用于提示账户需要额外 verification。

投影规则：

- 只有当前 Conversation View 发出的 request error 才进入当前页面反馈。
- 带当前 `threadId` 但缺少 `turnId` 的 runtime 信息优先作为 thread-level notice。
- 不带当前 `threadId` 的信息不进入当前 Conversation View，除非它是当前连接级别且直接影响当前页面。
- notice 是页面反馈，不进入普通 message timeline。

## Conversation state

功能目标：

用户需要知道当前内容是否正在恢复、是否为空、是否失败、是否可能不是最新。

需要接收的 Codex 信息：

- `thread/resume` / `thread/read` / `thread/turns/list` request lifecycle
  - 用于判断历史恢复或分页读取是否进行中。
- 当前选中的 `Thread`
  - 用于判断是否有选中 thread。
- 历史读取 request 的 response / error
  - 用于判断恢复成功或失败。
- `Thread.turns` 或 `thread/turns/list.data`
  - 用于判断是否存在可展示内容。
- `thread/status/changed`
  - 用于判断 thread 是否 idle、active、systemError。
- `turn/started`
  - 用于判断有 live active turn。
- `turn/completed`
  - 用于判断 active turn 结束。

My-Code-X runtime 状态：

- 恢复开始。
- 同步中。
- 重新连接。
- 连接不可用。
- 内容可能不是最新。

这些状态不是 Codex 原生 projection input，但 Conversation View 需要消费 My-Code-X 自身状态来决定页面提示和 Composer 禁用状态。

可展示内容判断：

- `userMessage` 和 `agentMessage` 是普通对话内容。
- work progress item、failure item、unknown item 也是可展示内容。
- 空 turn 不应单独让页面变成“有内容”，除非它包含可展示状态或错误。

## Live update

功能目标：

用户需要在 Codex 工作进行中持续看到新内容和内容变化。

需要接收的 Codex 信息：

- `thread/started`
  - 用于确认当前连接已订阅 thread 事件。
- `thread/status/changed`
  - 用于更新 thread active / idle / waiting / systemError 状态。
- `turn/started`
  - 用于创建或补全 live turn。
- `item/started`
  - 用于创建或 upsert item。
- item delta/progress notification
  - 用于更新 item 临时内容或进度。
- `item/completed`
  - 用于覆盖 item 最终权威对象。
- `turn/completed`
  - 用于设置 turn terminal state。
- `thread/tokenUsage/updated`
  - 可用于附加状态或详情展示。
- `serverRequest/resolved`
  - 用于解除对应服务端反向 request 的等待状态。

合并规则：

- 用 `threadId` 分区维护 conversation state。
- 用 `turnId` 维护 turn。
- 用 `item.id` / `itemId` 维护每个 turn 内的 item。
- `item/started` 创建或 upsert item。
- item-specific delta 只追加到对应 item 的临时 buffer。
- `item/completed` 覆盖该 item 的最终对象。
- `turn/completed` 只作为 turn terminal 状态，不依赖其中 `items` 完整。
- 对所有 enum 和 method 保持前向兼容，未知值进入 unknown fallback。

## Composer related feedback

说明：

Composer 需要发送 `turn/start`、`turn/steer`、`turn/interrupt`，并接收 Codex 对这些 action 的反馈，用于决定草稿、错误提示和后续 timeline 更新。

需要发送给 Codex 的信息：

- `turn/start` request
  - Codex 空闲时，发送普通输入并开始新 turn。
  - 请求体必须包含目标 `threadId` 和原始 `UserInput[]`。
- `turn/steer` request
  - Codex 工作中且用户有输入内容时，发送补充指令。
  - 请求体必须包含 `threadId`、`expectedTurnId` 和原始 `UserInput[]`。
- `turn/interrupt` request
  - Codex 工作中且用户无输入内容时，请求中断。
  - 请求体必须包含 `threadId` 和 `turnId`。

需要接收的 Codex 反馈：

- `turn/start` success response
  - 表示服务端接受请求并创建初始 `Turn`。
  - response 中 `turn.items` 通常为空。
- `turn/start` JSON-RPC error response
  - 表示发送失败，Composer 应保留草稿并提示。
- `turn/steer` success response
  - response 返回 `{ turnId }`。
  - 不会产生新的 `turn/started`。
- `turn/steer` JSON-RPC error response
  - 例如没有 active turn、`expectedTurnId` 不匹配、active turn 不可 steer。
- `turn/interrupt` success response
  - 只表示 cancellation request 被接受。
- `turn/interrupt` JSON-RPC error response
  - 表示中断请求失败。
- 后续 `turn/completed.status = interrupted`
  - 表示 turn 真正完成中断。
- 后续标准 live notification
  - 用于展示请求被接受后真正进入 timeline 的内容。

投影规则：

- 请求被接受后，Composer 可以清空已发送草稿。
- 请求失败时，Composer 保留原草稿。
- 未被 Codex 确认的输入不应伪装成正式 timeline 内容。
- action error 可以进入 Composer-local feedback 或 Conversation View notice，具体由 UI/feature detail 决定。

## 服务端反向 request

功能目标：

完整 Pending interaction 处理流程不在 Conversation View feature scope 内，但 Conversation View 需要知道这些 request 会影响当前 thread 的可操作状态和工作过程理解。

需要接收的 Codex 信息：

- `item/commandExecution/requestApproval`
  - 命令执行审批。
- `item/fileChange/requestApproval`
  - 文件修改审批。
- `item/tool/requestUserInput`
  - 工具调用请求用户输入。
- `mcpServer/elicitation/request`
  - MCP elicitation。
- `item/permissions/requestApproval`
  - 权限请求审批。
- `item/tool/call`
  - 请求客户端执行 dynamic tool call。

需要发送给 Codex 的信息：

- `item/commandExecution/requestApproval` response
  - 返回 `{ decision }`。
- `item/fileChange/requestApproval` response
  - 返回 `{ decision }`。
- `item/tool/requestUserInput` response
  - 返回 `{ answers }`。
- `mcpServer/elicitation/request` response
  - 返回 `{ action, content?, _meta? }`。
- `item/permissions/requestApproval` response
  - 返回 `{ permissions, scope, strictAutoReview? }`。
- `item/tool/call` response
  - 返回 `{ contentItems, success }`。

需要接收的后续 Codex 信息：

- `serverRequest/resolved`
  - 服务端反向 request 已被客户端响应并在 thread listener 顺序中 resolved。
- `thread/status/changed`
  - `activeFlags` 可能包含 `waitingOnApproval` 或 `waitingOnUserInput`。

投影规则：

- 能归属到当前 `threadId + turnId + itemId` 的 request 可作为对应 work progress 的等待状态。
- 不能归属到具体 item 的 request 应作为 thread-level pending 状态。
- 具体审批 UI 和响应 action 不在本文定义。

## Realtime events

当前 Conversation View feature description 没有要求支持 Realtime API。

默认不接收以下事件作为 Conversation View timeline 输入：

- `thread/realtime/started`
- `thread/realtime/itemAdded`
- `thread/realtime/transcript/delta`
- `thread/realtime/transcript/done`
- `thread/realtime/outputAudio/delta`
- `thread/realtime/sdp`
- `thread/realtime/error`
- `thread/realtime/closed`

原因：

- 协议说明 `thread/realtime/*` 是 ephemeral transport events。
- 它们不是 `ThreadItem`。
- 它们不会通过 `thread/read`、`thread/resume`、`thread/fork` 恢复。

如果后续 feature 明确支持 realtime transcript，需要单独设计 live session 内状态。
