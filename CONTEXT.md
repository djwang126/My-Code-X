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
Codex `Turn` 内由 app-server 提供的原生可渲染或可恢复单元。
_Avoid_: Conversation item、UI 卡片、日志

**Codex cwd scope**:
Codex 以 `cwd` 为过滤条件查看历史 `Thread` 的范围。
_Avoid_: Codex Workspace、Workspace、项目

**Codex system notice**:
Codex app-server 发出的系统级提示事件。
_Avoid_: Client notice、Conversation error

### My-Code-X 产品概念

**Conversation**:
当前选中 Codex `Thread` 的只读 timeline 投影。
_Avoid_: Thread、页面、完整聊天工作区

**Conversation item**:
My-Code-X 面向 Web client 的 timeline 展示单元，由 Codex `ThreadItem` 或 `Codex runtime event` 投影而来。
_Avoid_: ThreadItem、任意 UI 卡片

**Work trace**:
当前选中 Codex `Thread` 的某个 `Turn` 内，由已知 Codex 非消息 `ThreadItem` 或 `Codex runtime event` 投影出的 `Conversation item`。
_Avoid_: 所有非消息 item、日志、Unknown item

**Unknown item**:
来自当前选中 Codex `Thread` 或 `Turn`，但 My-Code-X 当前没有专门产品分类或样式的 Codex item 投影。
_Avoid_: Error item、Work trace、调试 payload

**Error item**:
可归属到当前选中 Codex `Thread` 和 `Turn` 的 conversation-scoped 错误投影。
_Avoid_: Client notice、任意错误、assistant message

**Pending interaction**:
Codex app-server 对当前 `Thread` 或 `Turn` 发出的待用户处理反向请求。
_Avoid_: Conversation item、全局弹窗、Client notice

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

**Client notice**:
My-Code-X server 返回或推送给 Web client 的 timeline 外提示、错误或警告。
_Avoid_: Codex system notice、Error item、Conversation item

## Relationships

- 一个 **My-Code-X Workspace** 的产品身份是该记录的 canonical cwd。
- 一个 **My-Code-X Workspace** 的 canonical cwd 可以作为 Codex `thread/list` 的 `cwd` 参数，从而形成一个 **Codex cwd scope**。
- 一个 **Thread list** 属于 Codex app-server 的查询结果，不属于 **My-Code-X Workspace** registry。
- 一个 **Selection** 最多指向一个 **My-Code-X Workspace** 和一个 Codex **Thread**。
- 一个 **Conversation** 投影当前选中的一个 Codex **Thread**。
- 一个 **Thread** 包含零个或多个 **Turn**。
- 一个 **Turn** 可以产生零个或多个 **ThreadItem** 和零个或多个 **Codex runtime event**。
- 一个 **Conversation item** 由 Codex **ThreadItem** 或 **Codex runtime event** 投影而来。
- **Work trace**、**Unknown item** 和 **Error item** 都是 **Conversation item** 的分类。
- **Pending interaction** 可以与 **Conversation** 视觉相邻，但不属于 **Conversation** timeline。
- **Codex system notice** 可以被投影为 **Client notice**，但二者不是同一个概念。
- **Codex runtime event** 可以被投影为 **Client event**，但二者不是同一个概念。
- **Thread action** 可以改变当前 **Selection** 或触发 **Conversation** 刷新，但不由 **Conversation** timeline 拥有。

## Example dialogue

> **Dev:** "用户打开一个 My-Code-X Workspace 后，我们是不是从 registry 里读它的历史 Conversation？"
> **Domain expert:** "不是。My-Code-X Workspace 只提供 canonical cwd；Codex app-server 用这个 cwd 形成 Codex cwd scope，再返回 Thread list。"
>
> **Dev:** "那点击一个 thread 后，Conversation 是不是等于这个 Thread？"
> **Domain expert:** "不是。Thread 是 Codex 原生容器；Conversation 是当前选中 Thread 的只读 timeline 投影。"
>
> **Dev:** "审批请求要不要作为 Conversation item 插到 timeline？"
> **Domain expert:** "不要。那是 Pending interaction，可以靠近 Conversation 展示，但不属于 timeline。"

## Flagged ambiguities

- “Conversation” 曾被用来泛指 Codex 对话、页面和 timeline；已解决：**Conversation** 只指当前选中 Codex **Thread** 的只读 timeline 投影。
- “Workspace” 曾被用来同时表示 My-Code-X 保存记录和 Codex cwd 查询范围；已解决：保存记录叫 **My-Code-X Workspace**，Codex cwd 查询范围叫 **Codex cwd scope**。
- “runtime event” 曾可能混指 Codex 事件和浏览器 SSE 事件；已解决：Codex 侧叫 **Codex runtime event**，Web client 侧叫 **Client event**。
- “notice” 曾可能混指 Codex 系统提示和 My-Code-X 前端提示；已解决：Codex 侧叫 **Codex system notice**，Web client 侧叫 **Client notice**。
- “Work trace” 曾可能表示所有非消息 item；已解决：**Work trace** 只表示已知 Codex 非消息工作痕迹，**Unknown item** 和 **Error item** 独立分类。
