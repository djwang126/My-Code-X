# Conversation View Projection Input Draft

本文只整理 Conversation View 各功能点需要接收的 Codex 信息来源。

本文不定义 My-Code-X feature detail or domain model。

## Message reading

功能目标：

用户需要看到自己发送的内容和 Codex 回复的内容，并能看到 Codex 回复的实时变化和最终结果。

需要接收的 Codex 信息：

- Codex `userMessage`
  - 用于展示用户输入内容。
- Codex `agentMessage`
  - 用于展示 Codex 回复内容。
- Codex `agentMessage` 实时 delta
  - 用于更新正在生成中的 Codex 回复。
- Codex `item/completed` 中的最终 `agentMessage.text`
  - 用于确认 Codex 回复的最终文本。
- Codex `turn/start`
  - 原文中提到一个 `Turn` 中第一条 `userMessage` 对应 Codex `turn/start`，可用于识别关键用户输入。
- Codex `turn/completed`
  - 原文中提到一个 `Turn` 中最后一条 `agentMessage` 对应 Codex `turn/completed`，可用于识别关键 Codex 回复。

原文不清晰点：

- `turn/steer` 产生的用户输入是否也作为 message reading 的输入来源。
- `agentMessage` delta 如何关联到具体的回复。
- `item/completed` 和 `turn/completed` 在确认最终回复时分别承担什么职责。
- 一个 `Turn` 内是否可能有多条 `userMessage` 或多条 `agentMessage`。
- 恢复历史时，`userMessage` / `agentMessage` 来自 `ThreadItem` 的具体结构没有说明。

## Work progress reading

功能目标：

用户需要看到 Codex 的工作过程，例如计划、工具调用、工具结果、文件变更、网页搜索等。

需要接收的 Codex 信息：

- Codex 结构化 `ThreadItem`
  - 用于恢复或展示已经发生过的工作过程信息。
- typed `Codex runtime event`
  - 用于展示 live 期间发生的工作过程信息。
- Codex 原生 type
  - 用于让用户知道这条工作过程信息来自什么类型。
- Codex status 字段
  - 如果来源信息存在 status，则用于展示该工作过程的状态。
- Codex 中表示计划、工具调用、工具结果、文件变更、网页搜索的信息
  - 原文把这些都归为用户需要看到的工作痕迹。

原文不清晰点：

- 哪些 Codex `ThreadItem` type 属于计划、工具调用、工具结果、文件变更、网页搜索。
- 哪些 typed `Codex runtime event` 属于工作过程信息。
- status 字段在哪些 Codex 信息上存在，以及可能有哪些值。
- “文件变更”和“网页搜索”对应的 Codex 原生信息结构没有列出。
- 原文只说不从普通文本输出中解析，但没有列出结构化来源白名单。

## Unknown information fallback

功能目标：

当 Codex 产生 My-Code-X 暂时不能专门理解的信息时，用户仍然能看到来源和细节，避免信息丢失。

需要接收的 Codex 信息：

- 未识别的 Codex `ThreadItem`
  - 用于展示恢复历史中暂时不能专门理解的信息。
- 未识别但可归属到当前 `Turn` 的 `Codex runtime event`
  - 用于展示 live 期间暂时不能专门理解的信息。
- 来源 type 或可识别来源信息
  - 用于说明未知信息来自哪里。
- status 字段
  - 如果来源信息存在 status，则保留给用户查看。
- 复杂字段值
  - 用于通用展示细节。

原文不清晰点：

- “未识别”的判断依据没有定义。
- 哪些 runtime event 可以被认为“可归属到当前 `Turn`”没有说明。
- 不可归属到当前 `Turn` 的未知信息应给哪个功能点接收没有说明。
- 来源 type 缺失时使用什么 fallback 信息没有说明。
- 复杂字段值需要展示到什么程度没有说明。

## Failure reading

功能目标：

用户需要看到当前工作中的明确失败，以及可用于排查的错误信息。

需要接收的 Codex 信息：

- Codex `error` notification with `willRetry = false`
  - 用于展示最终失败。
- Codex `turn/completed` with `status = failed`
  - 用于展示 `Turn` 失败。
- `turn/completed` 中的 `TurnError`
  - 用于展示失败原因。
- 错误字段：
  - `source`
  - `threadId`
  - `turnId`
  - `willRetry`
  - `status`
  - `message`
  - `codexErrorInfo`
  - `additionalDetails`

原文不清晰点：

- `error` notification 没有 `turnId` 时，是否属于 Failure reading。
- `willRetry` 缺失时如何判断是否是最终失败。
- `turn/completed status = failed` 但没有 `TurnError` 时应接收哪些信息。
- `error notification` 和 `turn/completed failed` 同时出现时，具体由哪个信息作为主要失败来源没有完全讲清楚。
- `codexErrorInfo` 和 `additionalDetails` 的结构没有说明。

## Recovering error feedback

功能目标：

用户需要知道 Codex 遇到了问题但仍在自动恢复，而不是已经最终失败或卡死。

需要接收的 Codex 信息：

- Codex `error` notification with `willRetry = true`
  - 用于展示正在恢复或重试的临时状态。
- 当前 active Codex `Turn` 信息
  - 用于把恢复提示关联到当前正在进行的工作。
- 后续正常 Codex runtime event
  - 用于判断恢复提示可以消失。
- Codex `item/*` delta
  - 原文将其作为后续正常事件示例。
- progress notification
  - 原文将其作为后续正常事件示例。
- completed notification
  - 原文将其作为后续正常事件示例。
- Codex `turn/completed` notification
  - 用于结束恢复提示。
- 后续 Codex `error` notification with `willRetry = false`
  - 用于转入最终失败展示。
- 后续 `turn/completed` with `status = failed`
  - 用于转入最终失败展示。
- 错误字段：
  - `source`
  - `threadId`
  - `turnId`
  - `willRetry`
  - `message`
  - `codexErrorInfo`
  - `additionalDetails`

原文不清晰点：

- 当前 active `Turn` 的来源没有说明。
- `willRetry = true` error 没有 `turnId` 时是否还能作为 recovering error。
- “后续正常 Codex runtime event”的完整范围没有定义。
- progress notification 的具体 Codex 信息类型没有说明。
- 多个 `willRetry = true` error 连续出现时，功能上接收所有还是只接收最新没有完全明确。
- 重新连接或历史恢复后，是否还接收 recovering error 信息没有说明。

## Conversation View notice

功能目标：

用户需要看到不能放进主阅读流、也不能明确归属到当前工作位置的提示、错误或警告。

需要接收的 Codex 信息：

- JSON-RPC error response
  - 表示某个 app-server request 被拒绝。
- 系统级 warning
  - 用于展示 Codex 或 app-server 层面的 warning。
- 无法归属到当前 `Turn` 的错误
  - 用于展示不能放入具体工作位置的错误。
- 可投影为 Web client 全局 `Client notice` 的提示信息
  - 原文提到 Conversation View notice 可以投影为全局前端 notice。

原文不清晰点：

- JSON-RPC error response 是否所有都属于 Conversation View，还是只有当前 Conversation View 发出的 request 才属于。
- 系统级 warning 的 Codex 原生来源没有说明。
- “无法归属到当前 `Turn`”的判断规则没有说明。
- 可归属到当前 `Thread` 但不可归属到 `Turn` 的错误是否属于 notice，没有说明。
- notice 需要接收哪些字段没有说明。

## Conversation state

功能目标：

用户需要知道当前内容是否正在恢复、是否为空、是否失败、是否可能不是最新。

需要接收的 Codex 或 runtime 信息：

- 当前 `Conversation` 恢复开始的信息
  - 用于展示恢复中状态。
- 当前 `Conversation` 恢复成功的信息
  - 用于判断是否展示内容或空状态。
- 当前 `Conversation` 恢复失败的信息
  - 用于展示失败状态。
- 是否存在可展示的 Codex 内容
  - 用于判断空状态。
- 同步中、重新连接、无法确认内容最新的信息
  - 用于展示非阻塞状态提示。
- 当前是否选中 Codex `Thread`
  - 用于展示无选中状态。

原文不清晰点：

- 恢复开始、恢复成功、恢复失败分别来自哪些 Codex 信息或 My-Code-X runtime 信号。
- “可展示的 Codex 内容”的判断标准没有说明。
- 同步中、重新连接、无法确认最新分别来自哪些信号没有说明。
- 这些状态是否直接来自 Codex，还是来自 My-Code-X 与 Codex 的连接层，没有说明。

## Live update

功能目标：

用户需要在 Codex 工作进行中持续看到新内容和内容变化。

需要接收的 Codex 信息：

- Codex notification stream
  - live 更新的主要来源。
- Codex `item/*` runtime notification
  - 用于新增或更新页面内容。
- Codex `turn/*` runtime notification
  - 用于新增或更新页面内容。
- delta notification
  - 用于更新已有内容。
- progress notification
  - 用于更新已有内容或状态。
- completed notification
  - 用于确认内容完成。
- Codex `item/completed`
  - 原文提到 live `Turn` 的内容以它或对应 final event 为最终权威内容。
- 对应 final event
  - 用于确认最终内容。
- Codex 可重建的 `ThreadItem`
  - 用于历史恢复。
- 恢复进行中的 Codex `Thread` 后的后续 notification
  - 用于继续 live 更新。

原文不清晰点：

- `item/*` 包含哪些具体 notification。
- `turn/*` 包含哪些具体 notification。
- delta、progress、completed 的具体 Codex 类型没有列出。
- “对应 final event”具体指哪些 event 没有说明。
- live notification 和恢复得到的 `ThreadItem` 同时存在时，哪个功能点接收哪个来源没有讲清楚。
- 500ms 聚合属于实现策略，不应该放在 projection input design 里。

## Composer related Codex feedback

说明：

Composer 的 `turn/start`、`turn/steer`、`turn/interrupt` 属于 action mapping，不属于 Conversation projection input。

但 Composer 仍然需要接收 Codex 对这些 action 的反馈，用于决定草稿、错误提示和后续 timeline 更新。

需要接收的 Codex 信息：

- Codex 对 `turn/start` request 的接受或拒绝结果。
- Codex 对 `turn/steer` request 的接受或拒绝结果。
- Codex 对 `turn/interrupt` request 的接受或拒绝结果。
- `turn/steer` rejected 信息
  - 原文提到 rejected 时保留草稿并展示非阻塞错误提示。
- 发送请求失败信息
  - 用于恢复草稿并提示用户。
- 请求被接受后的后续 Codex `ThreadItem`
  - 用于展示真正进入历史的内容。
- 请求被接受后的后续 `Codex runtime event`
  - 用于展示 live 变化。

原文不清晰点：

- request accepted / rejected 的 Codex 原生响应结构没有说明。
- `turn/steer` rejected 是 JSON-RPC error response，还是 Codex 正常业务响应，没有说明。
- `turn/interrupt` 被接受后，后续应该接收哪些 Codex 信息来表示中断完成，没有说明。
- Composer 错误提示应该接收 Conversation View notice，还是 Composer-local feedback，没有说明。
