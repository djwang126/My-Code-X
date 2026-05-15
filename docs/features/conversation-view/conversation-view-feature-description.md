# Feature-Conversation View

## Summary

Conversation View 是 My-Code-X 的核心主界面，是当前 `Selection` 指向的 Codex `Thread` 的移动端只读 timeline，并允许用户在同一页面发送输入，继续当前 `Thread`。

## Capability Sections

### Conversation page

Description:

Conversation page 是当前 `Conversation` 的移动端主页面。它承载用户阅读当前 Codex `Thread` 投影内容的核心体验，让用户按发生顺序理解当前工作现场。

Functional Requirements:

- 页面展示当前 Codex `Thread` 投影出的 `Conversation timeline`。
- `Conversation item` 按发生顺序展示。
- 页面支持 `message`、`work-trace`、`unknown`、`error` 四类 `Conversation item`。
- 页面在 timeline 外展示当前 `Thread` 或 `Turn` 的 `Pending interaction`。
- 页面可能需要展示 `loading`、`empty`、`restoring`、`failed` 等 timeline 状态，待确认。

UX Decisions:

- 页面主体采用单列垂直 timeline。
- `Conversation item` 采用按类型差异化的视觉呈现。
- 页面顶部保留当前 `Conversation` 的轻量上下文区域。
- 页面底部为输入区域。

### Message item

Description:

Message item 展示 Codex `userMessage` 和 `agentMessage` 的文本内容。它负责让主对话内容在手机端清晰可读、易复制、易区分。

Functional Requirements:

- Codex `userMessage` 作为 `message` 类型的 `Conversation item` 展示。
- Codex `agentMessage` 作为 `message` 类型的 `Conversation item` 展示。
- Codex `agentMessage` 实时 delta 可以更新当前 message item。
- Codex `item/completed` 中的最终 `agentMessage.text` 作为 message item 的最终内容。
- 普通文本内容支持 Markdown 阅读。
- 代码块、表格在消息中可正常展示。
- 可解析 md 格式的网址链接，并可点击跳转。
- 可解析 md 格式的文件/图片引用，并可点击跳转（需要文件功能支持，暂时不做）。
- 用户可以复制整条 message 的原始文本。
- 用户可以复制代码块内容。

UX Decisions:

- Message item 使用文本块布局。
- 用户输入和 Codex 输出使用差异化样式。
- 用户消息靠右，使用轻量强调底色；Codex 输出靠左，使用更接近正文阅读的中性底色。
- Message item 不展示调试字段；复制入口弱化为次要操作，避免干扰正文阅读。
- 代码块使用适合窄屏阅读的排版。
- 宽表格使用横向滚动容器。

### Work trace item

Description:

Work trace item 展示 Codex 工作过程中的计划、工具调用、工具结果、文件变更、网页搜索等工作痕迹。它由已知 Codex `ThreadItem` 或可归属到当前 `Turn` 的 typed `Codex runtime event` 投影而来，让用户理解 Codex 正在做什么，并在需要时查看细节证据。

Functional Requirements:

- Codex 已知工作痕迹作为 `work-trace` 类型的 `Conversation item` 展示。
- Work trace item 保留 Codex 原生 type。
- Work trace item 如果存在 status 字段，则保留 status。
- Work trace item 基于 Codex 结构化 `ThreadItem` 和 typed `Codex runtime event` 投影，不从普通文本输出中解析。
- Work trace item 不按 Codex 原生 type 做专门摘要或专门详情渲染。
- 复杂字段值以安全、可读的文本形式展示。
- item 内容过长时需要处理策略（待设计）。

UX Decisions:

- Work trace item 样式与 message 有所区别。
- Work trace item 默认以摘要形态呈现，摘要只显示来源 type 和可选 status。
- Work trace item 使用低视觉重量的紧凑卡片，适合连续出现，不抢占普通 message 的阅读层级。
- Work trace item 的来源 type 使用 monospace；status 使用小型状态标记。
- Work trace item 不显示额外的分类文案，例如 `Work trace`。
- 用户可以展开查看详情。
- 展开详情后使用通用字段列表，以字段名和值的形式分别显示。


### Unknown item

Description:

Unknown item 展示 My-Code-X 当前尚未专门分类的 Codex `ThreadItem` 或可归属到当前 `Turn` 的 `Codex runtime event`。它用于保证 Codex 新增内容类型时，用户仍然可以看到来源信息和原始细节。

Functional Requirements:

- 未识别的 Codex `ThreadItem` 或 scoped `Codex runtime event` 作为 `unknown` 类型的 `Conversation item` 展示。
- Unknown item 保留来源 type 或可识别来源信息。
- Unknown item 如果存在 status 字段，则保留 status。
- Unknown item 不按来源 type 做专门摘要或专门详情渲染。
- 复杂字段值以安全、可读的文本形式展示。
- 长内容支持分段查看。

UX Decisions:

- Unknown item 使用独立于 Work trace 的视觉样式。
- Unknown item 默认以摘要形态呈现，摘要只显示来源 type 和可选 status。
- Unknown item 使用轻微警示但非错误的样式，例如虚线边框或 caution 色左侧标记。
- Unknown item 的设计目标是可排查和不丢信息，不应暗示当前 Codex 工作已经失败。
- Unknown item 不显示额外的分类文案，例如 `Unknown item`。
- Unknown item 仍使用通用字段渲染，不把完整 raw payload 作为专门内容区展示。
- 用户可以展开查看详情。
- 展开详情后使用通用字段列表，以字段名和值的形式分别显示。
- 长内容先展示有限内容，并提供继续查看入口。

### Error item

Description:

Error item 展示可归属到当前 Codex `Thread` 和 `Turn` 的不可重试错误或 terminal failure。它帮助用户理解当前 timeline 中哪里出现失败，以及失败的原始信息。

Functional Requirements:

- Codex `error` notification with `willRetry = false` 作为 `error` 类型的 `Conversation item` 展示。
- Codex `turn/completed` with `status = failed` 中的 `TurnError` 作为 `error` 类型的 `Conversation item` 展示。
- 当同一个 `Turn` 先收到 `willRetry = false` 的 Codex `error` notification，后收到 `turn/completed` with `status = failed` 时，如果两者的 `turnId` 相同且 `error.message` 相同，则不重复显示第二个 `Error item`。
- 除 `turnId + error.message` 与 Codex TUI 一致的重复显示抑制外，Conversation View 不设计额外的错误去重规则。
- Error item 保留对应来源里的错误字段，例如 `source`、`threadId`、`turnId`、`willRetry`、`status`、`message`、`codexErrorInfo`、`additionalDetails`。
- Error item 不区分摘要和详情，不提供收缩展开逻辑。

UX Decisions:

- Error item 使用明确错误样式。
- Error item 使用左侧错误标记和红色系文本，优先展示 `message` 字段。
- Error item 使用通用字段渲染，以字段名和值的形式展示对应来源里的错误信息。
- Error item 不为不同 `codexErrorInfo` 做专门视觉或内容渲染。
- Error item 不使用折叠摘要；用户应直接看到失败原因和可排查字段。
- Error item 与普通 Codex 输出形成明显视觉区分。

### Turn transient retry status

Description:

Turn transient retry status 展示当前 active Codex `Turn` 的可重试运行错误。它用于让用户知道当前 `Turn` 没有卡死，而是正在由 Codex app-server 自动重试。

Functional Requirements:

- Codex `error` notification with `willRetry = true` 表示当前 `Turn` 的可重试运行错误，不作为 `Error item`，不进入 `Conversation timeline`。
- Turn transient retry status 绑定当前 active `Turn`，但不作为 `Conversation item`，不参与 `Conversation item` 排序，不占用 timeline 位置。
- 同一个 active `Turn` 再次收到 `willRetry = true` 的 Codex `error` notification 时，覆盖前一个 Turn transient retry status。
- 收到同一个 active `Turn` 的后续正常 `Codex runtime event`，例如 `item/*` delta、progress 或 completed 时，清除 Turn transient retry status。
- 收到同一个 active `Turn` 的 `turn/completed` 时，清除 Turn transient retry status。
- 如果后续收到 Codex `error` notification with `willRetry = false` 或 `turn/completed` with `status = failed`，按 `Error item` 规则展示 terminal failure。
- Turn transient retry status 保留对应来源里的错误字段，例如 `source`、`threadId`、`turnId`、`willRetry`、`message`、`codexErrorInfo`、`additionalDetails`。

UX Decisions:

- Codex `error` notification with `willRetry = true` 在当前进行中的 `Turn` 区域展示临时提示，并靠近最新 message 或 live item。
- 临时提示使用覆盖式显示，例如 `Reconnecting... 1/5` 被后续 `Reconnecting... 2/5` 替换。
- 临时提示不使用 toast，不自动按固定秒数消失。

### Client notice

Description:

Client notice 展示不应该投影为 `Conversation item`，也不属于当前 active `Turn` 临时 retry 状态的提示、错误或警告。

Functional Requirements:

- JSON-RPC error response 表示某个 app-server request 被拒绝，不作为 `Error item`，以对应用户操作的失败提示展示。
- 系统级 warning 和无法归属到当前 `Turn` 的错误不作为 `Error item`，以 `Client notice` 展示。
- Client notice 不参与 `Conversation item` 排序，不占用 timeline 位置。
- Client notice 保留对应来源里的错误字段，例如 `source`、`requestId`、`method`、`code`、`message`、`data`、`threadId`、`turnId`、`additionalDetails`。

UX Decisions:

- JSON-RPC error response 默认以 toast 展示。
- 系统级 warning 和无法归属到当前 `Turn` 的错误默认以 toast 展示。
- Toast 在屏幕中部以横条形式展示，并在短时间后自动消失。
- Toast 内容使用通用字段渲染，不为不同错误类型设计专门卡片。

### Conversation view state

Description:

Conversation view state 是 Conversation page 在 timeline 外展示的页面级状态。它帮助用户判断当前页面是否正在恢复、是否可读、是否为空、是否读取失败，以及当前显示内容是否可能不是最新。它不属于 `Conversation item`，不进入 timeline，也不表达 Codex `Thread` 或 `Turn` 的运行状态。

Functional Requirements:

- 没有选中 Codex `Thread` 时，页面展示未选择状态。
- 正在恢复当前 `Conversation`，且还没有可读 timeline 时，页面展示恢复中状态。
- 当前 `Conversation` 恢复成功但没有可展示 `Conversation item` 时，页面展示空状态。
- 当前 `Conversation` 恢复失败，且没有可读 timeline 时，页面展示失败状态。
- 页面已有可读 timeline，但正在同步、重新连接或无法确认内容是否最新时，页面保留 timeline，并展示非阻塞提示。
- `Pending interaction` 的展示优先级高于 Conversation view state 提示。
- Codex `Turn` 的 running、completed、failed、interrupted 状态不由 Conversation view state 表达。
- Conversation view state 不作为 `Conversation item` 展示，不参与 timeline 排序。

UX Decisions:

- 未选择状态使用页面主体空状态，引导用户新建Thread（需要其他feature支持，先不做，只给一个空状态即可）。
- 恢复中状态使用页面主体 loading，不展示空 timeline。
- 空状态使用轻量 empty state，说明当前 `Conversation` 暂无内容。
- 失败状态使用页面主体错误状态，并提供重试入口。
- 已有 timeline 时，同步中、重新连接或内容可能过期使用顶部轻提示，不使用全屏覆盖。
- Conversation view state 文案应直接说明用户当前能否继续阅读、是否需要等待或重试。

### Conversation live update

Description:

Conversation live update 让用户在 Codex 工作进行中持续看到新的 `Conversation item`。My-Code-X 后端消费 Codex notification stream，并按固定节奏聚合推送给前端，强调移动端的现场感和连续性。

Functional Requirements:

- Codex 工作期间，后端接收 Codex `item/*`、`turn/*` 等 runtime notification，并投影为 timeline 新增或更新。
- 已有 item 可以根据后续 delta、progress 或 completed 事件更新。
- 更新过程保持 item 顺序稳定。
- live turn 的 item 以 Codex `item/completed` 或对应 final event 为最终权威内容。
- 恢复历史得到的 timeline 以 Codex 可重建的 `ThreadItem` 为准，不保证包含所有 live 中间态。
- 恢复进行中的 Codex `Thread` 后，页面继续接收后续更新。
- My-Code-X 后端初步每 500ms 聚合一次 timeline 更新并推送给前端，使弱网状态下表现更稳定。

UX Decisions:

- 新内容进入 timeline 时保持阅读位置稳定。
- 当前进行中的 item 使用轻量动态状态。
- live timeline 和 item 以 Codex 最终事件为准。

### Pending interaction（待设计）

Description:

Pending interaction 是 Codex app-server 对当前 `Thread` 或 `Turn` 发出的 server reverse request，帮助用户完成授权、确认、拒绝、取消、填写表单或提供工具输入等决策。它不是 `Conversation item`，不进入 timeline。

Functional Requirements:

- 页面展示当前 `Thread` 或 `Turn` 的 `Pending interaction`。
- Pending interaction 展示请求类型、请求内容和关键风险信息。
- Pending interaction 保留 Codex request `id` 和 method。
- 用户可以按请求类型选择 Codex 支持的 decision 或填写所需输入。
- 用户处理后，My-Code-X 后端用同一个 request `id` 响应 Codex app-server。
- Pending interaction resolved 后从决策区域移除。

UX Decisions:

- Pending interaction 使用 timeline 外的固定决策区域。
- Pending interaction 使用高优先级视觉层级。
- 不同请求类型的可选决策入口清晰分离。
- 高影响请求使用防误触交互。


### Composer

Description:

Composer 是 Conversation View 底部的用户输入控制台，用于向当前 `Selection` 指向的 Codex `Thread` 发送普通用户输入。它根据当前 `Thread` 和 active `Turn` 状态，将用户输入映射为 Codex `turn/start` 或 `turn/steer`。

Functional Requirements:

- Composer 绑定当前 `Selection` 指向的 Codex `Thread`。
- Composer 为当前用户输入保存本地草稿。
- 用户可以输入多行文本。
- 空文本不能发送。
- 当前 `Thread` 为 idle 时，发送输入触发 Codex `turn/start`。
- 当前 `Thread` 存在可 steer 的 active regular `Turn` 时，发送输入触发 Codex `turn/steer`。
- `turn/steer` 必须携带当前 active `Turn` 的 `expectedTurnId`。
- 当前 active `Turn` 不可 steer 时，Composer 不应默默降级为新 `turn/start`。
- 发送请求被 Codex 接受后，Composer 清空已发送草稿。
- 发送请求失败时，Composer 恢复原草稿，并展示非阻塞错误提示。
- 发送请求被 Codex 接受后，timeline 以后续 Codex item 和 `Codex runtime event` 投影为准；Composer 不自行伪造 committed `Conversation item`。
- Composer 不用于响应 `Pending interaction`。
- 当前没有选中 `Conversation`、`Thread` 正在恢复、连接不可用或目标状态不明确时，Composer 保留草稿但禁用发送。
- 当前存在 active `Turn` 时，Composer 的主操作可以切换为中断当前 `Turn`，触发 Codex `turn/interrupt`。
- 中断当前 `Turn` 不使用并列的额外主按钮。
- 当pending interaction存在时，Composer 主操作依然可用。

UX Decisions:

- Composer 固定在页面底部，并适配移动端 safe area 和软键盘。
- Composer 使用移动端友好的多行输入框。
- 输入框默认低高度，随内容增长到最大高度；超过最大高度后输入框内部滚动。
- 主操作按钮固定在 Composer 右侧或右下角，保持单手可达。
- active `Turn` 中的主操作按钮应根据当前动作切换 icon 或可访问名称，例如 steer 或 interrupt。
- Pending interaction 存在时，固定决策区域展示在 Composer 上方，并拥有更高视觉优先级。
- Pending interaction 存在时，Composer 可以保留草稿，但应通过层级明确它不是用来回答当前决策请求。
- 高影响动作，例如 `turn/interrupt`，需要防误触处理。
- 草稿内容停留在输入区域，不进入 timeline。
- 发送失败、steer rejected 或连接异常时，用户输入不能丢失。


## Out of Scope
- Codex agent 能力重设计
