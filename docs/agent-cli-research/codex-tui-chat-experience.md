# Codex TUI 聊天体验实现说明

本文描述上游 Codex TUI 如何实现聊天体验：它提供哪些聊天相关功能点、这些功能点由哪些模块承担、以及它和 app-server 使用了哪些接口。

本文只覆盖上游 Codex TUI，不讨论任何外部 Web UI 或产品适配。

主要参考源码位于相邻仓库 `../codex`：

- `../codex/codex-rs/tui/src/lib.rs`
- `../codex/codex-rs/tui/src/app.rs`
- `../codex/codex-rs/tui/src/app_server_session.rs`
- `../codex/codex-rs/tui/src/app_command.rs`
- `../codex/codex-rs/tui/src/app_event.rs`
- `../codex/codex-rs/tui/src/app/app_server_adapter.rs`
- `../codex/codex-rs/tui/src/app/thread_routing.rs`
- `../codex/codex-rs/tui/src/app/thread_events.rs`
- `../codex/codex-rs/tui/src/app/session_lifecycle.rs`
- `../codex/codex-rs/tui/src/chatwidget.rs`
- `../codex/codex-rs/tui/src/chatwidget/slash_dispatch.rs`
- `../codex/codex-rs/app-server-client/README.md`
- `../codex/codex-rs/app-server/src/in_process.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`

## 1. 总体架构

Codex TUI 的聊天体验不是直接把终端输入映射成模型请求。它中间有一组明确的状态和适配层：

1. `ChatWidget` 负责聊天输入、消息历史、流式输出、审批弹窗、slash command、状态栏等界面状态。
2. `App` 负责 TUI 主循环、app-server 事件路由、thread 切换、session 生命周期和全局 AppEvent 分发。
3. `AppServerSession` 负责把 TUI 的操作转成 app-server 协议请求。
4. `PendingAppServerRequests` 负责登记 app-server 发来的反向请求，并在用户交互后生成对应的响应。
5. `ThreadEventStore` 负责按 thread 保存事件缓存、active turn、历史快照和输入状态。

默认情况下，TUI 不启动一个独立的 `codex app-server` stdio 进程，而是在同进程中启动 in-process app-server runtime。这个 runtime 仍然运行 app-server 的 `MessageProcessor`，只是 transport 从 stdio/websocket 变成内存 channel。

TUI 也支持 remote app-server 模式。remote 模式下，`RemoteAppServerClient` 通过 websocket 连接外部 app-server；embedded 模式下，`InProcessAppServerClient` 通过 typed channel 连接同进程 app-server。两种模式对 TUI 上层暴露统一的 `AppServerClient`。

## 2. 主事件循环

TUI 主循环位于 `tui/src/app.rs`。它同时等待四类事件：

1. TUI 内部事件：`AppEvent`。
2. 当前 active thread 的 buffered event。
3. 终端事件：按键、粘贴、绘制、resize。
4. app-server event stream。

主循环的形状可以概括为：

```text
select {
  app_event_rx.recv()          -> App::handle_event(...)
  active_thread_rx.recv()      -> App::handle_active_thread_event(...)
  tui_events.next()            -> App::handle_tui_event(...)
  app_server.next_event()      -> App::handle_app_server_event(...)
}
```

这个设计让 TUI 不把 app-server event 直接渲染到屏幕，而是先经过 `App` 的路由和状态管理。这样可以支持多 thread、session 恢复、inactive thread 审批、replay、side conversation 和 subagent 切换。

## 3. app-server client 与 transport

TUI 使用 `codex-app-server-client` 作为统一 client 层。它有两种 client：

1. `InProcessAppServerClient`
   - 默认路径。
   - 同进程启动 app-server runtime。
   - 使用 typed channel 发送 `ClientRequest` / `ClientNotification`。
   - 接收 `ServerNotification` / `ServerRequest`。
   - 响应仍保留 app-server 的 JSON-RPC result envelope 语义。

2. `RemoteAppServerClient`
   - remote 模式路径。
   - 通过 websocket 连接外部 app-server。
   - TUI 上层仍调用同一套 typed request API。

TUI 启动 app-server 的逻辑在 `tui/src/lib.rs`：

- `AppServerTarget::Embedded`：调用 `start_embedded_app_server`。
- `AppServerTarget::Remote`：调用 `connect_remote_app_server`。
- 两者都被包装成 `AppServerSession`。

embedded app-server 的底层在 `app-server/src/in_process.rs`。它启动 app-server `MessageProcessor`，并自动执行 `initialize` / `initialized` 握手。

## 4. 会话生命周期功能

TUI 对聊天会话提供这些生命周期能力：

1. 启动新会话
   - 用户进入 TUI 或执行 `/new` 时创建新 thread。
   - 调用 app-server `thread/start`。
   - app-server 返回 thread 元数据和已有 turns。
   - TUI 重建 `ChatWidget` 并注入 thread session。

2. 清屏并开启新会话
   - `/clear` 会清空终端 UI 和当前上下文，但旧会话仍可恢复。
   - 调用 `thread/start`，并使用 `ThreadStartSource::Clear` 标记来源。

3. 恢复历史会话
   - `/resume` 打开 resume picker。
   - 用户选择目标后调用 `thread/resume`。
   - TUI 使用返回的 turns replay 聊天历史。

4. Fork 会话
   - `/fork` 调用 `thread/fork`。
   - TUI 切换到 fork 出来的 thread。
   - 原会话仍保留为可恢复会话。

5. 关闭/取消订阅当前 thread
   - 切换会话或退出时调用 `thread/unsubscribe` 或 shutdown。
   - TUI 会清理 active thread receiver 和本地事件监听任务。

相关实现：

- `App::start_fresh_session_with_summary_hint`
- `App::resume_target_session`
- `App::replace_chat_widget_with_app_server_thread`
- `AppServerSession::start_thread_with_session_start_source`
- `AppServerSession::resume_thread`
- `AppServerSession::fork_thread`

## 5. 输入区与用户消息构造

用户输入由 `ChatWidget` 管理。它不是只读取一段纯文本，而是维护完整 composer 状态：

1. 文本内容。
2. 富文本/mention 对应的 `text_elements`。
3. 本地图片附件。
4. 远程图片 URL。
5. mention binding。
6. 粘贴中的 pending paste。
7. queued input。
8. pending steer。

用户提交消息时，核心逻辑在 `ChatWidget::submit_user_message_with_history_and_shell_escape_policy`。

提交前会做这些检查：

1. 如果 session 尚未配置完成，则把用户消息放入 `queued_user_messages`。
2. 如果文本、图片、远程图片都为空，则拒绝提交。
3. 如果消息包含图片，但当前模型不支持图片，则恢复输入框并显示 warning。
4. 如果输入以 `!` 开头，且 shell escape 允许，则转换为用户 shell command。
5. 如果处于 agent turn running 状态，则不直接渲染用户消息，而是作为 pending steer 或 queued input。

消息会被转换成 `Vec<UserInput>`。TUI 使用的 `UserInput` 类型包括：

- `Text`
- `Image`
- `LocalImage`
- `Skill`
- `Mention`

TUI 会根据输入文本和 mention binding 解析：

1. skill mention
2. plugin mention
3. app connector mention
4. remote/local image
5. 普通文本

最终生成 `AppCommand::UserTurn`，其中包含：

- `items`
- `cwd`
- `approval_policy`
- `permission_profile`
- `model`
- `effort`
- `summary`
- `service_tier`
- `final_output_json_schema`
- `collaboration_mode`
- `personality`

## 6. 用户消息如何提交到 app-server

`ChatWidget` 不直接调用 app-server。它调用 `submit_op`，把 `AppCommand` 发给 `App`。

`App` 在 `submit_thread_op` 中按顺序处理：

1. 先尝试处理本地历史类操作，例如 `AddToHistory`。
2. 再尝试把 `AppCommand` 当成 app-server 反向请求的响应。
3. 再尝试把 `AppCommand` 转成 app-server RPC。
4. 如果都无法处理，则显示错误。

用户消息对应 `AppCommandView::UserTurn`。处理策略是：

1. 如果当前 thread 有 active turn：
   - 调用 `turn/steer`。
   - 用于运行中追加用户输入。
2. 如果当前 thread 没有 active turn：
   - 调用 `turn/start`。
   - 用于开始新的模型回合。
3. 如果 `turn/steer` 返回当前 active turn 不可 steer：
   - TUI 将输入转入 queued/rejected steer 流程。
   - UI 显示 pending input 预览或错误。

使用的 app-server 接口：

```text
turn/start
turn/steer
turn/interrupt
```

`turn/start` 的 TUI 侧参数包括：

- `thread_id`
- `input`
- `cwd`
- `approval_policy`
- `approvals_reviewer`
- `sandbox_policy`
- `permissions`
- `model`
- `service_tier`
- `effort`
- `summary`
- `personality`
- `output_schema`
- `collaboration_mode`

`turn/steer` 的 TUI 侧参数包括：

- `thread_id`
- `input`
- `expected_turn_id`
- `responsesapi_client_metadata`

`turn/interrupt` 的 TUI 侧参数包括：

- `thread_id`
- `turn_id`

## 7. AppCommand 的作用

`AppCommand` 是 TUI 内部的聊天操作抽象。它把 UI 操作和 app-server 请求解耦。

聊天相关 command 包括：

- `UserTurn`
- `Interrupt`
- `RunUserShellCommand`
- `ExecApproval`
- `PatchApproval`
- `ResolveElicitation`
- `UserInputAnswer`
- `RequestPermissionsResponse`
- `ListSkills`
- `Compact`
- `SetThreadName`
- `ThreadRollback`
- `Review`
- `RealtimeConversationStart`
- `RealtimeConversationAudio`
- `RealtimeConversationText`
- `RealtimeConversationClose`

这层抽象的意义是：同一个 UI 操作不一定对应一种 app-server RPC。例如用户按 Enter 可能是：

- 新 turn：`turn/start`
- 运行中追加输入：`turn/steer`
- 回答 app-server 的 `ToolRequestUserInput`
- 响应审批请求
- 执行本地 slash command
- 执行 shell escape command

`AppCommand` 让这些路径先统一成“用户意图”，再由 `App` 决定如何落到 app-server 或本地 UI 状态。

## 8. app-server 通知路由

app-server 事件进入 TUI 后，先由 `App::handle_app_server_event` 处理。

事件分三类：

1. `Lagged`
   - 说明 TUI 消费 app-server event 落后。
   - TUI 会刷新 MCP startup 预期状态，并让 UI 结束不可靠的 startup loading。

2. `ServerNotification`
   - app-server 主动通知。
   - 如果带 thread id，路由到对应 `ThreadEventStore`。
   - 如果是全局通知，直接交给 `ChatWidget` 或更新全局状态。

3. `ServerRequest`
   - app-server 反向请求。
   - 通常需要用户审批或输入。
   - TUI 登记 request id 后展示交互 UI。

thread 归属判断由 `server_notification_thread_target` 和 `server_request_thread_id` 完成。大部分聊天事件都按 `thread_id` 路由，包括：

- `ThreadStarted`
- `ThreadClosed`
- `ThreadNameUpdated`
- `ThreadTokenUsageUpdated`
- `TurnStarted`
- `TurnCompleted`
- `ItemStarted`
- `ItemCompleted`
- `AgentMessageDelta`
- `PlanDelta`
- `ReasoningSummaryTextDelta`
- `ReasoningTextDelta`
- `CommandExecutionOutputDelta`
- `FileChangeOutputDelta`
- `TurnDiffUpdated`
- `TurnPlanUpdated`
- `Error`
- `Warning`
- realtime 相关通知

全局通知包括：

- `AccountUpdated`
- `AccountRateLimitsUpdated`
- `McpServerStatusUpdated`
- `SkillsChanged`
- `ConfigWarning`
- `DeprecationNotice`
- plugin/app/fs/fuzzy search 等非当前 turn 直接渲染事件

## 9. ThreadEventStore 与多 thread 状态

TUI 不假设只有一个聊天 thread。每个 thread 有独立的 `ThreadEventStore`。

`ThreadEventStore` 保存：

- `session`
- `turns`
- `buffer`
- `pending_interactive_replay`
- `active_turn_id`
- `input_state`
- `capacity`
- `active`

它承担这些功能：

1. 缓存 inactive thread 的事件。
2. 记录 active turn id，供 `turn/steer` 判断使用。
3. 记录 pending approval/input，防止切换 thread 时丢失审批。
4. 保存 composer 输入状态，thread 切换回来后恢复。
5. 支持 replay snapshot。
6. 支持 rollback 后清理 buffered event。

TUI 收到 thread notification 时：

1. 写入对应 thread 的 store。
2. 如果该 thread 当前 active，则推入 active receiver。
3. 如果该 thread inactive，但产生了审批/输入请求，则把请求浮到当前 UI，提示用户处理。

## 10. 聊天历史与流式渲染

`ChatWidget` 维护两类渲染对象：

1. committed transcript cells
   - 已经确定的历史单元。
   - 例如用户消息、最终 assistant 消息、已完成命令、patch 结果、warning、session header。

2. active cell
   - 正在变化的活动单元。
   - 例如正在流式输出的 assistant message、正在运行的命令、MCP tool call、hook、patch apply。

这样做的目的：

- 流式输出时可以原地更新 active cell。
- 完成后再把 active cell flush 成 committed history。
- transcript overlay 可以显示 committed cells 加 live tail。
- resize 时可以重新 reflow committed history。

主要渲染事件：

1. `AgentMessageDelta`
   - 调用 `on_agent_message_delta`。
   - 更新 assistant streaming controller。
   - 渲染流式 assistant 文本。

2. `PlanDelta`
   - 调用 `on_plan_delta`。
   - 渲染 proposed plan 的流式内容。

3. `ReasoningSummaryTextDelta`
   - 调用 `on_agent_reasoning_delta`。
   - reasoning 不一定实时显示到主 history，通常累计成 reasoning summary block。

4. `ReasoningTextDelta`
   - 只有启用 `show_raw_agent_reasoning` 时才显示 raw reasoning。

5. `CommandExecutionOutputDelta`
   - 更新执行命令的输出 cell。

6. `FileChangeOutputDelta`
   - 更新 patch apply 输出。

7. `TurnPlanUpdated`
   - 渲染 plan steps。

8. `ItemStarted`
   - 渲染工具调用开始状态，例如 command/MCP/web search。

9. `ItemCompleted`
   - 渲染最终 item。
   - 对 agent message、command execution、file change、MCP tool call、web search、image generation 等使用不同 history cell。

10. `TurnCompleted`
    - 清除 task running 状态。
    - flush active cell。
    - 处理 pending steer 和 queued follow-up。
    - 更新底部状态。

## 11. ThreadItem 到 UI 的映射

app-server 的 `ThreadItem` 是 TUI replay 和 live completed item 渲染的核心数据结构。

TUI 处理的主要 `ThreadItem` 类型：

- `UserMessage`
  - 渲染用户消息。

- `AgentMessage`
  - 渲染 assistant 最终消息。
  - 支持 memory citation。

- `Plan`
  - 渲染计划内容。

- `Reasoning`
  - 渲染 reasoning summary 或 raw reasoning。

- `CommandExecution`
  - 进行中时渲染 command begin。
  - 完成时渲染 stdout/stderr/aggregated output、exit code、duration、status。

- `FileChange`
  - 渲染 patch apply 结果。

- `McpToolCall`
  - 渲染 MCP tool call 结果或错误。

- `WebSearch`
  - 渲染 web search begin/end。

- `ImageView`
  - 渲染 view image tool call。

- `ImageGeneration`
  - 渲染 image generation 结果。

- `EnteredReviewMode` / `ExitedReviewMode`
  - 更新 review mode 状态。

- `ContextCompaction`
  - 渲染“Context compacted”提示。

- `CollabAgentToolCall`
  - 渲染 multi-agent spawn/wait 等协作工具调用。

## 12. app-server 反向请求与审批体验

app-server 可能在 turn 执行中向客户端发 `ServerRequest`。TUI 把这些请求转成 bottom pane 的可交互 UI。

支持的反向请求：

1. `CommandExecutionRequestApproval`
   - 命令执行审批。
   - UI 显示命令、原因、可选决策。
   - 用户可接受、拒绝、接受本 session、带权限修改接受等。

2. `FileChangeRequestApproval`
   - 文件修改审批。
   - UI 显示 patch/file change。
   - 用户接受或拒绝。

3. `PermissionsRequestApproval`
   - 权限提升审批。
   - UI 显示请求的权限 profile。

4. `ToolRequestUserInput`
   - 模型通过工具向用户提问。
   - UI 显示问题和选项。

5. `McpServerElicitationRequest`
   - MCP server 要求用户填写表单或打开 URL。
   - UI 显示 elicitation form 或 URL request。

`PendingAppServerRequests` 保存 request id 与 UI id 的映射。用户完成交互后，TUI 会生成对应 `AppCommand`：

- `ExecApproval`
- `PatchApproval`
- `RequestPermissionsResponse`
- `UserInputAnswer`
- `ResolveElicitation`

然后 `App::try_resolve_app_server_request` 调用：

```text
resolve_server_request(request_id, result)
```

如果 TUI 收到暂不支持的反向请求，会调用：

```text
reject_server_request(request_id, error)
```

## 13. Pending input、steer 与排队体验

TUI 支持用户在模型运行期间继续输入。

它区分几种状态：

1. queued user messages
   - session 尚未 ready 或当前条件不适合立即提交时保存。

2. pending steers
   - 当前 turn 正在运行，用户输入尝试作为 `turn/steer` 追加。
   - 如果 steer 成功，等待 app-server 后续 committed user message 或 turn item。
   - 如果 steer 被拒绝，则转入 rejected steer 队列或恢复到 composer。

3. rejected steer
   - 服务端认为当前 active turn 不可 steer。
   - UI 会显示提示，并保留用户输入。

4. queued follow-up
   - turn 完成后自动发送下一条 queued input。

底部状态栏会显示 pending input preview。这个 preview 来自 queued user messages、pending steers 和 rejected steers。

## 14. Slash command 功能

Slash command 由 `ChatWidget` 本地解析和分发，入口在 `chatwidget/slash_dispatch.rs`。

主要命令和行为：

- `/new`
  - 发送 `AppEvent::NewSession`。
  - 创建新 app-server thread。

- `/clear`
  - 发送 `AppEvent::ClearUi`。
  - 清空当前 UI 并开始新 thread。

- `/resume`
  - 发送 `AppEvent::OpenResumePicker`。
  - 打开会话恢复选择器。

- `/fork`
  - 发送 `AppEvent::ForkCurrentSession`。
  - 调用 app-server `thread/fork`。

- `/init`
  - 如果 `AGENTS.md` 不存在，把初始化 prompt 作为用户消息提交。

- `/compact`
  - 触发 compact。
  - 最终调用 app-server `thread/compact/start`。

- `/review`
  - 打开 review popup 或提交 review request。
  - 最终调用 app-server `review/start`。

- `/rename`
  - 打开重命名 prompt。
  - 最终调用 app-server `thread/name/set`。

- `/model`
  - 打开模型选择 popup。
  - 修改后续 turn 的 model/effort。

- `/fast`
  - 切换 service tier。

- `/realtime`
  - 启动或停止 realtime conversation。

- `/settings`
  - 打开 realtime audio 设置。

- `/personality`
  - 打开 personality 设置。

- `/plan`
  - 切换到 Plan collaboration mode。

- `/goal`
  - 打开或设置 thread goal。

- `/collab`
  - 打开协作模式相关设置。

- `/side`
  - 创建 side conversation。

- `/agent` / `/multi-agents`
  - 打开 agent picker。

- `/approvals`
  - 打开审批策略设置。

- `/permissions`
  - 打开权限设置。

- `/mcp`
  - 显示 MCP 状态或工具列表。

- `/apps`
  - 显示 app connector。

- `/plugins`
  - 显示 plugin marketplace。

- `/diff`
  - 显示当前 turn diff。

- `/status`
  - 显示模型、账号、rate limit、MCP 等状态。

- `/stop`
  - 中断当前 turn。

- `/quit` / `/exit`
  - 退出 TUI。

Slash command 有两个重要约束：

1. 部分命令在 task running 时不可用。
2. side conversation 中只允许一部分命令。

## 15. 多 agent 和 side conversation

TUI 把 subagent 也当成 app-server thread。它维护一个 agent navigation cache，用于：

- agent picker
- agent 名称显示
- keyboard next/previous agent
- closed thread 标记
- side conversation 返回主 thread

相关功能点：

1. 启动或恢复主 thread 后，调用 `thread/loaded/list` 找出当前 app-server 已加载的 thread。
2. 对每个 loaded thread 调用 `thread/read`，读取 agent nickname/role。
3. 找出属于当前 primary thread 的 subagent。
4. 注册到 agent picker。
5. 用户选择 agent 时，切换 active thread。
6. 如果 thread 没有本地 event channel，尝试 `thread/resume` 附加 live thread。
7. 如果不能 live attach，则 fallback 到 `thread/read(include_turns=true)` replay。

这个机制依赖：

- `thread/loaded/list`
- `thread/read`
- `thread/resume`
- 本地 `ThreadEventStore`
- `AgentNavigationState`

## 16. 历史恢复与 replay

TUI 恢复会话后，不为历史专门写一套渲染逻辑，而是把 app-server 返回的 `turns` replay 进同一个 `ChatWidget` 事件处理器。

流程：

1. `thread/resume` 返回 `ThreadResumeResponse`。
2. response 中包含 thread session 和 turns。
3. TUI 重建 `ChatWidget`。
4. 调用 `ChatWidget::replay_thread_turns`。
5. 每个 turn 中的 item 通过 `handle_thread_item` 渲染。
6. 如果 turn 状态是 completed/interrupted/failed，再合成 `TurnCompletedNotification` 做收尾。

这样 live event 和历史 replay 使用同一套 UI 映射，避免历史视图和实时视图不一致。

## 17. 状态栏和辅助聊天体验

TUI 的聊天体验还包括一批围绕对话的辅助功能：

1. 任务运行状态
   - `agent_turn_running`
   - bottom pane task running
   - status indicator

2. token usage
   - app-server 发送 `ThreadTokenUsageUpdated`。
   - TUI 更新 token/context window 状态。

3. rate limit
   - 启动后可异步 prefetch。
   - `/status` 可刷新。
   - `AccountRateLimitsUpdated` 会更新 UI。

4. warning/error
   - `Warning`
   - `GuardianWarning`
   - `ConfigWarning`
   - `DeprecationNotice`
   - retryable/non-retryable `Error`

5. copy support
   - 记录最后 assistant markdown。
   - 支持复制最近 assistant 输出或 transcript。

6. transcript overlay
   - 快捷键打开 transcript 视图。
   - 显示 committed transcript cells 和 active cell live tail。

7. external editor
   - 可以把当前 composer 内容放到外部编辑器编辑。

8. paste burst
   - 粘贴时做 CR/LF 规范化。
   - 对粘贴 burst 做延迟 flush。

9. image paste
   - 支持本地图片附件和远程图片 URL。
   - 根据模型能力启用或禁用。

## 18. Realtime 聊天接口

TUI 包含 realtime conversation 支持。它通过 app-server 的 thread realtime 接口实现：

- `thread/realtime/start`
- `thread/realtime/appendAudio`
- `thread/realtime/appendText`
- `thread/realtime/stop`

对应通知包括：

- `ThreadRealtimeStarted`
- `ThreadRealtimeItemAdded`
- `ThreadRealtimeOutputAudioDelta`
- `ThreadRealtimeSdp`
- `ThreadRealtimeError`
- `ThreadRealtimeClosed`
- `ThreadRealtimeTranscriptDelta`
- `ThreadRealtimeTranscriptDone`

TUI 将这些通知转成 legacy realtime event，再交给 `ChatWidget` 的 realtime UI 状态处理。

## 19. 聊天相关接口清单

### 19.1 TUI 主动调用 app-server 的接口

会话和 thread：

- `initialize`
- `initialized`
- `thread/start`
- `thread/resume`
- `thread/fork`
- `thread/read`
- `thread/list`
- `thread/loaded/list`
- `thread/unsubscribe`
- `thread/name/set`
- `thread/rollback`
- `thread/compact/start`
- `thread/inject_items`

turn：

- `turn/start`
- `turn/steer`
- `turn/interrupt`

审批和反向请求响应：

- `resolve_server_request`
- `reject_server_request`

review：

- `review/start`

shell/realtime/辅助：

- `thread/shellCommand`
- `thread/backgroundTerminals/clean`
- `thread/realtime/start`
- `thread/realtime/appendAudio`
- `thread/realtime/appendText`
- `thread/realtime/stop`

模型、技能、状态和扩展：

- `model/list`
- `skills/list`
- `getAccount`
- `getAccountRateLimits`
- `plugin/list`
- `plugin/read`
- `plugin/install`
- `plugin/uninstall`
- `mcp/server/status/list`

### 19.2 TUI 消费的 app-server 通知

thread/session：

- `ThreadStarted`
- `ThreadClosed`
- `ThreadNameUpdated`
- `ThreadStatusChanged`
- `ThreadTokenUsageUpdated`
- `ThreadGoalUpdated`
- `ThreadGoalCleared`

turn：

- `TurnStarted`
- `TurnCompleted`
- `TurnDiffUpdated`
- `TurnPlanUpdated`

item/stream：

- `ItemStarted`
- `ItemCompleted`
- `AgentMessageDelta`
- `PlanDelta`
- `ReasoningSummaryTextDelta`
- `ReasoningSummaryPartAdded`
- `ReasoningTextDelta`
- `CommandExecutionOutputDelta`
- `TerminalInteraction`
- `FileChangeOutputDelta`
- `FileChangePatchUpdated`
- `McpToolCallProgress`
- `RawResponseItemCompleted`

状态和错误：

- `Error`
- `Warning`
- `GuardianWarning`
- `ConfigWarning`
- `DeprecationNotice`
- `ModelRerouted`
- `ModelVerification`
- `ContextCompacted`

账号和全局状态：

- `AccountUpdated`
- `AccountRateLimitsUpdated`
- `SkillsChanged`
- `McpServerStatusUpdated`
- `McpServerOauthLoginCompleted`
- `AppListUpdated`
- `FsChanged`

realtime：

- `ThreadRealtimeStarted`
- `ThreadRealtimeItemAdded`
- `ThreadRealtimeTranscriptDelta`
- `ThreadRealtimeTranscriptDone`
- `ThreadRealtimeOutputAudioDelta`
- `ThreadRealtimeSdp`
- `ThreadRealtimeError`
- `ThreadRealtimeClosed`

### 19.3 TUI 处理的 app-server 反向请求

- `CommandExecutionRequestApproval`
- `FileChangeRequestApproval`
- `PermissionsRequestApproval`
- `ToolRequestUserInput`
- `McpServerElicitationRequest`

暂不支持或只做 reject/stub 的请求包括：

- `DynamicToolCall`
- legacy `ApplyPatchApproval`
- legacy `ExecCommandApproval`

## 20. 实现上的关键设计点

1. TUI 通过 app-server 语义实现聊天，但保留自己的 UI 状态机。
2. 用户输入先转成 `AppCommand`，再由 `App` 决定走本地处理、反向请求响应、`turn/start` 还是 `turn/steer`。
3. 所有 app-server event 先按 `thread_id` 路由，不直接渲染。
4. 每个 thread 有独立事件缓存和输入状态。
5. live event 和历史 replay 尽量复用同一套 `ChatWidget` 渲染逻辑。
6. 审批和用户输入请求是 app-server 反向请求，不是普通聊天消息。
7. active turn id 是决定 `turn/start` 和 `turn/steer` 的核心状态。
8. 流式输出通过 active cell 原地更新，完成后 flush 到 committed history。
9. slash command 是本地 UI command，有些转成 app-server RPC，有些只改变 TUI 状态。
10. multi-agent 和 side conversation 建立在 app-server thread 之上，而不是独立聊天模型。
