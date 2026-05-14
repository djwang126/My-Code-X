# Feature-Conversation View

## Summary

Conversation View My-Code-X的核心主界面，是当前 `Selection` 指向的 Codex `Thread` 的移动端只读 timeline，并允许用户在同一页面进行输入，继续当前 `Thread`。

## Capability Sections

### Conversation page

Description:

Conversation page 是当前 `Conversation` 的移动端主页面。它承载用户阅读当前 Codex `Thread` 投影内容的核心体验，让用户按发生顺序理解当前工作现场。

Functional Requirements:

- 页面展示当前 `Thread` 投影出的 `Conversation timeline`。
- `Conversation item` 按发生顺序展示。
- 页面支持 `message`、`work-trace`、`unknown`、`error`、`pending-interaction` 五类 `Conversation item`。
- 页面可能需要展示 `loading`、`empty`、`restoring`、`failed` 等 timeline 状态，待确认。

UX Decisions:

- 页面主体采用单列垂直 timeline。
- `Conversation item` 采用按类型差异化的视觉呈现。
- 页面顶部保留当前 `Conversation` 的轻量上下文区域。
- 页面底部为输入区域。

### Message item

Description:

Message item 展示用户输入和 Codex 普通文本输出。它负责让主对话内容在手机端清晰可读、易复制、易区分。

Functional Requirements:

- 用户输入作为 `message` 类型的 `Conversation item` 展示。
- Codex 普通文本输出作为 `message` 类型的 `Conversation item` 展示。
- 用户输入和 Codex 输出保留各自来源信息。
- 普通文本内容支持 Markdown 阅读。
- 代码块、表格在消息中可正常展示。
- 可解析md格式的网址链接，并可点击跳转。
- 可解析md格式的文件/图片引用，并可点击跳转（需要文件功能支持，暂时不做）。
- 用户可以复制整条 message的原始文本。
- 用户可以复制代码块内容。

UX Decisions:

- Message item 使用文本块布局。
- 用户输入和 Codex 输出使用差异化样式。
- 代码块使用适合窄屏阅读的排版。
- 宽表格使用横向滚动容器。

### Work trace item

Description:

Work trace item 展示 Codex 工作过程中的计划、工具调用、工具结果、文件变更、网页搜索等工作痕迹。它让用户理解 Codex 正在做什么，并在需要时查看细节证据。

Functional Requirements:

- Codex 已知工作痕迹作为 `work-trace` 类型的 `Conversation item` 展示。
- Work trace item 保留 Codex 原生 type。
- Work trace item 基于codex输出解析。
- Work trace item 保留可排查问题的原始信息。
- 复杂字段值以安全、可读的文本形式展示。
- 长内容支持分段查看。

UX Decisions:

- Work trace item 样式与message有所区别。
- Work trace item 默认以摘要形态呈现。
- 用户可以展开查看详情。
- 展开详情后以字段名和值的形式分别显示。
- 长内容先展示有限内容，并提供继续查看入口。

### Unknown item

Description:

Unknown item 展示 My-Code-X 当前尚未专门分类的 Codex 内容。它用于保证 Codex 新增内容类型时，用户仍然可以看到来源信息和原始细节。

Functional Requirements:

- 未识别的 Codex 内容作为 `unknown` 类型的 `Conversation item` 展示。
- Unknown item 保留来源 type 或可识别来源信息。
- Unknown item 保留可排查问题的原始信息。
- 复杂字段值以安全、可读的文本形式展示。
- 长内容支持分段查看。

UX Decisions:

- Unknown item 使用独立于 Work trace 的视觉样式。
- Unknown item 默认以摘要形态呈现。
- 用户可以展开查看详情。
- 展开详情后以字段名和值的形式分别显示。
- 长内容先展示有限内容，并提供继续查看入口。

### Error item

Description:

Error item 展示可归属到当前 `Conversation` 的会话内错误。它帮助用户理解当前 timeline 中哪里出现失败，以及失败的原始信息。

Functional Requirements:

- 会话内错误作为 `error` 类型的 `Conversation item` 展示。
- Error item 展示错误摘要。
- Error item 保留原始错误信息。

UX Decisions:

- Error item 使用明确错误样式。
- 错误摘要优先展示。
- 原始错误信息放入详情区域。
- Error item 与普通 Codex 输出形成明显视觉区分。

### Conversation state（待设计）

Description:

Conversation state 表达当前 `Conversation` 的读取和恢复状态，帮助用户判断页面当前状态。

Functional Requirements:

待设计

UX Decisions:

待设计

### Conversation live update

Description:

Conversation live update 让用户在 Codex 工作进行中持续看到新的 `Conversation item`。它强调移动端的现场感和连续性。

Functional Requirements:

- Codex 工作期间，timeline 接收并展示新增内容。
- 已有 item 可以根据后续事件更新。
- 更新过程保持 item 顺序稳定。
- Codex 工作结束后，timeline 展示完整内容。
- 恢复进行中的 Codex `Thread` 后，页面继续接收后续更新。

UX Decisions:

- 新内容进入 timeline 时保持阅读位置稳定。
- 当前进行中的 item 使用轻量动态状态。
- timeline 和item以最终完整内容为准。

### Pending interaction（待设计）

Description:

Pending interaction 是 Codex app-server 对当前 `Thread` 或 `Turn` 发出的待用户处理请求，帮助用户完成授权、确认或拒绝等决策。

Functional Requirements:

- 页面展示当前 `Thread` 或 `Turn` 的 pending interaction。
- Pending interaction 展示请求类型、请求内容和关键风险信息。
- 用户可以确认请求。
- 用户可以拒绝请求。
- 用户处理后将结果发送回当前 Codex `Thread` 或 `Turn`。

UX Decisions:

- Pending interaction 使用 timeline 外的固定决策区域。
- Pending interaction 使用高优先级视觉层级。
- 确认和拒绝入口清晰分离。
- 高影响请求使用防误触交互。

### Composer（待设计）

Description:

Composer 用于继续当前 Codex `Thread`。它让用户在阅读当前 `Conversation` 的同时补充指令、纠偏、回答 Codex 请求或推进下一步。

Functional Requirements:

- Composer 绑定当前 `Selection` 指向的 Codex `Thread`。
- 用户可以输入文本。
- 用户可以发送输入内容。
- 发送后内容进入当前 Codex `Thread`。
- 系统确认接受后，用户输入进入 `Conversation timeline`。
- Composer 支持本地草稿。

UX Decisions:

- Composer 位于页面底部。
- Composer 使用移动端友好的多行输入框。
- 发送入口保持单手可达。
- 草稿内容停留在输入区域。
- Pending interaction 存在时，Composer 与决策区域形成清晰层级。

## Out of Scope
- Codex agent 能力重设计
