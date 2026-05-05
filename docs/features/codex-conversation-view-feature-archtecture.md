# Codex Conversation View Feature Archtecture

本文记录 Codex Conversation View 的架构决策。核心目标是把 Codex app-server 的权威 conversation 信息投影成移动端友好的只读 timeline，同时保持 My-Code-X 不发明 Codex 语义。

## Architecture Decisions

Conversation View 采用“Codex app-server 权威来源 + My-Code-X 后端权威投影 + 前端只读渲染”的架构。

权威链路是：Codex app-server 产生 conversation facts；My-Code-X server 把这些 facts 解析、恢复、聚合、排序并投影成 frontend-facing contract；Web Conversation View 只消费 contract 并渲染阅读体验。

Codex app-server 是 conversation 内容、item identity、item 更新方式、工作痕迹结构和错误信息的权威来源。My-Code-X 后端负责把 app-server 信息投影成前端可消费的 conversation snapshot 与 conversation events。前端只消费这些聚合后的产品 contract，并负责 Markdown、安全渲染、折叠展开、复制和移动端布局。

Conversation View 是阅读界面，不是操作界面。发送、重试、取消、approval、pending request、手动刷新、跳转和 workspace 文件打开都不进入 Conversation View 的状态模型。它们可以在页面组合层与 Conversation View 视觉相邻，但不成为 conversation timeline item，也不由 Conversation View 处理业务逻辑。

Conversation View 的核心模型分为两部分：conversation resource state 和 conversation timeline。Resource state 表达当前 view 是否已经拿到可展示的权威 conversation；timeline 只包含 Codex conversation 内容。页面级加载失败、恢复失败或基础设施错误不伪造成 timeline item。

## Data Model & Schema Definition

### Conversation snapshot

Conversation snapshot 是前端看到当前 thread conversation 的完整只读视图。它包含：

- 当前 conversation revision，用于前端判断事件顺序和是否需要重建视图。
- 当前 resource state，用于表达 loading、ready、failed 这些非 timeline item 的读取状态。
- 非 conversation 错误信息，用于表达加载或恢复失败，不能伪造成 Codex conversation item。
- 有序 timeline items，用于展示用户消息、assistant message、工作痕迹、未知 item 和 conversation 内错误 item。

空状态由 ready 状态下的空 item 列表表达。它是 view 展示结果，不需要单独发明 conversation item。

Restoring 是 application/runtime 操作，不是独立的 Conversation View render state。除非未来 UI 需要把恢复中和普通加载中渲染成不同体验，否则 Conversation View contract 只需要 loading、ready、failed。恢复完成后，如果 thread 仍在进行中，它处于 ready state，并继续接收后续 conversation events。

Conversation resource state 必须用 discriminated union 建模，而不是 status 加一组 optional fields。Loading state 不携带 timeline error；failed state 必须携带非 conversation 错误；ready state 携带权威有序 timeline。这样可以避免 ready 但仍有 failed error、failed 但没有 error 这类 impossible states。

### Conversation item

Conversation item 是 timeline 的最小展示单位。每个 item 都必须有稳定 identity，优先来自 Codex app-server 的原生 item identity。Codex 原生表示为同一个 item 的后续更新，My-Code-X 也更新同一个 item；Codex 原生表示为多个 item 的内容，My-Code-X 也按多个 item 展示。

Conversation item contract 必须采用 discriminated union，而不是用一组 optional fields 表达所有 item。共享字段只保留在最小 base shape 中，每个 item category 拥有自己的必需字段。这样前端可以按 item category 做穷尽渲染，不会出现一个 item 同时像 message、error、work trace 的无效状态。

Conversation item 采用少量产品级分类：

- Message item：用户消息或 assistant message。内容是原始 Markdown 文本，前端按 Markdown 语义渲染。
- Work trace item：Codex 原生工作痕迹，例如 hook prompt、计划、推理摘要、命令、工具、文件变更、网页搜索，或包含 stdout、stderr、diff、工具 payload 等内容的 app-server 结构。它使用 Codex 原生 item type 作为可识别标题，并把原始 payload 投影为通用字段列表。
- Unknown item：My-Code-X 当前不认识的 Codex item。它保留 Codex 原生 item type，并把原始 payload 投影为同一套通用字段列表，前端展开后按字段名和值展示。
- Error item：Codex/app-server 表示为 thread/turn conversation fact 的聊天过程错误。当前 app-server protocol 中错误可能表现为 turn-scoped error notification、failed turn completed error，或恢复历史中的 failed turn error，而不一定是原生 ThreadItem 变体。My-Code-X 把这些 conversation-scoped error facts 投影为 timeline error item；它保留原始错误 message，前端以错误卡片展示。

分类只服务于产品渲染边界，不重新解释 Codex 业务语义。工作痕迹和未知 item 的卡片标题使用 Codex 原生 item type。My-Code-X 不从字段内容中自行生成标题、标签或摘要。状态等字段如果存在于 Codex payload 中，只作为通用字段列表的一项展示。

Error item 的 identity 来自它所属的 Codex turn，而不是由前端生成。identity 采用由 turn id 派生的稳定 error item id。对同一个 turn 的 runtime error notification 和 failed turn completed error 必须 upsert 同一个 timeline item，避免同一错误在 timeline 中重复出现。

Conversation feature 内部应拥有 server-side canonical conversation item concept。Runtime、domain、contract、UI 可以有边界 wrapper 或 projection shape，但不能在多个层里重复定义同一个产品概念并复制字段。已知 item 先进入 typed conversation domain model，再由 presenter 投影到 client contract；Web 不再重新定义一套等价 schema。

通用字段列表是工作痕迹和未知 item 的共享 canonical concept。字段列表中的每一行包含原始字段名和 JSON value：`{ name, value }`。字段列表从 Codex item raw payload 的 object entries 生成，必须保留 raw payload 的字段顺序，前端按该顺序展示，不重新排序。字段列表保留原始字段，不过滤 `type`、`id`、`status` 等调试有用字段，也不把字段解释成 My-Code-X 自定义标题或摘要。

### Item content

用户消息和 assistant message 保留原始文本。复制整条消息或代码块时使用原始文本，而不是渲染后的 DOM 内容。

工作痕迹保留 Codex 原始 payload 中的字段名和值，并在 conversation contract 中投影为通用字段列表。30 行截断是前端阅读策略，不是后端数据截断。前端第一次展开长工作痕迹字段值时显示前 30 行，并根据完整字段值计算剩余行数。

未知 item 使用与工作痕迹相同的通用字段列表策略。Unknown raw payload 不应被静默丢弃；projection boundary 把 raw object 转为 `{ name, value }` 字段行，复杂 value 仍保留为 JSON value。这样已知工作痕迹和未知 fallback 可以复用字段渲染，但仍通过 `kind` 区分产品语义。

错误 item 只保留原始错误 message。My-Code-X 不改写错误原因，也不补充推断性解释。除原始 message 外的调试字段即使存在于 app-server payload 中，也不进入本轮 Error Surfaces 的错误卡片 contract。

### Rendering metadata

Client contract 可以携带渲染所需的轻量 metadata，例如 item category、message role、原生 item type、通用字段列表、渲染格式、workspace reference 标记等。

Rendering metadata 必须保持最小。能从 item category 或 message role 推导出的纯布局信息，不需要进入 contract。只有来自 Codex/app-server 的语义标记，或 frontend 无法安全推导但渲染必须知道的信息，才进入 contract。纯 CSS/layout 决策留在 Web。

workspace 文件引用只基于 Codex/app-server 提供的结构化引用信息或等价标记进行视觉区分。前端不把任意看起来像路径的普通文本自行升级为 workspace 文件引用。

Client contract 不携带 Conversation View 本轮不展示的信息：时间戳、完成横幅、操作控件状态、pending request 业务状态、approval 处理状态、搜索筛选状态或跳转锚点状态。

## Data Flow

### Initial open flow

前端打开一个 client slot 或 thread 时，请求当前 client snapshot。应用层协调 slot、workspace、thread、turn、runtime request 和 conversation。Presenter 把 feature-owned state 投影成 client snapshot。

Conversation View 收到 snapshot 后只渲染其中的 conversation view。加载中、恢复失败和空状态都作为 resource state 或派生状态展示，不进入 timeline items。

### Runtime update flow

Codex app-server 的输出先由 Codex adapter 转为 normalized runtime events。外部 raw data 必须在 adapter/runtime boundary 或 conversation projection boundary 被解析和校验一次。解析后，内部代码使用 typed values，不依赖层层 optional chaining 防御未知 shape。

Application 只负责把 runtime events 路由给对应 feature，不在 application 层实现 conversation item 分类和展示语义。Conversation feature 接收与 timeline 有关的 runtime input，基于 Codex 原生 item identity 和 item/update 方式更新 conversation projection。它负责后端聚合，避免前端直接消费高频 token 级流式输出。

Codex item type 到 conversation item category 的映射必须集中在 conversation projection policy 中。新增一个已知 Codex item type 时，应该修改一个集中 policy，而不是在 presenter、UI 和多个 feature 中散落 switch 判断。

Turn-scoped runtime error notification 和 failed turn completed error 是 conversation-relevant runtime input。Application 负责把这些 typed runtime errors 路由给 conversation feature；conversation feature 决定它们是否属于 timeline error item，并用 turn-scoped identity upsert。runtime error notification 不改变 turn lifecycle；turn lifecycle 只跟随 Codex/app-server 明确提供的 turn lifecycle events，例如 turn started 和 turn completed。

聚合后的 conversation domain event 再由 presenter 投影成 client event。前端消费 client event，并按 revision 和 item identity 更新本地只读 store。UI 体验是进度刷新式更新，不是逐 token 直播。

### Restore flow

恢复 thread 时，application 调用 app-server 的权威恢复或读取能力，并把恢复出的 thread snapshot 交给 conversation feature 替换当前 timeline。恢复出的已完成 thread 展示完整历史 conversation。恢复出的进行中 thread 在历史内容恢复后进入 ready state，并继续消费后续 conversation updates。

恢复 projection 必须保留历史 failed turn error。恢复数据如果包含 turn 列表，conversation feature 按 app-server 的 turn/item 顺序投影普通 conversation items，并把 failed turn error 投影到该 turn 对应的 timeline 位置。恢复数据如果只包含 item 列表，则只投影可见 items，不额外制造缺失的 error item。

恢复失败是非 conversation 基础设施错误。它通过 resource state、notice 或 action result 呈现，不创建 timeline item。

### Frontend render flow

Frontend Conversation View 以 snapshot 和 events 维护只读 render store。它不创建 optimistic conversation item，不自行分类 Codex raw item，不自行推断 Codex item lifecycle。

Frontend 维护的状态只服务于阅读：折叠展开、长内容展开进度、复制反馈、Markdown 渲染结果、链接行为和响应式布局。这些本地 UI state 不回传 server，不改变 conversation revision，不参与 item identity，也不影响后端 timeline projection。

如果 Conversation View 的本地 UI state 出现多个互相影响的状态，应使用小 reducer 或纯 transition functions，而不是散落多个互相依赖的 component state。React components 只渲染 state 并派发本地 UI intent；timeline mutation、item classification 和 semantic transition 不放在组件里。

前端不创建 optimistic conversation item。用户消息只有在后端确认并进入 conversation snapshot/event 后才显示在 timeline 中。

## State ownership

Codex app-server owns authoritative conversation facts.

Codex adapter owns external protocol handling and raw protocol normalization. It does not own conversation state.

Application owns cross-feature orchestration: open, resume, runtime event routing, and recovery error routing. It routes turn-scoped runtime errors to conversation projection without inferring turn lifecycle state. It does not own timeline state, item rendering semantics, turn lifecycle semantics, or conversation projection policy.

Conversation feature owns conversation timeline state, revision, item identity mapping, replacement/upsert rules, backend aggregation buffer, restore projection, conversation-scoped error projection, and conversation resource readiness state. It does not own generic HTTP loading state, page-level request state, turn lifecycle, thread metadata, pending interactions, or approval state.

Thread feature owns thread metadata. Turn feature owns turn lifecycle. Runtime request feature owns pending interactions. These states remain separate from Conversation View even when page layout makes them visually adjacent.

Presenter owns projection from feature state to frontend-facing contracts. It decides contract shape and strips internal details that are not part of the product view. Presenter does not mutate feature state, aggregate runtime deltas, or classify raw Codex item types.

Frontend owns local display-only UI state: expanded cards, expanded line count, copy feedback, Markdown rendering, table overflow, link target behavior, and mobile layout.

## Module Boundry

Contracts define frontend-facing product shapes. They describe conversation snapshots, conversation items, client events and view states without exposing raw Codex transport vocabulary as an untyped blob. Work trace and unknown items expose a controlled generic field list derived from Codex payloads for observability.

Conversation feature is the only server feature that mutates conversation timeline state. Other features do not append, patch, replace or classify conversation items directly.

Application coordinates features but does not become a transcript mapper. When runtime events contain conversation-relevant information, application routes them to conversation feature and lets conversation feature own projection rules.

Presenter converts conversation snapshots and domain events into client snapshots and client events. Presenter does not mutate feature state and does not perform backend aggregation.

HTTP maps client requests and transport responses. It does not coordinate slot, thread, turn, runtime request and conversation itself.

Frontend Conversation View renders contracts. It does not import server runtime concepts, does not infer Codex item lifecycles, and does not own app-server semantics.

Pending interactions and approval UI belong to a separate feature boundary. The page composition layer may place them near Conversation View, but Conversation View remains timeline-only.

Runtime access and client event delivery remain injectable ports. Conversation projection should be exercisable with in-memory runtime/event inputs without starting the real Codex process.

## API contracts

### Snapshot contract

The client snapshot includes a conversation view with revision, resource state, optional non-item error in failed state, and ordered items in ready state. The snapshot is authoritative for the current selected scope.

The conversation resource state supports loading, ready and failed display decisions. Empty state is derived from ready state plus zero items. Restoring is not a separate Conversation View state unless future UI needs a distinct restoration display.

### Event contract

The client event stream uses aggregated conversation events rather than raw high-frequency runtime events. Conversation events are scoped to slot/thread and carry a monotonic revision.

The canonical item update event carries a full conversation item snapshot. This keeps frontend application idempotent and avoids requiring the browser to reconstruct Codex semantics from partial token deltas.

Conversation replacement events are used for restore or authoritative rebuild. Item upsert events are used when Codex/app-server keeps the same item identity. Append behavior is represented as an upsert of a new item identity in the next timeline position.

Item upsert events must preserve timeline ordering. New item identities enter the timeline at the server-authoritative position. Existing item identities update in place. Restore or authoritative rebuild uses conversation replacement to provide a full ordered list when ordering cannot be represented by a simple upsert.

Resource state events can represent loading, ready and failed states without creating timeline items.

### Error contract

Conversation error items are delivered as conversation items. A conversation error item carries a stable id and the original error message. Non-conversation errors are delivered through resource state, notice, or action result contracts.

Application and projection layers preserve typed error semantics until the presentation boundary. They may route errors to timeline item, resource state, notice, or action result, but they must not collapse typed errors into generic strings before routing decisions are made. Runtime errors with both thread identity and turn identity are conversation-scoped and enter the timeline as error items. Runtime error notifications do not imply a terminal turn state; only explicit Codex/app-server turn lifecycle events update turn lifecycle state. Errors without a selected conversation scope, without turn identity, or caused by loading/restoring infrastructure remain outside the timeline. The final user-facing error card or state displays the original error message required by the product behavior.

### UI behavior contract

Message items declare Markdown rendering but never trusted HTML rendering. External links open in a new browser tab. Workspace references are visually distinct when contract metadata identifies them as workspace references.

Work trace items declare foldable field rows derived from the Codex payload. The frontend applies the first-30-lines display rule to expanded long field values and computes remaining lines from the full field value supplied by the contract.

Error items declare plain text error rendering, not Markdown rendering. Error cards do not expose retry, cancel, approval, send or copy controls.

Conversation View contracts do not include search, filter, jump, refresh, retry, send, cancel or approval controls.

## Other Architectural decisions

Backend aggregation is part of the conversation projection. It may coalesce many runtime deltas into lower-frequency item snapshots, but the final projected item content must remain complete and ordered according to Codex/app-server authority.

Frontend rendering is intentionally dumb about Codex semantics. It can decide layout and interaction details, but semantic facts come from contract fields.

Markdown rendering is client-side and safe by construction: Markdown syntax is rendered, raw HTML is escaped or treated as text, and code block highlighting is not part of this feature.

Work trace folding is a UI presentation policy. Server state stores full field values; the browser decides how much is visible at a time.

Completion is represented by the absence of further updates and by the final authoritative content. Conversation View does not add a separate done banner.

Time exists outside the Conversation View product contract for this feature. Even if app-server supplies timestamps, this feature does not project them into the Conversation View UI.

The implementation should follow the vertical slices: first establish the frontend host and snapshot shell, then confirmed messages, Markdown/link behavior, aggregated events, restore, work traces with generic field rows, long expansion, unknown fallback using the same field rows, and error surfaces.
