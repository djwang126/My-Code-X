# Architecture Decisions

## Summary

Conversation View 采用“Codex app-server 权威来源、My-Code-X 后端 conversation 投影、前端只读渲染”的结构。

Codex app-server 是 conversation 内容、item 身份、item 更新方式、工作痕迹结构和错误事实的权威来源。My-Code-X 后端负责把外部 conversation facts 转换为稳定的 Conversation View 领域状态和客户端协议。前端只消费客户端协议并负责 Markdown 渲染、折叠展开、复制、链接行为和移动端布局。

Conversation View 是 timeline-only 功能。发送、重试、取消、approval、pending request、手动刷新、搜索、跳转和 workspace 文件打开都在 Conversation View 边界之外。页面组合层可以把相关功能放在视觉邻近位置，但这些功能不进入 conversation timeline，也不改变 Conversation View 的状态模型。

## Domain Model & Invariants

Conversation resource 表达当前 selected thread 的 conversation 读取结果。它只包含 loading、ready 和 failed 三类有效状态。空状态是 ready 状态下 timeline 为空的展示结果，不是独立 conversation item。

Conversation timeline 是按权威顺序排列的 item 集合。timeline 只包含 conversation 内容：用户消息、assistant 消息、Codex 工作痕迹、未知 Codex item 和 conversation-scoped 错误。加载失败、恢复失败和基础设施错误不进入 timeline。

Conversation item 是 timeline 的最小展示单位。每个 item 必须有稳定身份，优先来自 Codex app-server 的原生 item 身份。权威来源表示为同一个 item 的后续更新时，Conversation View 更新同一个 item；权威来源表示为多个 item 时，Conversation View 展示多个 item。

Message item 表示用户消息或 assistant 消息。内容保存为原始 Markdown 文本。复制整条消息或代码块时使用原始文本，不使用渲染后的页面内容。

Work trace item 表示 Codex 原生工作痕迹。它保留原生 item type 作为卡片标题，并把可观察 payload 投影为通用字段列表。字段列表保留原始字段名、字段值和字段顺序。

Unknown item 表示 My-Code-X 当前没有专门样式的 Codex item。它和 work trace item 使用同一套通用字段列表展示策略，保证 Codex schema 演进时新信息仍可观察。

Unknown item 不是 work trace item。它可以复用字段列表投影和字段列表渲染，但产品分类必须保持 unknown，不能为了复用 UI 而伪装成已知工作痕迹。

Error item 表示属于当前 conversation 的聊天过程错误。它保留原始错误信息，以 timeline 错误卡片展示。同一个 turn 范围内的错误更新同一个 error item，避免重复展示同一失败事实。

Conversation revision 表示后端投影的单调版本。snapshot 和 events 都携带 revision，前端用它判断更新顺序和是否需要替换本地视图。

通用字段列表是工作痕迹和未知 item 的共享领域概念。字段值可以是简单值或复杂结构；复杂结构在客户端以安全、可读文本展示。30 行截断是前端阅读策略，不是后端数据截断。

Conversation View 不保存或展示时间戳、完成横幅、操作控件状态、pending request 业务状态、approval 状态、搜索筛选状态或跳转锚点状态。

## System Boundaries

Codex app-server 负责原始 conversation facts、thread 和 turn 归属、item 顺序、item 更新方式、工作痕迹 payload、错误事实和恢复结果。

Codex adapter 负责外部协议处理和 raw data 规范化。它把外部 transport shape 转换为内部 typed runtime input，不拥有 conversation timeline。

Application 负责跨功能编排。它处理 open、resume、runtime routing、恢复错误路由和 selected scope 协调，但不分类 conversation item，不拥有 timeline state，也不推断 Codex item lifecycle。

Conversation feature 负责 conversation resource state、timeline state、item identity mapping、upsert 和 replacement 规则、恢复投影、conversation-scoped error 投影、后端聚合和 revision。

Presenter 负责把 Conversation feature 的领域状态投影为 frontend-facing snapshot 和 events。Presenter 不改变领域状态，不执行 runtime delta 聚合，也不把内部 adapter 细节暴露给客户端。

Frontend Conversation View 负责只读渲染和本地展示状态。它不创建 optimistic item，不自行分类 Codex raw item，不推断 turn lifecycle，也不拥有 app-server 语义。

Thread、turn、runtime request、pending interaction 和 approval 属于独立功能边界。它们可以与 Conversation View 在页面上组合，但不成为 Conversation View 的内部状态。

## State Ownership

Codex app-server 拥有权威 conversation facts。

Codex adapter 拥有外部协议规范化职责。

Application 拥有跨功能编排、selected scope 路由、resume flow 和 runtime input 路由职责。

Conversation feature 拥有 conversation resource state、timeline state、revision、item identity、timeline ordering、backend aggregation、restore projection 和 conversation-scoped error projection。

Thread feature 拥有 thread metadata。

Turn feature 拥有 turn lifecycle。

Runtime request feature 拥有 pending interaction state。

Presenter 拥有 frontend-facing projection 职责。

Frontend 拥有 display-only UI state，包括展开状态、长内容展开进度、复制反馈、Markdown 渲染结果、表格 overflow、链接行为和响应式布局。

## Backend Architecture

### Data Model & Schema Definition

Conversation resource state 使用封闭状态模型表达 loading、ready 和 failed。Loading state 不携带 timeline；failed state 携带非 conversation 错误；ready state 携带 revision 和有序 timeline。这个模型避免 ready 但仍有失败错误、failed 但没有错误等无效状态。

Conversation item 使用封闭分类模型表达 message、work trace、unknown 和 error。共享字段只保留稳定身份、排序信息和最小展示元数据。每个分类拥有自己的必需数据，避免一个 item 同时表现为 message、work trace 和 error。

Message item 保存 role 和原始 Markdown 文本。Role 只允许用户或 assistant。Message item 不保存渲染后的 HTML。

Work trace item 保存原生 item type 和通用字段列表。通用字段列表从权威 payload 投影而来，保留字段顺序，不重新生成标题、摘要或业务解释。

已知 work trace item type 包括 hook prompt、plan、reasoning、command execution、file change、MCP tool call、dynamic tool call、collab agent tool call、web search、image view、image generation、entered review mode、exited review mode 和 context compaction。对应 Codex item type 或 runtime item kind 进入集中 projection policy 后，投影为 work trace item。

用户消息和 assistant 消息不走 work trace fallback。Codex 的用户消息必须投影为 user message；Codex 的 assistant message 必须投影为 assistant message；未知 item type 必须投影为 unknown item。

Unknown item 保存原生 item type 和通用字段列表。Unknown item 是 Codex schema 演进时的可观察 fallback。

Error item 保存稳定身份和原始错误信息。错误卡片需要的用户展示信息来自原始错误信息，不混入推断性解释。

Conversation event 使用 revision 表达顺序。主要事件类型是 conversation replacement、item upsert 和 resource state change。Item upsert 携带完整 item snapshot，前端不需要从部分 delta 还原 Codex 语义。

### Data Flow

Initial open flow 中，前端请求当前 selected scope 的 snapshot。Application 协调 scope、thread、turn、runtime request 和 conversation。Conversation feature 提供当前 conversation resource。Presenter 输出客户端 snapshot。前端根据 resource state 展示 loading、failed、empty 或 timeline。

Runtime update flow 中，Codex app-server 输出先经过 adapter 规范化为 typed runtime input。Application 把 conversation-relevant input 路由给 Conversation feature。Conversation feature 按权威 item 身份和更新方式维护 timeline，并通过聚合后的 conversation events 输出给 presenter。前端按 revision 和 item identity 更新本地只读 store。

Runtime delta projection 属于 Conversation feature 的 Codex-aware 投影规则。它按 Codex 原生目标字段累积同一 item 的进行中内容，并在输出到客户端前形成完整 item snapshot。Completed item 到达后，完整权威 payload 覆盖同 item 的进行中投影。

Runtime delta 投影禁止把实现便利暴露为产品语义。Projection policy 不得把不同 delta kind 合并成单个 text 字段，不得使用 last-delta-wins 覆盖前一个 delta，也不得把 channel 或 channels 作为客户端 contract、feature 文档语义或 UI 展示语义。Reasoning summary、reasoning content、file changes、command output 和 tool progress 必须按 Codex 原生目标字段分别累积，不能互相覆盖。

Restore flow 中，Application 调用权威恢复能力并把恢复结果交给 Conversation feature。Conversation feature 用恢复出的 conversation 替换当前 timeline。已完成 thread 展示完整历史内容；进行中 thread 在恢复历史后进入 ready，并继续接收后续 runtime updates。

恢复失败作为非 conversation 错误进入 resource state 或 action result，不创建 timeline item。恢复数据中明确属于 conversation 的失败事实可以投影为 error item。

### Module Boundary

Contracts 定义 frontend-facing product shapes，包括 conversation snapshot、resource state、conversation item、conversation event 和必要的展示 metadata。Contracts 不暴露 untyped raw transport blob。

Conversation feature 是唯一可以突变 conversation timeline 的后端功能。其他功能不直接 append、patch、replace 或 classify conversation item。

Application 只做编排和路由。它不成为 transcript mapper，不实现 item 分类策略，不推断 item lifecycle。

Presenter 只做投影。它把领域状态转换成客户端协议，并剥离不属于 Conversation View 产品面的内部字段。

HTTP 和 event delivery 只负责 transport 映射。它们不协调 slot、thread、turn、runtime request 和 conversation 业务关系。

Runtime access 和 client event delivery 通过可替换端口接入。Conversation projection 可以用内存输入独立测试，不依赖真实 Codex 进程。

### API contracts

Snapshot contract 包含当前 conversation view 的 resource state。Ready snapshot 携带 revision 和有序 items；failed snapshot 携带非 conversation 错误；loading snapshot 表示当前 conversation 尚未可展示。

Event contract 使用聚合后的 conversation events，不向浏览器发送高频原始 runtime events。Event 按 selected scope 归属，并携带单调 revision。

Conversation replacement event 用于恢复、重建或权威快照替换。Item upsert event 用于新增 item 或更新已有 item。Resource state event 用于 loading、ready 和 failed 的变化。

Item upsert event 携带完整 item snapshot。新增 item 进入后端权威位置；已有 item 原地更新。排序不能用单个 upsert 表达时，使用 replacement event 提供完整有序列表。

Error contract 区分 conversation error item 和 non-conversation error。Conversation error item 进入 timeline。Non-conversation error 进入 resource state、notice 或 action result。

UI behavior contract 只携带渲染必须知道的信息，例如 message role、原生 item type、字段列表、workspace reference 标记和错误原始信息。纯布局决策留给前端。

### Error Handling

Conversation-scoped runtime error、failed turn error 和恢复历史中的 conversation failure 可以投影为 timeline error item。错误 item 使用稳定身份 upsert，显示原始错误信息。

Runtime、system 或 realtime 错误只有在同时能归属到当前 conversation scope 和明确 turn scope 时，才可以进入 timeline。没有 thread 归属、没有 turn 归属、归属不到当前 selected scope，或本质上是 loading/restoring infrastructure failure 的错误，不得伪造成 conversation timeline item。

Runtime error 不改变 turn lifecycle。Turn lifecycle 只由明确的 turn lifecycle facts 更新。

读取失败、恢复失败、scope 缺失、transport failure 和基础设施错误不进入 timeline。它们通过 resource state、notice 或 action result 展示。

错误路由在 typed error 语义仍可用时完成。后端不能在路由前把所有错误压平成普通字符串，否则无法判断错误是否属于 conversation timeline。

### Adapter / Port Decisions

Codex adapter 负责解析和校验外部 protocol shape。进入内部 feature 后，代码使用 typed runtime input，不依赖层层 optional field 防御。

Runtime port 提供 conversation-relevant input、恢复结果和 app-server lifecycle facts。Conversation feature 不直接依赖具体进程启动方式。

Client event delivery port 负责把 presenter 输出推送到浏览器。它不参与 conversation item 分类或聚合。

Storage 只用于支持当前系统已有的 thread 恢复和状态读取能力。Conversation View 不单独持久化一套自定义 transcript。

### Other Backend Decisions

Backend aggregation 属于 conversation projection。它可以把高频输入合并为较低频的完整 item snapshot，但不能丢失内容、打乱顺序或改变 item 身份。

Codex item type 到 Conversation item category 的映射集中在 conversation projection policy 中。新增已知 item type 时修改集中策略，而不是在 presenter、UI 和多个 feature 中散落判断。

工作痕迹和未知 item 共享通用字段列表投影。这个共享模型用于保留可观察性，不用于重新解释 Codex 语义。

通用字段列表从 Codex raw payload 的 object entries 生成，保留 raw payload 字段顺序。字段投影不得过滤、改名或重新排序原始字段；type、id、status 等调试有用字段即使前端当前不做专门展示，也必须作为普通字段保留。

Completion 通过最终权威内容和后续更新停止体现。Conversation View 后端 contract 不增加 done banner 状态。

## Frontend Architecture

### UI State Model

Frontend Conversation View 使用 snapshot 和 events 维护只读 render store。Render store 包含当前 resource state、revision 和 timeline items。

前端本地 UI state 只服务阅读体验，包括折叠展开、每个长字段的展开行数、复制反馈、Markdown 渲染状态、表格 overflow、链接 target 行为和响应式布局。

本地 UI state 不回传 server，不改变 revision，不影响 item identity，不参与 timeline ordering。

如果多个本地 UI state 互相影响，使用小 reducer 或纯 transition functions 管理。React components 只渲染状态并派发展示 intent。

### Data Model & Schema Definition

前端消费客户端协议中的 resource state、conversation item 和 conversation events。它不定义另一套等价的 Codex schema。

Message render model 保存原始 Markdown 文本、role 和复制所需原文。

Work trace render model 保存折叠状态、字段列表和每个长字段的当前可见行数。

Unknown item render model 复用 work trace 的字段列表渲染模型，但使用 unknown 的产品样式。

Error render model 保存原始错误信息和错误展示样式，不使用 Markdown 渲染。

### Data Flow

页面打开时，前端接收 snapshot 并初始化 render store。Loading、failed、empty 和 timeline 都由 resource state 和 items 派生。

收到 conversation event 时，前端先校验 revision 顺序。Replacement event 替换完整 timeline；item upsert event 按 item identity 更新或插入；resource state event 更新读取状态。

用户展开工作痕迹或未知 item 时，前端只改变本地展开状态。用户继续展开长字段时，前端增加可见行数并根据完整字段值计算剩余行数。

用户复制消息或代码块时，前端复制协议提供或从原始 Markdown 得到的原始文本，不复制 DOM 渲染结果。

用户打开普通外部链接时，前端在新标签页打开。workspace 文件引用只做视觉区分，不由 Conversation View 打开本地文件。

### Module Boundary

Conversation View 组件只渲染客户端协议。它不导入 server runtime concepts，不调用 Codex app-server，不执行 thread resume、approval、cancel、retry 或 send 操作。

Markdown renderer 只负责安全 Markdown 展示和代码块复制入口。它不执行原始 HTML。

Work trace renderer 负责折叠、字段列表展示和长内容逐步展开。它不理解字段业务含义。

Error renderer 负责 timeline 错误卡片展示。它不改写错误原因，不提供 retry 或 cancel 控件。

页面组合层可以把 Conversation View 与输入框、pending request、approval 或 workspace 入口放在同一页面，但这些控件通过各自 feature 工作。

### API contracts

前端依赖 snapshot contract 初始化页面，依赖 event contract 增量更新页面。Snapshot 和 events 都以 revision 保证顺序。

前端只接受完整 item snapshot，不消费 raw token stream 或外部 runtime delta。

前端把 message item 按 Markdown 渲染，把 work trace 和 unknown item 按字段列表渲染，把 error item 按纯文本错误卡片渲染。

前端不需要 contract 提供纯 CSS 布局信息。靠左、靠右、折叠样式、红色错误文字、移动端间距和横向滚动由 Web 样式决定。

### Error Handling

Resource failed state 显示为 timeline 外的常规错误区域。

Timeline error item 显示为 Codex 侧错误卡片，并保留在 timeline 顺序中。

复制失败时，前端可以显示本地轻量反馈，但不改变 conversation item。

Markdown 渲染异常时，前端以安全文本方式展示原始内容，避免整个 Conversation View 崩溃。

事件 revision 过旧时，前端忽略该事件。事件顺序无法安全应用时，前端等待或请求新的权威 snapshot。

### Other Frontend Decisions

Markdown 渲染是客户端行为。原始 HTML 被转义或当作文本处理。代码块语法高亮不属于本功能。

工作痕迹默认折叠。展开后，长内容首次显示 30 行，并提供继续展开入口。

工作痕迹不提供专门复制按钮。浏览器自然选择文本可以保留。

消息和代码块复制按钮复制原始文本。复制反馈是本地展示状态。

时间戳、完成提示、搜索、筛选、跳转、刷新、重试、发送、取消和 approval 控件都不由 Conversation View 渲染。

## Cross-cutting Decisions

Validation：外部 Codex protocol 在 adapter 或 projection boundary 被解析和校验。进入 Conversation feature 后使用 typed input 和封闭状态模型。

Logging：后端可以记录 projection、unknown item、error routing 和 revision 异常，用于调试。日志不改变客户端展示语义，也不把隐藏解释注入错误卡片。

Testability：Conversation projection 用内存 runtime input 测试 item 分类、identity upsert、replacement、restore、unknown fallback、error routing 和 revision 顺序。前端用客户端协议测试 Markdown、安全渲染、折叠展开、复制和错误状态。

Performance：后端聚合高频输入，前端消费完整 item snapshot。工作痕迹折叠和长内容逐步展开用于保护移动端阅读体验。大会话虚拟列表和分页不属于当前功能。

Security：Markdown 不执行原始 HTML。外部链接在新标签页打开，并使用安全链接属性。workspace 文件引用只基于协议标记视觉区分，不从任意文本猜测本地文件。

Concurrency：Revision 是前端应用事件的顺序依据。多页签最终都以权威 snapshot 和后续 events 为准。旧 revision event 不覆盖新状态。

Compatibility：未知 Codex item type 通过 unknown item 和通用字段列表保持可观察。新增已知 item type 时扩展集中 projection policy，不破坏现有通用 fallback。
