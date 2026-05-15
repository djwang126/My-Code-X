# Feature-Pending Interaction

## Summary

Pending Interaction 是 My-Code-X 在 timeline 和 Composer 之外承载 Codex app-server `ServerRequest` 的决策与输入区域。它把原生 Codex 的 server-initiated JSON-RPC request 转成用户可理解、可操作、可恢复的移动端交互。

Pending Interaction 的目标不是展示协议字段，而是帮助用户在远程和手机场景下快速、安全地完成授权、拒绝、取消、填写表单、刷新账号或提供工具结果。原始 request `id`、`method`、`params` 必须被系统保留，但默认只显示用户做决定所需的信息。

## Capability Sections

### Pending interaction surface

Description:

Pending interaction surface 是 Conversation View 内 timeline 外的固定决策区域。它展示当前选中 Codex `Thread` 或全局 app-server 需要用户处理的 pending interaction，并提供对应响应入口。

Functional Requirements:

- 页面在 timeline 外展示 pending interactions。
- Pending interaction 不作为 `Conversation item` 进入 timeline。
- Pending interaction 必须保留原生 Codex request `id`、`method`、`params` 和接收时间。
- Pending interaction 必须保留可识别 scope，例如 `global`、`thread`、`turn`、`item`。
- Pending interaction 必须能关联 `threadId`、`turnId`、`itemId`、`callId`、`approvalId` 等原生字段；缺失字段保持缺失，不伪造。
- 当前选中 `Thread` 有 pending interaction 时，页面展示 thread-scoped interactions。
- 存在 global pending interaction 时，页面可在当前 thread 之外展示它，例如 auth refresh。
- 同一 scope 内存在多个 pending interactions 时，页面按 Codex request 到达顺序展示或排队。
- 每个 pending interaction 展示请求类型、用户可读摘要、关键风险信息和可用操作。
- 每个 pending interaction 展示它是否仍可响应，例如 `open`、`submitting`、`resolved`、`expired`。
- 用户提交响应后，interaction 进入 submitting 状态，直到后端确认或失败。
- 收到 Codex `serverRequest/resolved` 后，对应 thread-scoped interaction 从 active 区域移除。
- 若用户正在操作时 interaction resolved 或 expired，页面展示轻量提示，不能继续提交旧响应。
- Pending interaction 的响应不通过 Composer。
- Composer 可以保留草稿，但不能让用户误以为输入框用于回答 pending interaction。

UX Decisions:

- Pending interaction surface 固定展示在 Composer 上方。
- Pending interaction 的视觉层级高于 Composer 和普通 transient status。
- 只展示当前决策所需的主信息；协议字段进入折叠详情。
- 多个 pending interactions 不应同时展开大量内容；默认突出最早需要处理的一项。
- 高影响操作使用防误触交互，例如二次确认、长按或滑动确认。
- 已过期 interaction 使用低干扰提示，不保留主要操作按钮。

### Shared interaction header

Description:

Shared interaction header 为所有 pending interaction 提供一致的标题、来源和状态表达，让用户在手机端快速判断“系统现在要我决定什么”。

Functional Requirements:

- Header 展示用户可读类型名。
- Header 展示来源 scope，例如当前 `Thread`、当前 `Turn`、global。
- Header 可展示简短状态，例如 `Waiting`、`Submitting`、`Resolved`、`Expired`。
- Header 不以 Codex request id 作为主标题。
- Header 不默认展示 JSON-RPC method。
- Header 在 debug details 中保留 method 和 request id。
- Header 应区分用户决策、用户输入、账号刷新、客户端工具调用等交互类别。

UX Decisions:

- 标题使用具体动词和对象，例如 `Run command`、`Review file changes`、`Grant permissions`。
- 状态文案短，不解释协议生命周期。
- 若 interaction 属于非当前 thread，应明确提示来源，避免用户把它当作当前对话请求。

### Shared visible details

Description:

Shared visible details 是每类 pending interaction 默认展示的信息集合。它只展示用户判断所需的信息，不展示完整 raw payload。

Functional Requirements:

- 每个 interaction 必须展示 primary subject。
- 每个 interaction 必须展示 reason 或 message，如果原生 request 提供。
- 每个 interaction 必须展示会影响用户决策的 scope，例如 one-time、turn、session、persistent。
- 每个 approval 类 interaction 必须展示 approve、decline、cancel 的语义差异。
- 每个 interaction 必须把危险或高影响信息放在摘要区域，而不是只放在详情里。
- 如果字段为空或不适用，不展示空字段占位。
- 如果信息来自 best-effort 字段，例如 `commandActions`，应按辅助信息处理，不作为唯一事实来源。

UX Decisions:

- 默认摘要控制在手机一屏内可扫读。
- 详细信息可折叠展开。
- 复杂 JSON 使用字段列表或格式化代码块，但默认折叠。
- 主体内容优先于 metadata。

### Shared hidden details

Description:

Shared hidden details 为排查和高级用户提供原生协议信息，但不干扰普通决策。

Functional Requirements:

- 折叠详情中展示 Codex `method`。
- 折叠详情中展示 request `id`。
- 折叠详情中展示 `threadId`、`turnId`、`itemId`、`callId`、`approvalId` 等 correlation ids。
- 折叠详情中可展示 raw params。
- 折叠详情中可展示 response preview 或提交失败信息。
- Secret、access token 和用户填写的 secret answer 不能以明文显示在详情里。

UX Decisions:

- Debug details 不默认展开。
- Debug details 使用低视觉权重。
- 不把 Rust / core 内部类型名作为用户主文案，例如 `ReviewDecision`、`ServerRequestPayload`、`Op::ExecApproval`。

### Shared action handling

Description:

Shared action handling 统一管理 pending interaction 的提交、失败、过期和重复操作，保证用户响应不会丢失或误发。

Functional Requirements:

- 用户选择操作后，客户端必须向后端提交对应 interaction id 和用户输入。
- 后端必须用原始 Codex request id 响应 app-server。
- 提交期间禁用重复提交。
- 提交失败时，保留用户已选操作或已填输入。
- 提交失败时展示非阻塞错误。
- 如果 interaction 已 resolved，客户端不能再次提交。
- 如果 interaction 被 turn transition 清理，状态变为 expired 或 resolved。
- 如果用户选择 `cancel` 类高影响操作，应明确提示它会中断当前 turn。
- 如果用户选择 session 或 persistent 类操作，应明确提示作用范围。
- 如果 Codex 提供 `availableDecisions`，操作入口必须以它为准。
- 如果 Codex 没有提供 `availableDecisions`，操作入口按对应 method 的协议默认能力生成。

UX Decisions:

- `accept` 和 `decline` 是常规按钮。
- `cancel` 是破坏性按钮，视觉上与 decline 区分。
- `acceptForSession`、policy amendment、persistent grant 等不是普通 accept 的默认误触入口。
- 表单提交前显示必填校验。
- 用户输入型 interaction 不使用 Composer。

### Command execution approval

Description:

Command execution approval 对应 Codex `item/commandExecution/requestApproval`。它让用户审批一次命令、网络访问、命令级额外权限或 policy amendment。

Functional Requirements:

- Interaction 类型为 approval。
- 标题使用 `Run command` 或 `Allow network access`，取决于 request 是否为 network-only prompt。
- 默认展示 `command`，如果存在。
- 默认展示 `cwd`，如果存在。
- 默认展示 `reason`，如果存在。
- 默认展示 `networkApprovalContext.host` 和 `networkApprovalContext.protocol`，如果存在。
- 默认展示 `additionalPermissions` 的高风险摘要，如果存在。
- 默认展示 `proposedExecpolicyAmendment` 的作用说明，如果存在。
- 默认展示 `proposedNetworkPolicyAmendments` 的 host 和 allow / deny action，如果存在。
- 默认展示 `availableDecisions` 对应的可选操作，如果存在。
- 默认可展示 `commandActions` 的用户可读摘要，例如 read、list files、search、unknown。
- 不默认展示 `approvalId`。
- 不默认展示完整 parsed command JSON。
- 不默认展示 raw params。
- `accept` 响应 Codex `{ decision: "accept" }`。
- `acceptForSession` 响应 Codex `{ decision: "acceptForSession" }`。
- `acceptWithExecpolicyAmendment` 必须携带 selected `execpolicy_amendment`。
- `applyNetworkPolicyAmendment` 必须携带 selected `network_policy_amendment`。
- `decline` 响应 Codex `{ decision: "decline" }`。
- `cancel` 响应 Codex `{ decision: "cancel" }`。

UX Decisions:

- 命令字符串是最高优先级内容，使用 monospace 展示。
- `cwd` 展示为次要上下文。
- network host 使用高可见度展示，避免用户只看到 URL 或完整 JSON。
- `additionalPermissions.network.enabled` 为 true 时，明确显示网络权限请求。
- 文件系统 write 权限比 read 权限有更高视觉风险。
- `acceptForSession`、execpolicy amendment、network policy amendment 使用二级入口，避免误触。
- `cancel` 文案应体现会中断当前 turn。
- 如果只有 network approval context 而没有 command，页面不应显示空命令区域。

### File change approval

Description:

File change approval 对应 Codex `item/fileChange/requestApproval`。它让用户审批一次文件修改或 session-scoped write root 请求。

Functional Requirements:

- Interaction 类型为 approval。
- 标题使用 `Review file changes`。
- 默认展示 affected files 列表。
- 默认展示文件变化摘要，例如新增、修改、删除数量。
- 默认展示 `reason`，如果存在。
- 默认展示 `grantRoot`，如果存在。
- 如果当前 timeline 中存在对应 `fileChange` item，应从该 item 展示 proposed changes。
- 如果暂时没有对应 item，仍展示 request 本身，并提示 waiting for change details。
- 完整 diff 默认折叠。
- 用户可以展开查看文件级 diff 或 change details。
- `accept` 响应 Codex `{ decision: "accept" }`。
- `acceptForSession` 响应 Codex `{ decision: "acceptForSession" }`。
- `decline` 响应 Codex `{ decision: "decline" }`。
- `cancel` 响应 Codex `{ decision: "cancel" }`。
- 不默认展示 `itemId`。
- 不默认展示 raw patch payload。

UX Decisions:

- 文件路径是主要内容。
- 写入 root 或跨 workspace 变化使用明显风险提示。
- 完整 diff 不默认占满移动端页面。
- `acceptForSession` 需要说明只影响后续同类文件变化审批，不等于无限制授权。
- `cancel` 使用破坏性样式。

### Permissions request approval

Description:

Permissions request approval 对应 Codex `item/permissions/requestApproval`。它让用户处理 `request_permissions` 工具提出的额外权限请求。

Functional Requirements:

- Interaction 类型为 approval。
- 标题使用 `Grant permissions`。
- 默认展示 `reason`，如果存在。
- 默认展示 `cwd`。
- 默认展示请求的 network 权限。
- 默认展示请求的 file system read 权限。
- 默认展示请求的 file system write 权限。
- 默认展示 `entries` 中的 path、glob pattern、special path 和 access。
- 如果 request 使用 legacy `read` / `write` 字段，也必须展示。
- 用户必须能只授予 requested permissions 的 subset。
- 用户不能授予 request 中没有请求的权限。
- 用户可以选择 `turn` 或 `session` scope，如果服务端 response 支持。
- `strictAutoReview` 如果作为可选项出现，只能和 `turn` scope 一起提交。
- 如果用户拒绝全部权限，响应 Codex 空 permissions。
- 不默认展示完整 permission JSON。
- 不默认展示 `itemId`。

UX Decisions:

- 权限以能力矩阵展示：Network、Read、Write。
- Write 路径比 Read 路径视觉权重更高。
- Session scope 选择必须显式，不作为默认隐藏行为。
- 如果 request 同时包含 network 和 file system 权限，允许用户分别选择。
- `strictAutoReview` 使用明确说明，不与普通 approval 混在一起。

### Tool request user input

Description:

Tool request user input 对应 Codex `item/tool/requestUserInput`。它让用户回答工具提出的一个或多个问题。

Functional Requirements:

- Interaction 类型为 form。
- 标题使用问题组标题或 `Provide input`。
- 每个 question 展示 `header`。
- 每个 question 展示 `question` 正文。
- 每个 question 根据 `options` 展示选项控件。
- `options` 为 null 时，展示自由输入控件。
- `isOther` 为 true 时，提供 other 输入入口。
- `isSecret` 为 true 时，输入内容必须遮蔽。
- 用户提交时，按 question id 生成 answers map。
- 每个 answer 使用 string array。
- 表单校验失败时不提交。
- 提交失败时保留已填答案。
- 不默认展示 `threadId`、`turnId`、`itemId`。
- 不默认展示 raw question JSON。

UX Decisions:

- 这是用户输入表单，不使用 approval 样式。
- 问题顺序保持 Codex 原始顺序。
- Secret 输入默认不可见，可提供临时显示控制。
- 多选和单选由 options 和业务约束决定；如果协议未给明确多选约束，默认按单选或自由输入处理需要在实现时固定。
- 提交按钮文案使用 `Submit` 或具体动作，不使用 `Accept`。

### MCP server elicitation

Description:

MCP server elicitation 对应 Codex `mcpServer/elicitation/request`。它让用户响应 MCP server 的 form 或 URL elicitation。

Functional Requirements:

- Interaction 类型为 form 或 approval-like form，取决于 `mode` 和 `_meta`。
- 默认展示 `serverName`。
- 默认展示 `message`。
- 默认展示 `turnId` 是否缺失时的弱提示，如果它影响当前上下文归属。
- `mode = form` 时，展示 `requestedSchema` 对应表单。
- `mode = url` 时，展示 URL hostname 和完整 URL 的可展开详情。
- `mode = url` 时，展示 open URL 入口。
- `_meta.codex_approval_kind = "mcp_tool_call"` 时，展示 MCP tool approval 类型说明。
- `_meta.persist` 存在时，展示可用 persistence choices，例如 session 或 always。
- 用户接受时响应 `{ action: "accept", content, _meta }`。
- 用户拒绝时响应 `{ action: "decline", content: null, _meta }`。
- 用户取消时响应 `{ action: "cancel", content: null, _meta }`。
- 不默认展示完整 `_meta`。
- 不默认展示完整 requestedSchema JSON。
- 不默认展示 `elicitationId`，除非 URL mode 详情展开。

UX Decisions:

- `serverName` 是来源可信度判断的重要信息，应靠前展示。
- URL mode 默认突出 hostname，而不是长 URL。
- Form mode 按 schema 生成控件；无法支持的 schema 以 raw schema fallback 展示并阻止盲目 accept。
- Accept / Decline / Cancel 文案要区别清楚。
- Persistent MCP approval 必须二次确认。

### ChatGPT auth token refresh

Description:

ChatGPT auth token refresh 对应 Codex `account/chatgptAuthTokens/refresh`。它让客户端在 Codex 外部 auth token 失效时刷新账号 token。

Functional Requirements:

- Interaction 类型为 auth。
- Scope 为 global。
- 标题使用 `Refresh ChatGPT session`。
- 默认展示 refresh `reason`。
- 默认展示 `previousAccountId`，如果存在。
- 不展示 access token。
- 不展示 refresh response token details。
- 用户可以触发重新登录或刷新 token 流程。
- 成功后后端响应 Codex `{ accessToken, chatgptAccountId, chatgptPlanType }`。
- 用户拒绝或刷新失败时，后端应返回 JSON-RPC error 或保持失败状态，由 auth flow 决定。
- 该 interaction 不依赖当前 selected thread。
- 该 interaction 不等待 `serverRequest/resolved` 清理。

UX Decisions:

- Auth refresh 不放在某个 thread 的工作审批文案下。
- 如果用户正在别的 thread，仍应明确这是账号状态请求。
- Token 和敏感字段永不在 UI 明文展示。
- 如果刷新需要打开外部网页登录，展示明确的账号上下文。

### Dynamic tool call

Description:

Dynamic tool call 对应 Codex `item/tool/call`。它请求客户端执行一个 dynamic tool，并把结果返回 Codex。它不一定需要人类决策，但当工具无法自动完成或需要用户提供结果时，应作为 pending interaction 呈现。

Functional Requirements:

- Interaction 类型为 tool-response。
- 默认展示 `tool`。
- 默认展示 `namespace`，如果存在。
- 默认展示 arguments 摘要。
- 如果工具可自动执行，不一定展示为用户 pending interaction。
- 如果工具需要用户输入或确认，展示对应输入控件。
- 用户或客户端提交后，响应 Codex `{ contentItems, success }`。
- `contentItems` 支持 `inputText`。
- `contentItems` 支持 `inputImage`。
- `success = false` 时必须有可读失败信息。
- 不默认展示完整 arguments JSON。
- 不默认展示 `callId`。

UX Decisions:

- Dynamic tool call 默认低于 human approval 的视觉优先级。
- 如果只是后台 client capability 调用，UI 可只显示状态，不要求用户操作。
- 如果需要用户手动填写 tool result，应明确这是工具结果，不是普通聊天回复。
- 图片结果应显示预览或文件/URL 摘要，避免只显示 data URL。

### Legacy apply patch approval

Description:

Legacy apply patch approval 对应 Codex `applyPatchApproval`。它来自 deprecated legacy APIs，但 My-Code-X 仍应兼容展示。

Functional Requirements:

- Interaction 类型为 approval。
- 标题使用 `Review file changes`。
- `conversationId` 映射为 thread 归属。
- 默认展示 `fileChanges` 摘要。
- 默认展示 `reason`，如果存在。
- 默认展示 `grantRoot`，如果存在。
- 使用 legacy `ReviewDecision` 响应 Codex。
- 支持 approved、approved_for_session、denied、abort。
- 不默认展示 raw legacy payload。

UX Decisions:

- Legacy apply patch approval 与 v2 file change approval 使用一致视觉。
- Debug details 中标记 method 为 legacy。

### Legacy exec command approval

Description:

Legacy exec command approval 对应 Codex `execCommandApproval`。它来自 deprecated legacy APIs，但 My-Code-X 仍应兼容展示。

Functional Requirements:

- Interaction 类型为 approval。
- 标题使用 `Run command`。
- `conversationId` 映射为 thread 归属。
- 默认展示 `command` argv 的 joined command 文本。
- 默认展示 `cwd`。
- 默认展示 `reason`，如果存在。
- 默认展示 parsed command 摘要，如果存在。
- 使用 legacy `ReviewDecision` 响应 Codex。
- 支持 approved、approved_for_session、denied、abort。
- 不默认展示 raw legacy payload。

UX Decisions:

- Legacy exec command approval 与 v2 command execution approval 使用一致视觉。
- Debug details 中标记 method 为 legacy。

### Resolved and expired interactions

Description:

Resolved and expired interactions 管理 pending interaction 消失后的用户反馈，避免用户在移动端误以为操作丢失或页面异常。

Functional Requirements:

- 收到 `serverRequest/resolved` 后，对应 interaction 从 active 区域移除。
- 如果 interaction 正在提交，resolved 后显示提交完成状态或直接移除。
- 如果 interaction 尚未提交但被 resolved，显示已过期或已被 Codex 清理。
- 如果 interaction 所属 thread 不再 active，保留后端状态，但当前页面不展示为可操作。
- 如果同一个 request 被 replay，不能创建重复 active interaction。
- 如果 response 失败，interaction 保持 open 或 failed-submittable 状态。

UX Decisions:

- Resolved 状态不长时间占用主决策区域。
- Expired 状态使用短提示。
- 不向用户展示 `turnTransition` 作为主文案。

### Mobile safety behavior

Description:

Mobile safety behavior 针对手机端误触、弱网和远程操作风险，统一约束 pending interaction 的关键行为。

Functional Requirements:

- 高风险 accept 操作需要防误触处理。
- 高风险操作包括 write 权限、network 权限、session scope、persistent policy、turn cancel、auth refresh。
- 弱网提交时必须显示 submitting。
- 弱网提交失败不能清空表单。
- 长命令、长路径、长 URL 必须支持换行或横向滚动，不能挤压按钮。
- 按钮文案必须在窄屏完整可读。
- Secret 输入不能被复制到 debug payload。

UX Decisions:

- Primary action 不固定为 accept；根据风险和请求类型决定。
- Dangerous action 使用独立样式。
- Session / persistent 类操作比 one-time accept 更难误触。
- 用户正在编辑表单时，resolved 事件不应造成静默丢失；需要短提示。

### Interaction priority

Description:

Interaction priority 决定多个 pending interactions 同时存在时的展示顺序和主交互焦点。

Functional Requirements:

- Global auth interaction 可以高于 thread-scoped interactions。
- 当前 selected thread 的 interactions 高于非当前 thread interactions。
- 同一 thread 内，较早到达的 request 优先。
- `cancel`、`decline`、`accept` 等操作不因 priority 改变语义。
- 用户可以查看同 thread 的其他 pending interactions。
- 非当前 thread 的 pending interaction 不应覆盖当前 thread 的核心工作，除非是 global blocker。

UX Decisions:

- 默认展开最高优先级 interaction。
- 其他 interactions 以紧凑队列显示。
- 队列项显示类型、摘要和状态。

## Out of Scope

- 原生 Codex app-server 协议详解。
- Conversation timeline item 的渲染设计。
- Composer 的输入、steer、interrupt 详细设计。
- 权限系统和 sandbox policy 的底层实现。
- Codex TUI 的 pending request UI 复刻。
- 动态工具注册和工具发现体验。
- Auth login 的完整账号管理体验。
