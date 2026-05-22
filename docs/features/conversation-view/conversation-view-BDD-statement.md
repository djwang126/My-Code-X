# Conversation View BDD Statement

本文档从 `conversation-view-feature-description.md` 提取 Conversation View 当前范围内的用户行为与产品行为。

本文档只描述用户可观察行为与关键产品规则。Codex protocol 字段与 My-Code-X 派生状态的对应关系集中放在文末 `Codex Mapping Appendix`，避免在每个 Scenario 中重复说明。

## Scope and Invariants

### Scenario: 只展示当前 Thread 的可展示内容

Given 用户已选中一个 Codex `Thread`  
When Conversation View 打开  
Then 页面展示该 `Thread` 的可展示内容  
And 不展示其他 `Thread` 的 timeline 内容

### Scenario: 按发生顺序展示 timeline

Given 当前 `Thread` 中存在多条可展示内容  
When 页面渲染 timeline  
Then 可展示内容按发生顺序展示

### Scenario: 不为用户输入与 Codex 回复添加自创文案

Given 页面展示用户输入、Codex 回复、类型标签或错误 message  
When My-Code-X 渲染这些内容  
Then 不额外添加自创解释性文案

### Scenario: 未识别信息不被静默丢弃

Given My-Code-X 收到暂时不能专门理解的未识别信息
When 页面分类该信息  
Then 该信息仍被展示  
And 不被静默丢弃

### Scenario: 失败不伪装成普通回复

Given 收到失败信息  
When 页面渲染  
Then 不将失败信息伪装成 Codex 普通回复

### Scenario: 重复失败去重

Given 收到重复失败信息  
When 页面渲染  
Then 不将重复的失败信息重复展示

### Scenario: 未确认发送成功的输入不进入 timeline

Given 用户点击发送  
And 发送请求尚未被接受  
When 页面渲染 timeline  
Then 不把该输入伪装成已经进入 timeline 的正式内容

## Conversation View Shell

### State Matrix

| State | Given | When | Then |
| --- | --- | --- | --- |
| 无选中 Thread | 用户没有选中 Codex `Thread` | Conversation View 打开 | 页面展示无选中相关提示，即 app 首屏信息 |
| 恢复中且无内容 | 页面正在恢复内容，且当前没有可展示内容 | Conversation View 渲染 | 页面展示恢复中提示 |
| 恢复成功但无内容 | 内容恢复成功，且当前没有可展示内容 | Conversation View 渲染 | 页面展示无可展示内容提示 |
| 恢复失败且无内容 | 内容恢复失败，且当前没有可展示内容 | Conversation View 渲染 | 页面展示恢复失败提示 |
| 已有内容且同步中 | 页面已有可展示内容，新的同步、重连或状态确认正在进行 | Conversation View 渲染 | 页面保留原有内容，并以页面提示展示当前状态 |
| 已有内容但可能过期 | 页面已有可展示内容，且 My-Code-X 无法确认内容是否最新 | Conversation View 渲染 | 页面保留原有内容，并展示内容可能不是最新的 轻提示并持续重试加载 |

### Scenario: 顶部上下文展示

Given 用户已选中 Codex `Thread`  
When Conversation View 渲染顶部区域  
Then 顶部展示当前 `Thread` 标题与所在目录

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
And 工具栏中展示消息对应的时间信息

note: 时间信息只使用来自codex的权威信息，无则不使用

### Scenario: 复制第一条用户输入

Given 一轮对话存在第一条用户输入  
When 用户点击该用户输入工具栏的复制入口  
Then 系统复制对应用户输入原文

### Scenario: 复制最后一条 Codex 回复

Given 一轮对话存在最后一条 Codex 回复  
When 用户点击该回复工具栏的复制入口  
Then 系统复制对应 Codex 回复原文

## Timeline Item Classification and Rendering

### Classification Matrix

| Timeline kind | Source | Rendering intent |
| --- | --- | --- |
| 普通对话内容 | 用户输入和 Codex 回复 | 作为最高阅读优先级内容展示 |
| 工作过程信息 | 工具调用、工具结果、文件变更、网页搜索等 Codex 工作过程信息 | 帮助用户理解 Codex 正在做什么 |
| 失败信息 | 来自 Codex 的明确失败 | 帮助用户排查和决策 |
| 未识别信息 | My-Code-X 暂时不能专门理解的信息 | 保证新类型内容不丢失 |

### Display Policy Matrix

| Timeline kind | Default display | Detail behavior | Special rule |
| --- | --- | --- | --- |
| 普通对话内容 | 直接展开 | 不提供折叠能力 | |
| 工作过程信息 | 默认紧凑，仅展示类型与状态（如有） | 用户可以展开查看结构化字段 | 默认使用通用展示方式，有状态则显示状态，不要求每种来源都有专门 UI |
| 失败信息 | 直接展开且更醒目 | 可以展示通用排查字段 | 不默认折叠，不伪装成普通回复 |
| 未识别信息 | 默认紧凑，仅展示类型与状态（如有） | 用户可以展开查看结构化字段 | 默认使用通用展示方式，有状态则显示状态，不当作失败，不阻断后续阅读 |

### Scenario: 类型视觉区分

Given timeline 中存在不同类型的 timeline item  
When 页面渲染这些 timeline item  
Then 普通对话内容、工作过程信息、失败信息、未识别信息具有清晰视觉区分

### Scenario: 分类稳定可解释

Given 页面需要判断 thread item 类型  
When thread item 被分类  
Then 分类不只依赖文本内容猜测

### Scenario: 工作过程摘要展示

Given 工作过程信息包含类型或状态  
When 页面渲染摘要  
Then 展示命令、工具、搜索、文件变更等类型  
And 展示进行中、完成、失败等上游提供的状态

### Scenario: 复杂内容安全可读

Given 工作过程信息、失败信息或未识别信息包含复杂内容  
When 页面展示详情  
Then 使用安全、可读的通用形式展示

### Scenario: 展开后位置稳定

Given 用户正在阅读 timeline  
When 用户展开工作过程信息或未识别信息详情  
Then 浏览位置保持不变，保持用户正在看的文本位置。

### Scenario: 已知工作过程类型归类

Given thread item 类型是 `hookPrompt`、`reasoning`、`commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`webSearch`、`imageView`、`imageGeneration`、`enteredReviewMode`、`exitedReviewMode` 或 `contextCompaction`  
When 页面分类该 item  
Then 将其识别为工作过程信息

### Scenario: Thread 内失败信息进入 timeline

Given Codex 工作过程中发生归属于当前 `Thread` 的失败信息  
When 页面渲染  
Then 该失败信息展示为 timeline 内的失败信息

### Scenario: 展示失败原因

Given 失败信息包含用户可理解的失败原因  
When 页面渲染失败信息  
Then 优先展示错误 message

## Message Reading

### Scenario: 展示用户文字输入

Given 用户发送了文字输入，发送请求被接受后  
When timeline 渲染  
Then 该输入作为普通对话内容展示

### Scenario: 展示 Codex 文字回复

Given Codex 产生了文字回复  
When timeline 渲染  
Then 该回复作为普通对话内容展示

### Scenario: Codex 输出中更新当前回复

Given Codex 正在输出回复  
When 页面接收到增量内容  
Then 当前回复内容可以被更新

### Scenario: Codex 完成后展示最终内容

Given Codex 回复已完成  
When 页面接收到完成状态  
Then 页面展示最终回复内容

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

## Live Timeline Update

### Scenario: 持续接收新的可展示内容

Given Codex 正在工作  
When Codex 产生新的可展示内容  
Then 页面持续接收并展示新的可展示内容

### Scenario: 已有 timeline item 可被更新

Given timeline 中已有 timeline item  
When 后续进展更新该 timeline item  
Then 页面更新已有 timeline item

### Scenario: 更新保持顺序权威

Given 页面正在接收更新  
When 已有 timeline item 被更新或新 timeline item 进入  
Then 已有 timeline item 顺序根据发生顺序依次排序

### Scenario: 生成中状态

Given 某条 timeline item 正在生成  
When 页面渲染该 timeline item  
Then 表现为进行中状态

### Scenario: 完成后展示最终状态

Given 正在生成的 timeline item 完成  
When 页面接收到完成状态  
Then 页面展示最终内容与状态

### Scenario: 弱网恢复

Given 用户处于弱网、切后台或重连后  
When Conversation View 恢复连接  
Then 页面恢复到当前最新内容与状态  
And 继续接收后续更新

### Scenario: 旧内容阅读时不强制到底部

Given 用户正在查看旧内容  
When 新 timeline item 进入 timeline  
Then 页面不强制把用户拉到底部

### Scenario: 底部阅读时自然跟随

Given 用户已经在 timeline 底部阅读  
When 新 timeline item 进入 timeline  
Then 页面可以自然跟随新 timeline item

### Scenario: 减少闪烁和跳动

Given live update 正在发生  
When 页面持续更新  
Then 更新强调连续性  
And 不制造过多闪烁或跳动

### Scenario: 弱网性能

Given 网络状态较弱  
When 页面持续 live update  
Then 页面保持可用体验  
And 尽可能优化性能

## Page Notice Policy

### Notice Matrix

| Source | Timeline behavior | User visible behavior |
| --- | --- | --- |
| 无法归属到具体 `Thread` 的 Codex 错误 | 不插入 timeline | 作为页面提示展示 |
| My-Code-X 自身错误 | 不插入 timeline | 作为页面提示展示 |
| 连接级 warning 或 config warning | 不插入 timeline | 作为页面提示展示 |
| Composer 发送失败 | 不插入 timeline | 作为页面提示展示 |
| 连接异常或输入暂不可用 | 不插入 timeline | 作为页面提示展示 |

### Scenario: 页面提示使用 banner

Given 页面存在页面提示  
When Conversation View 渲染  
Then 默认使用 banner 轻提示

### Scenario: banner 自动收起

Given banner 已展示  
When 经过短时间  
Then banner 自动收起消失

### Scenario: banner 使用通用样式

Given banner 展示不同类型页面提示  
When 页面渲染  
Then 使用通用样式  
And 不为每种错误类型设计专门视觉

## Composer

### Action Matrix

| Thread state | Input | Required data | Main action | Request |
| --- | --- | --- | --- | --- |
| `idle` | 有文本 | 可靠 `threadId` | 发送普通输入 | `turn/start` |
| `active` | 有文本 | 可靠 `threadId` 与 `expectedTurnId` | 发送追加输入 | `turn/steer` |
| `active` | 无文本 | 可靠 active `turnId` | 中断当前工作 | `turn/interrupt` |
| 无选中 Thread | any | 无可靠 `threadId` | 禁用发送 | none |
| 内容恢复中 | any | `Thread.status` 或 active `turnId` 尚不可靠 | 禁用发送 | none |
| 连接不可用 | any | 无法向 app-server 发送 request | 禁用发送 | none |
| 目标状态不明确 | any | 缺少可靠 `threadId`、active `turnId` 或 steer 条件 | 禁用发送 | none |

### Scenario: 绑定当前 Thread

Given 用户已选中 Codex `Thread`  
When Composer 渲染  
Then Composer 绑定当前 `Thread`

### Scenario: 保存输入草稿

Given 用户在 Composer 输入内容  
When 页面状态变化或暂时不能发送  
Then Composer 保留当前输入草稿
And 前端按当前 `Thread` 保存草稿

### Scenario: 输入多行文本

Given 用户正在 Composer 输入  
When 用户输入多行文本  
Then Composer 支持多行内容

### Scenario: 空文本不能发送

Given Composer 内容为空  
When 用户尝试发送普通输入或追加输入  
Then 发送不可用

### Scenario: 不删改原始输入

Given 用户在 Composer 中输入原文  
When 系统发送请求  
Then 请求携带该原文
And 不对用户原始输入进行任何删改

### Scenario: 工作中中断当前工作需要防误触处理

Given Codex 正在工作  
And Composer 中没有输入内容  
When 用户触发主操作按钮  
Then 系统app层modal确认后再中断当前工作

### Scenario: 发送请求被接受后清空输入草稿

Given 当前 `Thread` 的 Composer 中存在已发送的输入草稿  
When 发送请求被接受  
Then Composer 清空当前 `Thread` 的已发送输入草稿

### Scenario: 发送失败保留输入草稿

Given 当前 `Thread` 的 Composer 中存在待发送的输入草稿  
When 发送请求失败  
Then Composer 保持当前 `Thread` 的输入草稿不变

### Scenario: 移动端 safe area 与软键盘适配

Given 用户在移动端使用 Conversation View  
When 软键盘出现或 safe area 生效  
Then Composer 布局保持可用

### Scenario: 输入框随内容增长

Given 用户输入多行内容  
When 内容高度增长  
Then 输入框从默认低高度增长到最大高度

### Scenario: 超过最大高度后内部滚动

Given 输入内容超过最大高度  
When 用户继续编辑  
Then 输入框内部滚动

### Scenario: 主操作按钮固定右侧

Given Composer 渲染  
When 用户单手操作  
Then 主操作按钮固定在 Composer 右侧并保持可达

### Scenario: 空闲且有输入时主按钮表现为发送

Given 当前 `Thread` 处于 idle
And Composer 中有输入内容
When Composer 渲染主操作按钮
Then 主操作按钮功能为发送普通输入
And 主操作按钮样式表达发送状态

### Scenario: 工作中且有输入时主按钮表现为追加

Given 当前 `Thread` 处于 active
And Composer 中有输入内容
When Composer 渲染主操作按钮
Then 主操作按钮功能为发送补充指令
And 主操作按钮样式表达追加状态

### Scenario: 工作中且无输入时主按钮表现为中断

Given 当前 `Thread` 处于 active
And Composer 中没有输入内容
When Composer 渲染主操作按钮
Then 主操作按钮功能为中断当前工作
And 主操作按钮样式表达中断状态

### Scenario: 不能发送时主按钮表现为不可用

Given 当前没有选中 `Thread`、内容恢复中、连接不可用或目标状态不明确
When Composer 渲染主操作按钮
Then 主操作按钮不可交互
And 主操作按钮样式表达不可用状态

## Codex Mapping Appendix

| Product concept | Codex source |
| --- | --- |
| 当前选中对象 | Codex `Thread` |
| 目标 `Thread` | `Thread.id` |
| 顶部标题 | `Thread.name` 或 `Thread.preview` |
| 顶部目录 | `Thread.cwd` |
| 可展示内容 | `Thread.turns[].items` 或 `Turn.items` 中的 `ThreadItem` |
| 历史顺序 | `Turn` 与 `ThreadItem` 在历史或 live event 中的顺序 |
| 内容恢复 | `thread/resume` 或 `thread/turns/list` |
| 普通用户输入 | `ThreadItem.type = userMessage`，正文来自 `userMessage.content` 中的 `UserInput[]` |
| Codex 文字回复 | `ThreadItem.type = agentMessage`，正文来自 `agentMessage.text` |
| Codex 回复增量 | `item/agentMessage/delta`，通过 `itemId` 关联目标 `agentMessage` |
| 最终 item | `item/completed` |
| item lifecycle | `item/started`、`item/completed`、item-specific delta/progress |
| 工作过程信息 | `commandExecution`、`fileChange`、`mcpToolCall`、`dynamicToolCall`、`collabAgentToolCall`、`webSearch` 等工作过程类 `ThreadItem.type` |
| 工作过程状态 | item 自带字段，例如 `commandExecution.status`、`fileChange.status`、`mcpToolCall.status`、`dynamicToolCall.status` |
| 工作过程详情 | `arguments`、`result`、`error`、`aggregatedOutput`、`changes[].diff` 等结构化字段 |
| 未识别信息 | 未知 `ThreadItem.type`|
| Thread 内失败 | `turn/completed` 中 `turn.status = failed` 与 `turn.error` |
| 失败原因 | `turn.error.message` 或 `error.message` |
| 失败排查字段 | `codexErrorInfo` 或 `additionalDetails` |
| 页面提示来源 | `warning`、`guardianWarning`、`configWarning`、无 `threadId` 的 JSON-RPC error response 或 My-Code-X 本地错误 |
| 空闲发送 | `Thread.status = idle` 时通过 `turn/start` 发送 |
| 工作中追加 | `Thread.status = active` 时通过 `turn/steer` 发送，并需要 `expectedTurnId` |
| 工作中中断 | 通过 `turn/interrupt` 发送，并需要目标 active `turnId` |
| 输入 payload | 用户原文转换为 `turn/start.input` 或 `turn/steer.input` 中的 `UserInput[]` |
| 请求接受 | `turn/start` 或 `turn/steer` 的 success response |
| 请求失败 | `turn/start` 或 `turn/steer` 的 JSON-RPC error response |
