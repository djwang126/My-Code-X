# My-Code-X Context

My-Code-X 是 Codex app-server 的移动端 Web 客户端语境。本文件固定 My-Code-X 自己的产品词汇，并明确它们与 Codex 原生协议词汇的边界。

## Language

### Codex 原生概念

**Thread**:
Codex 原生对话容器，可持久化，也可只存在于内存中。
_Avoid_: Conversation、会话、聊天记录

**Turn**:
Codex 原生的一次用户输入驱动的模型执行。
_Avoid_: 用户消息、一轮问答、Conversation

**ThreadItem**:
Codex `Turn` 内由 app-server 提供的原生可恢复单元。
_Avoid_: Timeline item、UI 卡片、日志

**Codex cwd scope**:
Codex 以 `cwd` 为过滤条件查看历史 `Thread` 的范围。
_Avoid_: Codex Workspace、Workspace、项目

**Codex warning**:
Codex app-server 发出的 warning 类 notification，例如 `warning`、`guardianWarning` 或 `configWarning`。
_Avoid_: Client notice、Page notice、Failure item

**Unscoped Codex error**:
无法归属到具体 Codex `Thread` 的 Codex JSON-RPC error 或 runtime error。
_Avoid_: Failure item、Thread failure、assistant message

**Codex Server request**:
Codex app-server 对客户端侧参与的反向请求，例如 approval、requestUserInput、elicitation、permissions request 或 dynamic tool call。
_Avoid_: Timeline item、Page notice、Composer input


### My-Code-X 产品概念

**Conversation**:
当前选中 Codex `Thread` 的可读工作现场投影。产品语境中它主要指 timeline 阅读内容；领域实现中可包含 `ThreadRef`、`Timeline item[]` 和当前 `Thread` 的 `Composer draft`。
_Avoid_: Thread、页面、完整聊天工作区

**ThreadRef**:
Conversation View 展示当前 Codex `Thread` 所需的轻量引用，包含 `threadId`、标题和 `cwd`。
_Avoid_: Thread、Workspace、完整 thread payload

**Conversation View application state**:
Conversation View 在无选中 `Thread`、恢复中、为空、读取失败、同步、重连或内容可能过期时的页面状态。
_Avoid_: Timeline item、Conversation、ThreadStatus

**Conversation View**:
围绕当前选中 Codex `Thread` 提供 `Conversation` 阅读、`Composer` 输入、`Pending interaction` 展示和页面状态的 My-Code-X 主界面。

**Timeline item**:
My-Code-X timeline 中的一条可展示内容。它可以由 Codex `ThreadItem`、Codex live event 更新，或当前 `Thread` 内明确失败派生而来。
_Avoid_: ThreadItem、任意 UI 卡片

**Message item**:
`Timeline item` 的 `message` 分类，由 Codex `userMessage` 或 `agentMessage` 投影而来。

**Work progress item**:
`Timeline item` 的 `workProgress` 分类，表示当前选中 Codex `Thread` 的某个 `Turn` 内已知工作过程信息。
_Avoid_: 所有非消息 item、日志、Unknown item、plan

**Unknown item**:
`Timeline item` 的 `unknown` 分类，表示 My-Code-X 当前不能专门理解但仍必须保留和展示的信息。
_Avoid_: Failure item、Work progress item、调试 payload

**Failure item**:
`Timeline item` 的 `failure` 分类，表示可归属到当前选中 Codex `Thread` 和 `Turn` 的明确失败。
_Avoid_: Page notice、Client notice、任意错误、assistant message

**Recovering error**:
当前 active `Turn` 中 Codex 仍会继续尝试恢复或重试的错误投影。它属于 **Conversation View** 的临时 overlay，可以靠近 active `Turn` 展示，但不属于 **Timeline item**；最终失败以 `turn/completed` 的 failed 状态为权威。
_Avoid_: Failure item、Timeline item、Page notice

**Pending interaction**:
Codex app-server 对当前 `Thread` 发出的待用户处理反向请求。
_Avoid_: Timeline item、全局弹窗、Client notice、Composer input

**Composer**:
Conversation View 中绑定当前 Codex `Thread` 的输入控制台。它维护当前 `Thread` 的草稿，并根据可靠目标状态触发 `turn/start`、`turn/steer` 或 `turn/interrupt`。

**Composer draft**:
Composer 按 Codex `Thread` 保存的用户输入草稿。请求被接受后清空对应 `Thread` 的已发送草稿；请求失败时保留草稿。
_Avoid_: Timeline item、pending message、browser input state

**My-Code-X Workspace**:
My-Code-X 保存的本机项目目录记录，产品身份是 canonical cwd。
_Avoid_: Codex cwd scope、Thread.cwd、任意 cwd

**Thread list**:
Codex app-server 根据 `Codex cwd scope` 返回的 Codex `Thread` 分页列表。
_Avoid_: Workspace registry、扫描 `~/.codex/sessions` 得到的列表

**Thread action**:
作用于 Codex `Thread` 的操作，由 My-Code-X 编排调用 Codex app-server。
_Avoid_: Workspace 操作、Conversation 操作

**Codex runtime**:
My-Code-X 连接并驱动的 Codex app-server 会话或进程能力抽象。
_Avoid_: My-Code-X runtime、Node runtime、adapter

**Codex runtime event**:
`Codex runtime` 从 Codex app-server 接收到，并经 adapter 规范化后的 typed event。
_Avoid_: Client event、Conversation event、raw notification

**Client action**:
Web client 请求 My-Code-X server 执行的用户意图。
_Avoid_: Codex app-server request、前端 reducer action

**Client event**:
My-Code-X server 推送给 Web client 的前端状态事件。
_Avoid_: Codex runtime event、浏览器 DOM event、raw notification

**Client snapshot**:
My-Code-X server 返回给 Web client 的当前前端状态快照。
_Avoid_: Codex Thread 历史快照、浏览器缓存

**Page notice**:
Conversation View 内不应投影为 `Timeline item`，也不属于 `Recovering error` 或 `Pending interaction` 的 timeline 外提示、错误或警告。
_Avoid_: Failure item、Client notice、Toast

**Codex ACL**:
My-Code-X 在 Codex protocol 与 Conversation domain 之间的解析和转换边界。Codex payload 必须在这里被校验、分类和转换，domain 不直接依赖 raw protocol shape。
_Avoid_: raw notification handler、UI mapper、string parser

## Relationships

- 一个 **My-Code-X Workspace** 的产品身份是该记录的 canonical cwd。
- 一个 **My-Code-X Workspace** 的 canonical cwd 可以作为 Codex `thread/list` 的 `cwd` 参数，从而形成一个 **Codex cwd scope**。
- 一个 **Thread list** 属于 Codex app-server 的查询结果，不属于 **My-Code-X Workspace** registry。
- **Conversation View** 围绕当前选中的 Codex **Thread** 展示一个 **Conversation**。
- 一个 **Conversation** 由 **ThreadRef**、**Timeline item** 列表和当前 **Composer draft** 组成。
- **Composer** 可以触发 **Thread action**，但不用于响应 **Pending interaction**。
- Codex `turn/start`、`turn/steer` 和 `turn/interrupt` 是 **Composer** 触发的 **Thread action**。
- 一个 **Conversation** 投影当前选中的一个 Codex **Thread**。
- 一个 **Thread** 包含零个或多个 **Turn**。
- 一个 **Turn** 可以产生零个或多个 **ThreadItem** 和零个或多个 **Codex runtime event**。
- 一个 **Timeline item** 由 Codex **ThreadItem**、**Codex runtime event** 或当前 **Thread** 内明确失败投影而来。
- **Message item**、**Work progress item**、**Unknown item** 和 **Failure item** 都是 **Timeline item** 的分类。
- **Recovering error** 可以靠近当前 active **Turn** 的 timeline 区域展示，但不是第五类 **Timeline item**。
- **Work progress item** 和 **Unknown item** 的边界由 My-Code-X 产品分类决定，不由当前是否存在专门 renderer 决定。
- Codex `plan` 不属于 **Work progress item**。
- **Page notice** 可以投影为 **Client notice**，但前者是 Conversation View 局部概念，后者是 Web client 全局通知模型。
- Toast 是 **Client notice** 的一种 UI 呈现方式，不是独立领域对象。
- **Codex warning** 和 **Unscoped Codex error** 可以被投影为 **Page notice** 或 **Client notice**，但二者不是同一个概念。
- **Codex runtime event** 可以被投影为 **Client event**，但二者不是同一个概念。
- **Thread action** 可以改变当前选中 Codex **Thread** 或触发 **Conversation** 刷新，但不由 **Conversation** timeline 拥有。
- **Codex ACL** 负责把 Codex **Thread**、**ThreadItem**、live event、warning、error 和 **Server request** 转成 My-Code-X 可处理的 domain/application input。

## Example dialogue

> **Dev:** "用户打开一个 My-Code-X Workspace 后，我们是不是从 registry 里读它的历史 Conversation？"
> **Domain expert:** "不是。My-Code-X Workspace 只提供 canonical cwd；Codex app-server 用这个 cwd 形成 Codex cwd scope，再返回 Thread list。"
>
> **Dev:** "那点击一个 thread 后，Conversation 是不是等于这个 Thread？"
> **Domain expert:** "不是。Thread 是 Codex 原生容器；Conversation 是当前选中 Thread 的可读工作现场投影。"
>
> **Dev:** "Codex 的 agentMessage 是不是直接等于 Timeline item？"
> **Domain expert:** "不是。它会被投影为 Message item；Message item 才是 My-Code-X timeline 里的展示单元。"

## Flagged ambiguities

- “Conversation” 只指当前选中 Codex **Thread** 的可读工作现场投影。
- “Conversation View” 是 My-Code-X 的主界面概念；它包含 **Conversation** 阅读、输入和页面状态等能力。
- “item” 不应裸用：My-Code-X timeline 单元写 **Timeline item**，Codex 原生单元写 **ThreadItem**，Codex notification method 写 Codex `item/*`。
- “error” 不应裸用：timeline 内明确失败写 **Failure item**，timeline 外页面提示写 **Page notice**，可恢复错误写 **Recovering error**。
- “Workspace” 中，保存记录叫 **My-Code-X Workspace**，Codex cwd 查询范围叫 **Codex cwd scope**。
- “runtime event” 中，Codex 侧叫 **Codex runtime event**，Web client 侧叫 **Client event**。
