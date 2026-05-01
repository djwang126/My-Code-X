# Codex Conversation View Feature Test Design

本文设计当前合并批次的行为测试范围：Slice 3、Slice 4、Slice 8、Slice 9、Slice 10。

当前批次目标是让 Conversation View 从简单 `id + text` timeline 进化为可渲染的 conversation item 系统：后端确认的 user/assistant message、Markdown 阅读、Codex work trace cards、长 work trace 展开策略、unknown item JSON fallback。

本测试设计只描述应该验证的行为，不实现测试代码。

## Targeted behavior

### 1. Conversation item contract is a discriminated union

需要验证 client-facing conversation item contract 能表达当前批次需要的 item 类型，并拒绝无效状态。

应覆盖：

- Message item 必须有稳定 `id`、`kind`、`role` 和原始 Markdown text。
- Message role 只允许 user 和 assistant。
- Work trace item 必须有稳定 `id`、`kind`、Codex 原生 item type，以及可展示的标题 fallback 信息。
- Unknown item 必须有稳定 `id`、`kind`、原始 unknown item type 和 raw payload。
- 不允许一个 item 同时携带 message、work trace、unknown 的字段组合。
- 不允许缺少对应 item category 必需字段的 payload 通过 contract validation。
- Ready conversation 保持有序 item 列表，不因为 item 类型不同而改变顺序。

测试层级：contracts package。

测试方式：用 contract schema parse 真实形状的 sample payload，验证合法 payload 被接受、无效组合被拒绝。

### 2. Server projection preserves Codex item identity and order

需要验证 server 从 normalized RuntimeThreadItem 投影 conversation item 时，不发明 identity，不打乱顺序。

应覆盖：

- `userMessage` runtime item 投影成 user message item，使用 Codex item id，保留原始文本。
- `agentMessage` runtime item 投影成 assistant message item，使用 Codex item id，保留原始文本。
- 多个 runtime items 按输入顺序进入 conversation timeline。
- 同一个 timeline 中 message item 与 work trace item 混排时，顺序与后端权威输入一致。
- 没有 text 的 known work trace item 仍可作为 work trace item 展示，只要 Codex 原生结构提供可观察信息。
- projection 不给 item 增加时间戳、done 状态、发送控件、approval 控件或 pending request 业务状态。

测试层级：server conversation feature / presenter public behavior。

测试方式：通过公开 service 或 projection entry 输入 normalized runtime items，再读取 conversation snapshot / presented client snapshot，断言最终 client-visible items。

### 3. Confirmed user and assistant messages render as chat messages

需要验证前端只渲染已进入 conversation snapshot 的正式 message item，并按 role 呈现聊天布局。

应覆盖：

- User message 显示在用户侧视觉位置。
- Assistant message 显示在 assistant/Codex 侧视觉位置。
- Timeline 按 snapshot item 顺序渲染。
- 没有出现在 snapshot 里的 optimistic message 不会被 Conversation View 自己创建或显示。
- User message 和 assistant message 都提供整条消息复制入口。
- 整条消息复制使用原始 Markdown text，而不是渲染后的 DOM 文本或样式。
- Message item 不显示时间戳、done 横幅、发送、重试、取消、approval 或 pending request 控件。

测试层级：web conversation view model / component behavior。

测试方式：用 client snapshot fixture 渲染 Conversation View，验证可见文本、role class/语义、复制行为和不出现的 out-of-scope 控件。

### 4. Markdown rendering is safe and readable for messages

需要验证 user/assistant message 按 Markdown 语义渲染，同时不信任原始 HTML。

应覆盖：

- Markdown 段落、列表、强调、inline code 能以可读结构展示。
- Markdown 代码块使用等宽展示，并提供代码块复制入口。
- 代码块复制使用原始代码内容。
- 原始 HTML 不作为可信 HTML 执行或渲染；HTML 内容应被转义或作为文本处理。
- Markdown 表格被放入横向滚动容器，避免窄屏布局被撑坏。
- 不要求代码块语法高亮。
- 普通长 message 不套用 work trace 的 30 行截断规则。

测试层级：web Markdown rendering component / Conversation View component。

测试方式：用包含列表、代码块、表格、HTML 字符串的 message fixture 渲染，断言 DOM 结构、复制内容和 HTML 安全结果。

### 5. Work trace items render as collapsed Codex-side cards

需要验证 Codex 原生工作痕迹作为 timeline item 可见但默认折叠，并且不使用用户消息样式。

应覆盖：

- Plan item 显示为 work trace card。
- Reasoning item 显示为 work trace card。
- Command execution item 显示为 work trace card。
- Tool call item 显示为 work trace card。
- File change item 显示为 work trace card。
- Web search item 显示为 work trace card。
- Work trace item 默认折叠。
- Work trace item 位于 Codex/assistant 侧，不使用 user message 样式。
- Work trace 标题优先使用 Codex 原生 title、label、summary 或等价展示元数据。
- 缺少原生展示元数据时，标题 fallback 为原始 item type。
- Work trace item 不提供专门复制按钮。
- Work trace item 不显示时间戳、done 横幅、approval 或 pending request 业务控件。

测试层级：server projection + web component behavior。

测试方式：用 representative runtime item fixtures 通过 server projection 生成 client items；前端用这些 client items 渲染，断言默认折叠、标题、侧向和非目标控件不存在。

### 6. Work trace long content expansion follows the 30-line rule

需要验证长工作痕迹展开策略只影响 work trace，不改变 server 数据。

应覆盖：

- Work trace 默认折叠时不显示完整长内容。
- 用户首次展开超过 30 行的 work trace 时，只显示前 30 行。
- 超过 30 行时显示等价于“展开剩余 xxx 行”的入口。
- 剩余行数根据完整内容确定。
- 用户继续展开后可以看到完整剩余内容。
- 不超过 30 行的 work trace 展开后不显示“展开剩余”入口。
- 30 行规则不应用于普通 user/assistant message。
- 展开/继续展开是 frontend local UI state，不改变 conversation revision 或 item identity。

测试层级：web model pure state transition + component behavior。

测试方式：用固定 31 行、30 行、100 行 work trace fixtures 验证可见行数、剩余行提示和继续展开后的完整内容。

### 7. Unknown item fallback preserves observability

需要验证 My-Code-X 不认识的 Codex item type 不会被静默丢弃，并能看到格式化 JSON。

应覆盖：

- Runtime unknown item 投影成 unknown client item。
- Unknown item 保留原始 unknown item type。
- Unknown item 保留 raw payload，用于 fallback 展示。
- Unknown item 默认折叠。
- 展开 unknown item 后显示格式化 JSON。
- My-Code-X 不对 unknown item 生成业务摘要、不推断业务含义。
- Unknown item 不提供专门复制按钮。

测试层级：server projection + web component behavior。

测试方式：用包含新/未知 Codex item type 的 runtime fixture 生成 client item，再渲染并断言折叠状态和展开后的 JSON 内容。

### 8. Message and work trace behavior stay separated

需要验证 message item 和 work trace item 的规则不会互相污染。

应覆盖：

- Message item 默认展开，不使用 work trace 折叠卡片。
- Work trace item 默认折叠，不使用 message bubble。
- Message item 有整条复制按钮；work trace item 没有专门复制按钮。
- Message item 使用 Markdown 渲染；work trace long content 使用行数展开策略。
- 普通长 message 不显示“展开剩余 xxx 行”。
- Unknown item 使用 JSON fallback，不使用 Markdown message renderer。

测试层级：web conversation item renderer。

测试方式：用混合 timeline fixture 渲染，验证每类 item 的可见行为和互斥规则。

## Test boundaries for this batch

本批次不设计以下测试：

- 不测试 workspace 文件引用视觉区分或打开行为。
- 不测试 client event stream、后端聚合频率、item upsert ordering 或 token delta 合并。
- 不测试 resume thread restore。
- 不测试 conversation error item；当前只保留 Slice 2 已有的 non-conversation failed state 行为。
- 不测试自动滚动、虚拟列表、搜索、筛选、跳转、手动刷新。
- 不测试 pending request / approval 业务逻辑。
- 不测试语法高亮。

## Test style decisions

- 测试行为，不测试内部文件结构。
- 优先通过 contract schema、server public service/presenter、web public component 或纯 model function 验证可观察行为。
- 使用固定 fixtures，避免时间、随机数、网络和真实浏览器布局依赖。
- 不 mock 内部 collaborator；需要隔离 Codex runtime 时使用 normalized runtime item fixtures 或 in-memory adapter 输入。
- 对 DOM 行为做明确断言，不使用 weak assertions。
- 一个测试只验证一个用户/API 可见行为。
