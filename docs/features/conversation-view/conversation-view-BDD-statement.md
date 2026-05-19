# Conversation View BDD Statement

本文档从 `conversation-view-feature-description.md` 提取 Conversation View 当前范围内的用户行为与产品行为。

## Conversation View Shell

### Scenario: 展示选中 Thread 可展示内容

Given 用户已选中一个 Codex `Thread`  
When Conversation View 打开  
Then 页面展示该 `Thread` 的可展示内容

Codex 对应：当前选中对象使用 Codex `Thread`；可展示内容主要来自 `Thread.turns[].items` 或 `Turn.items` 中的 `ThreadItem`。

### Scenario: 按发生顺序展示可展示内容

Given 当前 `Thread` 中存在多条可展示内容  
When 页面渲染 timeline  
Then 可展示内容按发生顺序展示

Codex 对应：顺序来源主要是 `Turn` 与 `ThreadItem` 在历史或 live event 中的顺序。

### Scenario: 无选中 Thread

Given 用户没有选中 Codex `Thread`  
When Conversation View 打开  
Then 页面展示无选中相关提示，即 app 首屏信息

Codex 对应：没有可用的目标 `Thread.id`。

### Scenario: 内容恢复中且无可展示内容

Given 页面正在恢复内容  
And 当前没有可展示内容  
When Conversation View 渲染  
Then 页面展示恢复中提示

Codex 对应：通常对应 `thread/resume` request 尚未返回。

### Scenario: 恢复成功但无可展示内容

Given 内容恢复成功  
And 当前没有可展示内容  
When Conversation View 渲染  
Then 页面展示无可展示内容提示

Codex 对应：`thread/resume` 成功返回，但没有可渲染的 `Turn.items`。

### Scenario: 恢复失败且无可展示内容

Given 内容恢复失败  
And 当前没有可展示内容  
When Conversation View 渲染  
Then 页面展示恢复失败提示

Codex 对应：`thread/resume` 返回 JSON-RPC error response，且本地没有可保留的 `ThreadItem`。

### Scenario: 已有可展示内容时同步中

Given 页面已有可展示内容  
When 新同步、重连或状态确认正在进行  
Then 页面保留原有可展示内容  
And 以非阻塞页面提示展示当前状态

Codex 对应：已有内容来自已缓存的 `ThreadItem`；同步或重连通常对应重新建立订阅、`thread/resume` 或 `thread/turns/list`。

### Scenario: 内容可能不是最新

Given 页面已有可展示内容  
When My-Code-X 无法确认内容是否最新  
Then 页面保留原有可展示内容  
And 展示内容可能不是最新的 banner 轻提示

Codex 对应：这是 My-Code-X 派生状态；可能与 live events 订阅状态、连接状态或最近一次 `thread/resume`结果有关。

### Scenario: 继续接收新的可展示内容

Given 页面已有当前 `Thread` 可展示内容  
When Codex 后续产生新的可展示内容  
Then 页面在已有可展示内容基础上继续追加或更新可展示内容

Codex 对应：新增或更新内容来自 `item/started`、`item/completed`、item-specific delta/progress 等 server notification。

### Scenario: timeline 外提示

Given 存在不适合插入 timeline 的页面提示  
When Conversation View 渲染  
Then 页面在阅读区域外展示该页面提示

Codex 对应：可能来自无法归入 timeline 的 JSON-RPC error response、连接级 `warning` 或 `configWarning`。

### Scenario: 顶部上下文展示

Given 用户已选中 Codex `Thread`  
When Conversation View 渲染顶部区域  
Then 顶部展示当前 `Thread` 标题与所在目录

Codex 对应：标题可来自 `Thread.name` 或 `Thread.preview`；所在目录来自 `Thread.cwd`。

### Scenario: 顶部预留按钮

Given Conversation View 渲染顶部区域  
When 页面展示  
Then 顶部两侧展示两个预留按钮  
And 按钮当前不承担实际功能

### Scenario: 底部输入区域常驻

Given Conversation View 打开  
When 页面渲染  
Then 底部展示 Composer 输入区域

### Scenario: 轮次工具栏

Given timeline 中存在一轮对话  
When 页面展示该轮对话  
Then 第一条用户输入下方展示工具栏  
And 最后一条 Codex 回复下方展示工具栏

Codex 对应：一轮对话对应 Codex `Turn`；用户输入对应 `userMessage`，Codex 回复对应 `agentMessage`。

### Scenario: 复制第一条用户输入

Given 一轮对话存在第一条用户输入  
When 用户点击该用户输入工具栏的复制入口  
Then 系统复制对应用户输入原文

### Scenario: 复制最后一条 Codex 回复

Given 一轮对话存在最后一条 Codex 回复  
When 用户点击该回复工具栏的复制入口  
Then 系统复制对应 Codex 回复原文

### Scenario: 不为用户输入与 Codex 回复添加自创文案

Given 页面展示用户输入或 Codex 回复  
When My-Code-X 渲染内容、类型标签或错误 message  
Then 不额外添加自创解释性文案  

## Typed Conversation Information

### Scenario: 普通对话内容分类

Given 收到用户输入或 Codex 回复  
When 页面分类该 thread item  
Then 该 timeline item 被展示为普通对话内容

Codex 对应：普通对话内容对应 `ThreadItem.type = userMessage` 或 `agentMessage`。

### Scenario: 工作过程信息分类

Given 收到工具调用、工具结果、文件变更、网页搜索等 Codex 工作过程信息  
When 页面分类该 thread item  
Then 该 timeline item 被展示为工作过程信息

Codex 对应：工作过程信息对应 `commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`webSearch` 等除了`plan`以外的工作过程类 `ThreadItem.type`。

### Scenario: 失败信息分类

Given 收到来自 Codex 的明确失败  
When 页面分类该 thread item  
Then 该 timeline item 被展示为失败信息

Codex 对应：最终失败以 `turn/completed` 中 `turn.status = failed` 和 `turn.error` 为权威来源。

### Scenario: 未识别信息分类

Given My-Code-X 收到暂时不能专门理解的 thread item  
When 页面分类该 thread item  
Then 该 timeline item 被展示为未识别信息  
And 不被静默丢弃

Codex 对应：未识别信息对应未知的 `ThreadItem.type`、未知 notification method、未知 enum 或未知字段原始 payload。

### Scenario: 类型视觉区分

Given timeline 中存在不同类型的 timeline item  
When 页面渲染这些 timeline item  
Then 普通对话内容、工作过程信息、失败信息、未识别信息具有清晰视觉区分

Codex 对应：视觉分类依据应来自`method` 或`ThreadItem.type`、item `status` 等结构化字段。

### Scenario: 分类稳定可解释

Given 页面需要判断 thread item 类型  
When thread item 被分类  
Then 分类不只依赖文本内容猜测  
And 用户看到的分类稳定、可解释

Codex 对应：类型判断来源是 `method` 或 `ThreadItem.type`等类型字段。

### Scenario: 失败信息更醒目

Given timeline 中存在失败信息  
When 页面渲染  
Then 失败信息比普通对话内容更醒目

### Scenario: 工作过程默认紧凑

Given timeline 中存在工作过程信息  
When 页面首次渲染  
Then 该 timeline item 默认紧凑展示  
And 用户可以展开查看细节

### Scenario: 未识别信息默认紧凑

Given timeline 中存在未识别信息  
When 页面首次渲染  
Then 该 timeline item 默认紧凑展示  
And 用户可以展开查看细节，将其原始 payload通过通用方式渲染，展示全部字段与参数。

### Scenario: 普通对话不折叠

Given timeline 中存在普通对话内容  
When 页面渲染  
Then 普通对话内容直接展开  
And 不提供折叠能力

### Scenario: 失败信息不默认折叠

Given timeline 中存在失败信息  
When 页面渲染  
Then 失败信息直接展开  
And 不默认折叠

## Message Reading

### Scenario: 展示用户文字输入

Given 用户发送了文字输入  
When timeline 渲染  
Then 该输入作为普通对话内容展示

Codex 对应：用户文字输入位于 `userMessage.content` 中的 `UserInput[]`。

### Scenario: 展示 Codex 文字回复

Given Codex 产生了文字回复  
When timeline 渲染  
Then 该回复作为普通对话内容展示

Codex 对应：Codex 文字回复对应 `ThreadItem.type = agentMessage`，正文来自 `agentMessage.text`。

### Scenario: Codex 输出中更新当前回复

Given Codex 正在输出回复  
When 页面接收到增量内容  
Then 当前回复内容可以被更新

Codex 对应：增量内容来自 `item/agentMessage/delta`，通过 `itemId` 关联目标 `agentMessage`。

### Scenario: Codex 完成后展示最终内容

Given Codex 回复已完成  
When 页面接收到完成状态  
Then 页面展示最终回复内容

Codex 对应：最终回复来自 `item/completed` 中的 `agentMessage.text`。

### Scenario: Markdown 阅读

Given 普通文本内容包含 Markdown  
When 页面渲染普通对话内容  
Then Markdown 可以正常阅读

### Scenario: 代码块展示

Given 普通对话内容包含代码块  
When 页面渲染普通对话内容  
Then 代码块正常展示  
And 使用适合窄屏的横向滚动容器

### Scenario: 代码块复制

Given 普通对话内容包含代码块  
When 用户点击代码块右上角复制按钮  
Then 系统复制该单个代码块内容

### Scenario: 表格展示

Given 普通对话内容包含表格  
When 页面渲染普通对话内容  
Then 表格正常展示

### Scenario: 宽表格横向滚动

Given 普通对话内容包含宽表格  
When 页面渲染表格  
Then 表格使用横向滚动容器

### Scenario: Markdown 链接打开

Given 普通对话内容包含 Markdown 链接  
When 用户点击链接  
Then 链接可以被打开

### Scenario: 区分用户输入与 Codex 回复

Given timeline 中同时存在用户输入与 Codex 回复  
When 页面渲染  
Then 二者视觉上可区分

Codex 对应：用户输入是 `userMessage`，Codex 回复是 `agentMessage`。

### Scenario: 不展示调试字段

Given 普通对话内容存在内部调试字段  
When Message 渲染  
Then 不展示调试字段

Codex 对应：普通消息只展示 `userMessage.content` 或 `agentMessage.text` 中面向用户的内容，不展示内部关联字段如 `item.id`。

## Work Progress Reading

### Scenario: 展示工作过程信息

Given Codex 工作过程中产生工作过程信息  
When timeline 渲染  
Then 页面展示该工作过程信息

Codex 对应：工作过程信息来自工作过程类 `ThreadItem` 或相关 server notification，例如 `item/started`、`item/completed`、tool progress 或 output delta。

### Scenario: 展示工作过程类型

Given 工作过程信息包含类型  
When 页面渲染摘要  
Then 展示命令、工具、搜索、文件变更等大致类型

Codex 对应：类型来源是 `ThreadItem.type`，例如 `commandExecution`、`mcpToolCall`、`webSearch`、`fileChange`。

### Scenario: 展示工作过程状态

Given 工作过程信息包含状态  
When 页面渲染摘要  
Then 展示进行中、完成、失败或上游提供的其他状态

Codex 对应：状态优先来自 item 自带字段，例如 `commandExecution.status`、`fileChange.status`、`mcpToolCall.status`、`dynamicToolCall.status`。

### Scenario: 复杂内容安全可读

Given 工作过程信息包含复杂内容  
When 页面展示详情  
Then 使用安全、可读的形式展示

Codex 对应：复杂内容可能来自 `arguments`、`result`、`error`、`aggregatedOutput`、`changes[].diff` 等字段。

### Scenario: 不为每种来源设计专门 UI

Given 工作过程信息来自不同来源  
When 页面渲染  
Then 默认使用通用展示方式  
And 不要求每种来源都有专门 UI

Codex 对应：不同来源由 `ThreadItem.type` 和相关字段区分；默认可以按通用字段展示。

### Scenario: 展开工作过程详情

Given 工作过程信息默认紧凑展示  
When 用户展开该 timeline item  
Then 页面展示更详细内容

Codex 对应：展开详情展示该 `ThreadItem` 的结构化字段。

### Scenario: 展开后位置稳定

Given 用户正在阅读 timeline  
When 用户展开工作过程/未识别信息详情  
Then 浏览位置保持不变，不跳动

### Scenario: 已知工作过程类型归类

Given thread item 类型是 `hookPrompt`、`reasoning`、`commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`webSearch`、`imageView`、`imageGeneration`、`enteredReviewMode`、`exitedReviewMode` 或 `contextCompaction`  
When 页面分类该 item  
Then 将其识别为 Work progress reading

Codex 对应：这些值来自 `ThreadItem.type`；`plan` 由后续功能额外处理，不纳入此列表。

## Unknown Information Fallback

### Scenario: 未识别信息仍展示

Given My-Code-X 遇到暂时不能专门理解的 thread item  
When timeline 渲染  
Then 仍然展示该 timeline item

Codex 对应：未知 `ThreadItem.type`、未知 enum、未知 notification method 和未知字段应保留原始 payload。

### Scenario: 未识别信息通用字段渲染

Given 未识别信息包含字段内容  
When 用户展开该 timeline item  
Then 页面用通用方法渲染字段

Codex 对应：字段内容来自未知 `ThreadItem` 或 notification 的原始 payload。

### Scenario: 未识别信息状态展示

Given 未识别信息包含状态  
When 页面渲染  
Then 展示该状态

Codex 对应：状态可能来自未知 item 的 `status` 字段或未知 enum 值。

### Scenario: 未识别信息不当作失败

Given My-Code-X 遇到未识别信息  
When 页面分类  
Then 不将其展示为失败信息

Codex 对应：未知 protocol 内容不能仅因未知而等同于 `turn.status = failed` 或 `error` notification。

### Scenario: 未识别信息不阻断阅读

Given timeline 中存在未识别信息  
When 用户继续阅读  
Then 未识别信息不阻断用户阅读后续内容

Codex 对应：未知内容按可展示 payload 保留，不影响后续 `ThreadItem` 渲染。

## Failure Reading

### Scenario: Thread 内失败信息进入 timeline

Given Codex 工作过程中发生归属于当前 `Thread` 的失败信息  
When 页面渲染  
Then 该失败信息展示为 timeline 内的失败信息

Codex 对应：Thread 内最终失败以 `turn/completed` 中 `turn.status = failed` 与 `turn.error` 为权威来源。

### Scenario: 失败位置保留

Given timeline 中存在失败信息  
When 页面展示  
Then 失败信息保留在其发生的工作过程位置

Codex 对应：失败信息可通过 `threadId`、`turnId` 与对应 `Turn` 关联。

### Scenario: 展示失败原因

Given 失败信息包含用户可理解的失败原因  
When 页面渲染失败信息  
Then 优先展示错误 message

Codex 对应：失败原因优先来自 `turn.error.message` 或 `error.message`。

### Scenario: 重复失败去干扰

Given 同一个失败被上游重复报告  
When 页面接收重复失败  
Then 页面不应明显重复干扰用户

Codex 对应：同一失败可能同时通过 `error` 和 `turn/completed.failed` 出现，可按 `threadId + turnId + message + codexErrorInfo` 去重或合并。

### Scenario: 失败不伪装成普通回复

Given 收到失败信息  
When 页面渲染  
Then 不将失败信息伪装成 Codex 普通回复

Codex 对应：失败信息来自 `turn.error` 或 `error` notification，不是 `ThreadItem.type = agentMessage`。

### Scenario: 失败使用通用排查字段

Given 失败信息包含额外排查字段  
When 页面渲染失败详情  
Then 可以使用通用字段展示排查信息

Codex 对应：额外字段可能来自 `codexErrorInfo` 或 `additionalDetails`。

### Scenario: 失败不要求专门错误 UI

Given 收到不同错误类型的失败信息  
When 页面渲染  
Then 不要求为每种错误类型设计专门 UI

Codex 对应：不同失败可共享 `turn.error` / `error` payload 的通用字段展示方式。

## Conversation View Notice

### Scenario: 非 Thread 错误展示为页面提示

Given Codex 错误无法归属到具体 `Thread`  
When 页面接收到该错误  
Then 将其作为页面提示展示  
And 不插入 timeline

Codex 对应：没有可用 `threadId` 的 JSON-RPC error response 或连接级 warning 不归入具体 `Thread` timeline。

### Scenario: My-Code-X 自身错误展示为页面提示

Given My-Code-X 自身发生错误  
When 页面需要告知用户  
Then 将其作为页面提示展示


### Scenario: 页面提示使用 banner

Given 页面存在页面提示  
When Conversation View 渲染  
Then 默认使用 banner 轻提示

Codex 对应：页面提示可能来自 `warning`、`guardianWarning`、`configWarning`、JSON-RPC error response 或 My-Code-X 本地错误。

### Scenario: banner 自动收起

Given banner 已展示  
When 经过短时间  
Then banner 自动收起消失

### Scenario: banner 使用通用样式

Given banner 展示不同类型页面提示  
When 页面渲染  
Then 使用通用样式  
And 不为每种错误类型设计专门视觉

Codex 对应：不同页面提示可能来自 `warning`、`guardianWarning`、`configWarning` 或 JSON-RPC error response。

## Live Update

### Scenario: 持续接收新的可展示内容

Given Codex 正在工作  
When Codex 产生新的可展示内容  
Then 页面持续接收并展示新的可展示内容

Codex 对应：Codex 正在工作通常对应 `Thread.status = active`；新内容来自当前订阅 thread 的 live events。

### Scenario: 已有 timeline item 可被更新

Given timeline 中已有 timeline item  
When 后续进展更新该 timeline item  
Then 页面更新已有 timeline item

Codex 对应：使用 `item.id` / `itemId` 关联同一个 item 的 lifecycle、delta、progress 和最终 item。

### Scenario: 更新保持顺序稳定

Given 页面正在接收更新  
When 已有 timeline item 被更新或新 timeline item 进入  
Then 已有 timeline item 顺序保持稳定

Codex 对应：item 更新通过相同 `itemId` 合并；新 item 来自 `item/started` 或 `item/completed`。

### Scenario: 生成中状态

Given 某条 timeline item 正在生成  
When 页面渲染该 timeline item  
Then 表现为进行中状态

Codex 对应：进行中状态通常来自 `item/started` 后尚未收到对应 `item/completed`，或 item 自带 `status` 字段。

### Scenario: 完成后展示最终状态

Given 正在生成的 timeline item 完成  
When 页面接收到完成状态  
Then 页面展示最终内容与状态

Codex 对应：最终 item 来自 `item/completed`；若是 `agentMessage`，最终权威文本是 `item.text`。

### Scenario: 弱网恢复

Given 用户处于弱网、切后台或重连后  
When Conversation View 恢复连接  
Then 页面尽量恢复到当前最新内容与状态  
And 继续接收后续更新

Codex 对应：恢复可使用 `thread/resume` 或 `thread/turns/list` 读取历史，并继续订阅当前 thread live events。

### Scenario: 旧内容阅读时不强制到底部

Given 用户正在查看旧内容  
When 新 timeline item 进入 timeline  
Then 页面不强制把用户拉到底部

Codex 对应：无直接 Codex protocol 概念；这是 Conversation View 的滚动位置策略。

### Scenario: 底部阅读时自然跟随

Given 用户已经在 timeline 底部阅读  
When 新 timeline item 进入 timeline  
Then 页面可以自然跟随新 timeline item

Codex 对应：无直接 Codex protocol 概念；这是 Conversation View 的滚动位置策略。

### Scenario: 减少闪烁和跳动

Given live update 正在发生  
When 页面持续更新  
Then 更新强调连续性  
And 不制造过多闪烁或跳动

Codex 对应：live update 由 notification 和 delta 驱动；UI 应按 `itemId` 合并更新而不是反复重建内容。

### Scenario: 弱网性能

Given 网络状态较弱  
When 页面持续 live update  
Then 页面保持可用体验  
And 尽可能优化性能

Codex 对应：无直接 Codex protocol 概念；这是 My-Code-X 的客户端性能要求。

## Composer

### Scenario: 绑定当前 Thread

Given 用户已选中 Codex `Thread`  
When Composer 渲染  
Then Composer 绑定当前 `Thread`

Codex 对应：Composer 发送 request 时使用当前 `Thread.id` 作为 `threadId`。

### Scenario: 保存输入草稿

Given 用户在 Composer 输入内容  
When 页面状态变化或暂时不能发送  
Then Composer 保留当前输入草稿

Codex 对应：输入草稿在发送前属于 My-Code-X 本地状态；被发送时转换为 `UserInput[]`。

### Scenario: 输入多行文本

Given 用户正在 Composer 输入  
When 用户输入多行文本  
Then Composer 支持多行内容

Codex 对应：文本发送时转换为 `UserInput` 中 `type = text` 的 payload。

### Scenario: 空文本不能发送

Given Composer 内容为空  
When 用户尝试发送  
Then 发送不可用

Codex 对应：`turn/start.input` 与 `turn/steer.input` 需要有效 `UserInput[]`；空输入不应发送。

### Scenario: 空闲时发送普通输入

Given Codex 当前空闲  
And Composer 中有文本  
When 用户点击主操作按钮  
Then 发送普通输入

Codex 对应：Codex 当前空闲对应 `Thread.status = idle`；普通输入通过 `turn/start` 发送。

### Scenario: 不删改原始输入

Given 用户在 Composer 中输入原文  
When 系统发送请求  
Then 不对用户原始输入进行任何删改

Codex 对应：用户原文转换为 `turn/start.input` 或 `turn/steer.input` 中的 `UserInput[]`，不能删改文本。

### Scenario: 工作中发送追加输入

Given Codex 正在工作  
And Composer 中有输入内容  
When 用户点击主操作按钮  
Then 发送追加输入

Codex 对应：Codex 正在工作对应 `Thread.status = active`；追加输入通过 `turn/steer` 发送，并需要 `expectedTurnId`。

### Scenario: 工作中中断当前工作

Given Codex 正在工作  
And Composer 中没有输入内容  
When 用户触发主操作按钮并通过防误触处理  
Then 中断当前工作

Codex 对应：中断当前工作通过 `turn/interrupt` 发送，需要目标 active `turnId`。

### Scenario: 发送请求被接受后清空输入草稿

Given Composer 中存在已发送的输入草稿  
When 发送请求被接受  
Then Composer 清空该已发送的输入草稿

Codex 对应：`turn/start` 或 `turn/steer` 的 success response 表示请求被接受。

### Scenario: 发送失败保留输入草稿

Given Composer 中存在待发送的输入草稿  
When 发送请求失败  
Then Composer 保持输入草稿不变

Codex 对应：发送失败通常对应 `turn/start` 或 `turn/steer` 的 JSON-RPC error response。

### Scenario: 发送失败非阻塞页面提示

Given 发送失败  
When 页面处理失败结果  
Then 展示非阻塞页面提示

Codex 对应：发送失败通常来自对应 request 的 JSON-RPC error response。

### Scenario: 连接异常非阻塞页面提示

Given 连接异常  
When 用户尝试输入或发送  
Then 页面展示非阻塞页面提示

Codex 对应：连接异常是 My-Code-X 与 app-server 连接状态，不是具体 `ThreadItem`。

### Scenario: 输入暂不可用页面提示

Given 输入暂时不可用  
When 用户查看 Composer  
Then 页面展示非阻塞页面提示

Codex 对应：输入不可用可能来自 `Thread.status = systemError`、缺少可靠 `threadId` / active `turnId`，或 active turn 不可 steer。

### Scenario: 无选中 Thread 禁用发送

Given 当前没有选中 `Thread`  
When Composer 渲染  
Then 保留输入草稿  
And 禁用发送

Codex 对应：没有可用 `Thread.id`，无法构造 `turn/start`、`turn/steer` 或 `turn/interrupt`。

### Scenario: 内容恢复中禁用发送

Given 当前内容正在恢复  
When Composer 渲染  
Then 保留输入草稿  
And 禁用发送

Codex 对应：通常对应 `thread/resume` 尚未成功返回，当前 `Thread.id`、`Thread.status` 或 active `turnId` 尚不可靠。

### Scenario: 连接不可用禁用发送

Given 当前连接不可用  
When Composer 渲染  
Then 保留输入草稿  
And 禁用发送

Codex 对应：无法向 app-server 发送 `turn/start`、`turn/steer` 或 `turn/interrupt` request。

### Scenario: 目标状态不明确禁用发送

Given 当前目标状态不明确  
When Composer 渲染  
Then 保留输入草稿  
And 禁用发送

Codex 对应：目标状态不明确可能是缺少可靠 `threadId`、缺少 active `turnId`、`Thread.status = systemError`，或 active turn 不接受 `turn/steer`。

### Scenario: 发送请求未接受的输入不进入 timeline

Given 用户点击发送  
And 发送请求尚未被接受  
When 页面渲染 timeline  
Then 不把该输入伪装成已经进入 timeline 的正式内容

Codex 对应：在 `turn/start` / `turn/steer` success response 前，输入草稿仍不是已确认的 `userMessage`。

### Scenario: 移动端 safe area 与软键盘适配

Given 用户在移动端使用 Conversation View  
When 软键盘出现或 safe area 生效  
Then Composer 布局保持可用

Codex 对应：无直接 Codex protocol 概念；这是 Conversation View 移动端布局行为。

### Scenario: 输入框随内容增长

Given 用户输入多行内容  
When 内容高度增长  
Then 输入框从默认低高度增长到最大高度

Codex 对应：无直接 Codex protocol 概念；这是 Composer 输入框 UI 行为。

### Scenario: 超过最大高度后内部滚动

Given 输入内容超过最大高度  
When 用户继续编辑  
Then 输入框内部滚动

Codex 对应：无直接 Codex protocol 概念；这是 Composer 输入框 UI 行为。

### Scenario: 主操作按钮固定右侧

Given Composer 渲染  
When 用户单手操作  
Then 主操作按钮固定在 Composer 右侧并保持可达

Codex 对应：无直接 Codex protocol 概念；这是 Composer UI 行为。

### Scenario: 空闲有输入时按钮为发送

Given Codex 当前空闲  
And 用户有输入内容  
When Composer 渲染  
Then 主操作按钮表现为发送

Codex 对应：`Thread.status = idle` 且存在可转换为 `UserInput[]` 的输入时，主操作对应 `turn/start`。

### Scenario: 工作中无输入时按钮为中断

Given Codex 正在工作  
And 用户没有输入内容  
When Composer 渲染  
Then 主操作按钮表现为中断

Codex 对应：`Thread.status = active` 且有可靠 active `turnId` 时，主操作对应 `turn/interrupt`。

### Scenario: 工作中有输入时按钮为追加

Given Codex 正在工作  
And 用户有输入内容  
When Composer 渲染  
Then 主操作按钮表现为追加

Codex 对应：`Thread.status = active` 且有可靠 `expectedTurnId` 时，主操作对应 `turn/steer`。
