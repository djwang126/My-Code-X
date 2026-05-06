# Workspace Feature Archtecture

本文记录 Workspace 功能的架构决策。Workspace 是移动端侧边栏能力，用来管理 My-Code-X 自己保存的本机项目目录，并以 canonical cwd 为边界查看和操作 Codex app-server 已有 threads。

## Architecture Decisions

Workspace 采用“本地 Workspace Registry + Codex Thread 权威来源 + Application 跨功能编排 + Frontend 侧边栏会话态”的架构。

Workspace Registry 是 My-Code-X 自己的持久化数据，负责记录用户手动添加的 cwd 列表、显示名和内部稳定记录 id。Codex app-server 是 thread 列表、thread 字段、thread 顺序、thread 分页和 thread 操作结果的权威来源。My-Code-X 不能从 Workspace Registry 推断 thread，也不能把 Workspace UI 标记持久化成 Codex thread 状态。

Workspace 的产品身份是 canonical cwd。内部稳定记录 id 只用于 My-Code-X 自己定位同一条 Workspace 记录，解决 cwd 编辑和并发合并问题。内部 id 不是 URL identity，不是 client scope 的 workspaceId，也不是传给 Codex app-server 的 cwd。

Workspace 侧边栏会话态是前端临时状态。它记录本次侧边栏打开期间用户当前查看或最近进入的 Workspace、当前面板、弹窗提交锁、加载更多状态、卡片级错误和“已归档 / 已恢复”动作标记。它不写入 Workspace Registry，也不进入 slot 持久化。

Workspace thread 列表显式使用 Codex app-server 的 `updated_at desc` 排序能力。排序发生在 Codex `thread/list` 内，My-Code-X 后端和前端都不得在返回结果之上重新排序。

## Data Model & Schema Definition

### Workspace registry

Workspace registry 是 My-Code-X 的本地配置文档。它应是版本化 schema，并包含一个按添加顺序保存的 Workspace record 列表。

每条 Workspace record 包含：

- 内部稳定记录 id。
- canonical cwd。
- name。
- createdAt。

内部稳定记录 id 在记录创建时生成，之后 cwd 编辑、rename 和并发合并都保持不变。canonical cwd 是对外 workspaceId、重复判断依据和 Codex thread/list cwd 参数。name 是纯显示字段，保存用户输入结果。createdAt 只服务于稳定添加顺序和合并后的顺序恢复，不表达最近打开时间。

Workspace registry 不保存 thread 列表、不保存当前选中的 Workspace、不保存 lastOpenedAt、不保存 active/archived 页面状态、不保存卡片动作标记。

### Workspace identity

Workspace 有两层 identity：

- 产品 identity：canonical cwd。
- 内部记录 identity：稳定记录 id。

所有 URL、client scope、selection、Codex request 和用户可理解的 Workspace 身份都使用 canonical cwd。内部记录 id 可以作为 mutation payload 中的不透明 record reference 使用，但不能出现在 URL 或 selection 中，也不能替代 canonical cwd 参与产品语义。

### Path validation and canonicalization

cwd 输入先在服务端 trim 首尾空白，再进行绝对路径、存在性、目录类型、可访问性和 canonicalize 校验。服务端是 canonical cwd 的唯一权威。前端不做路径语义判断，只显示服务端返回的校验错误。

重复判断使用 canonical cwd。Windows 下比较必须处理大小写不敏感语义。Linux 和 macOS 下比较使用当前文件系统 canonical path。canonicalize 失败、路径不可访问和路径不是目录都是 typed validation failure，而不是 generic persistence failure。

### Persistence mode

Workspace registry 运行态有两种主要模式：

- Persistent mode：读写本地 registry 文件，所有变更写入前先读取最新文件并合并。
- Memory mode：registry 不可读、损坏、不可写或写入失败后，使用内存列表继续运行，并明确提示本次变更不会持久保存。

Memory mode 一旦进入，后续 Workspace add、rename、cwd edit、remove 都只更新内存状态，不继续尝试写回已知损坏或不可写的持久化文件。服务重启后重新尝试进入 Persistent mode。

写文件必须使用临时文件和原子替换。写入失败后，用户刚刚执行的变更必须保留在内存状态中，然后切换到 Memory mode。

### Workspace availability

Workspace availability 是侧边栏打开时的即时检查结果，不是持久字段。每次打开侧边栏时，Persistent mode 重新读取 registry 并检查每个 cwd 是否仍存在、是目录且当前进程可访问。Memory mode 使用当前内存 registry，但仍检查 cwd 可用性。

Unavailable Workspace 仍作为 registry record 展示，但只允许 remove。不可用原因可以作为展示和调试信息保留，但不能变成新的 Workspace 生命周期状态。

### Workspace list view

Workspace list view 是 registry records 加 availability 和本次侧边栏会话选中态后的投影。每个 item 至少表达：

- canonical workspaceId。
- 可选的不透明 record reference。
- name。
- cwd。
- availability。
- 是否为当前侧边栏会话选中 Workspace。
- 当前允许的操作集合。

name 为空字符串时，view 也展示空白 name。只有添加 Workspace 且 name 完全为空字符串时，服务端把 cwd basename 写成初始 name。

### Workspace thread page

Workspace thread page 是 Codex thread/list 的一次分页查询结果，不是 Workspace Registry 的一部分。

Thread page 分 active 和 archived 两种 mode。二者都包含当前 canonical workspaceId、资源状态、items、nextCursor、加载更多状态和页级错误。active 使用 archived=false，archived 使用 archived=true。

Thread item 只投影 Codex 返回的 thread 字段和必要 UI 操作能力。核心展示字段是 thread id、name、preview 和 updatedAt。name、preview 为空时不兜底。updatedAt 在进入客户端展示协议前规范化为 ISO string 或 null。

“已归档”和“已恢复”是本次侧边栏页面会话中的动作结果标记，只存在于前端临时页面状态中。它们不写入 Workspace Registry，不写入 thread feature，不写入 Codex。

### Resource states

Workspace 列表、active thread page 和 archived thread page 都用 resource state 表达 loading、ready、failed，而不是用空数组伪装失败。

首屏加载失败是 failed state。空列表是 ready state 下的空 items。加载更多失败不改变已加载 items，只在 load-more 区域记录错误，并保留同一个 cursor 供重试。

## Data Flow

### Sidebar open flow

用户打开侧边栏时，Application 读取当前 Conversation scope。Workspace feature 提供当前 registry snapshot 和 availability snapshot。Application 根据当前 Conversation scope 的 canonical cwd 是否存在于已保存且可用 Workspace 中，决定默认展示 active thread page 或 Workspace list。

如果默认展示 active thread page，Application 使用现有 RuntimePort 查询 Codex thread list，查询参数固定包含 cwd、archived=false、limit=10、updated_at desc 和可选 cursor。Workspace feature 不包装 thread/list，也不新增 ThreadCatalogPort。查询结果由 Presenter 投影为客户端 thread page。

如果当前 Conversation scope 不存在、未保存或不可用，侧边栏默认展示 Workspace list，不临时承认未保存 cwd。

### Workspace add flow

前端提交 cwd 和 name。Application 把意图交给 Workspace feature。Workspace feature trim cwd、校验路径、canonicalize、检查重复、生成内部记录 id 和 createdAt，然后更新 registry。

添加成功后返回更新后的 Workspace list view。添加成功不会触发 Codex thread/list。进入 thread list 是用户之后的显式导航。

### Workspace rename flow

前端提交 record reference、当前 workspaceId 和新 name。Workspace feature 优先用内部记录 id 定位目标记录，并用 canonical cwd 做一致性保护。rename 只更新 name，保留 cwd、createdAt 和内部 id。

rename 失败只在侧边栏内展示。rename 不通知主 Conversation，不修改 slot，不触发 Codex。

### Workspace cwd edit flow

前端提交 record reference、旧 workspaceId 和新 cwd。Workspace feature 校验并 canonicalize 新 cwd，检查新 canonical cwd 不与其他 Workspace 重复，然后用新 cwd 替换目标记录 cwd，保留内部 id、name 和 createdAt。

如果当前侧边栏正在查看该 Workspace 的 active thread page，Application 使用新 cwd 重新查询 active thread page。Workspace cwd edit 不迁移 Codex threads，不保留旧 cwd 别名，不修改主 Conversation。主 Conversation 如果仍引用旧 cwd，之后只是不再被 Workspace 功能承认为已保存 Workspace scope。

### Workspace remove flow

Workspace remove 只删除 Workspace Registry record。它不删除本地目录，不删除 Codex rollouts，不通知主 Conversation。

当前侧边栏会话选中的 Workspace 不允许 remove。Unavailable Workspace 可以 remove，因为它不能进入 thread list。

### Active thread list flow

用户进入可用 Workspace 的 active thread page 时，Application 先通过 Workspace feature 确认该 canonical cwd 已保存且可用，再通过现有 RuntimePort 发起 Codex thread/list 查询。查询参数固定使用 archived=false、limit=10、updated_at desc，并传递当前 cursor。

返回结果保持 Codex 顺序。服务端只做字段规范化，不重排、不补项、不兜底 title 或 preview。updatedAt 规范化为 ISO string 或 null。前端只负责本地时间格式化。

加载更多使用上一次返回的 nextCursor。加载更多失败时，已加载 items 保留，失败 cursor 保留，用户再次点击时重试同一次分页请求。

### Archived thread page flow

用户从当前 Workspace thread page 进入 archived page。Application 使用相同 canonical cwd 通过现有 RuntimePort 查询 Codex thread/list，但 archived=true。archived page 不高亮当前 Conversation thread，也不允许 resume、rename 或 archive。

unarchive 成功后，前端在当前 archived page 上给该卡片打“已恢复”标记并禁用交互。返回 active page 时必须重新查询 active thread list，不做预取。

### Thread resume flow

用户点击非当前 active thread 时，Application 校验 workspace scope，调用 thread action 能力恢复该 thread，并更新 slot/thread/conversation 相关状态。Workspace feature 不直接修改 Conversation timeline，也不直接拥有当前主 Conversation state。

resume 成功后侧边栏关闭。resume 失败时侧边栏保持打开，并在对应卡片展示错误。

### Thread rename flow

active thread rename 由 Application 调用 thread action 能力并传递用户输入的原始 name。Workspace page 在成功后只更新当前卡片 name，不重新拉列表，不重排。

如果 rename 的 thread 是当前主 Conversation thread，Application 触发 Conversation 自己通过恢复当前 thread 刷新标题或相关信息。Workspace feature 不直接写 Conversation 内部状态。

### Thread archive flow

active thread archive 由 Application 调用 thread action 能力。成功后，前端在当前 active page 保留该卡片，打“已归档”标记并禁用交互。

如果 archive 的是当前主 Conversation thread，Application 取消当前 thread 选择，使 Conversation 进入空选择状态。Workspace feature 不直接清空 Conversation。

### Overlay and modal flow

Overlay close 是前端侧边栏会话态转换。没有提交中弹窗时，overlay 关闭侧边栏，并清除当前侧边栏会话选中的 Workspace。存在提交中的 Workspace rename、cwd edit 或 thread rename 弹窗时，overlay close intent 被本地提交锁拦截，侧边栏和弹窗保持打开。

已经提交且不可取消的后端请求不因为 UI 关闭而被取消。请求完成后的结果如果对应页面已关闭，不重新打开侧边栏。

## State ownership

Codex app-server owns thread facts, thread order, pagination cursors, archive/unarchive state, thread name, thread preview, updatedAt and resume results.

Workspace feature owns Workspace Registry domain state, record identity, cwd canonicalization policy, duplicate detection, availability inspection result, persistence mode and read/write merge policy.

Thread action feature owns operations over Codex thread ids: resume, rename, archive and unarchive. It does not own Workspace Registry and does not decide whether a cwd is a saved Workspace.

Thread feature owns loaded or remembered thread metadata used by the rest of the application. It does not own Workspace side panel pages.

Slot feature owns current client slot selection. Future slot persistence can own “last opened Workspace”; 当前 Workspace 功能不拥有该状态。

Conversation feature owns conversation timeline and conversation resource state. Workspace can trigger application-level selection changes or resume flows, but does not mutate Conversation internals.

Application 拥有跨功能编排。它校验 Workspace scope，协调 Workspace feature、现有 RuntimePort、thread action feature、slot feature、thread feature 和 Conversation 刷新，然后返回 action result 或 snapshot。

Presenter owns projection from domain snapshots to frontend-facing contracts. It strips internal-only details and normalizes Codex time values before they reach the web client.

Frontend owns side panel UI state: drawer open/closed, current panel, current side panel selected Workspace, modal states, submit locks, load-more errors, card-level action errors, optimistic-looking action result markers and local time formatting.

Adapters 拥有 filesystem、app data storage 和 Codex process 集成。它们实现 feature 和 application use case 需要的 capability ports，但不得把 raw transport vocabulary 泄漏进产品 contract。

## Module Boundry

Workspace feature 必须聚焦 Workspace Registry、路径校验和 availability inspection。它可以暴露 registry 管理和 saved-workspace 校验命令，但不得实现消息发送、turn 生命周期、Conversation timeline mutation 或 Codex thread 自定义语义。

Workspace feature 依赖通用 capability ports，不依赖 Workspace 专用临时 port。它使用 AppDataStorePort 访问 My-Code-X 数据文档，使用 PathInspectionPort 检查用户 cwd，使用 ClockPort 生成时间，使用 IdPort 生成内部记录 id。它不依赖宽泛的 RuntimePort，也不依赖 Codex thread list 能力。

Workspace Registry schema 解析、重复检查、memory-mode 切换和 merge policy 属于 Workspace feature 内部。AppDataStorePort 只负责读取和原子写入 My-Code-X app data documents；它不知道 Workspace schema，也不知道 Workspace merge rules。

PathInspectionPort 只提供用户项目目录的只读路径能力。它负责 canonicalize 和 inspect path，但不写文件、不扫描项目、不监听目录，也不访问 My-Code-X app data directory。

Thread list 能力属于现有 RuntimePort 能力，不属于 Workspace feature。Application 在 Workspace feature 确认 canonical cwd 已保存且可用后，直接使用 RuntimePort 查询 threads。Workspace feature 不把 RuntimePort 再包装成 Workspace 专用 thread list API，也不引入 ThreadCatalogPort。

Thread resume, rename, archive and unarchive are not Workspace Registry mutations. Application coordinates these operations through thread action capabilities after validating that the workspaceId is saved and available.

Contracts define product-facing Workspace panel shapes, action inputs and action results. Contracts do not expose Codex transport payloads, raw JSON-RPC shapes, filesystem adapter details, or user home storage paths. Sort policy is server-owned; the frontend does not send arbitrary Codex sort/filter fields for the current Workspace feature.

HTTP maps requests to application use cases and maps results to response codes. HTTP does not read registry files, does not canonicalize paths and does not call Codex directly.

Presenter is the only layer that decides how Workspace domain state appears in client snapshots, events and action results. Feature state remains internal and is not re-exported as client contract.

Frontend Workspace UI is a feature area separate from Conversation View. It can be visually hosted by the main mobile shell, but its reducers and side panel state should not be mixed into Conversation timeline components.

### Workspace 相关 port 决策

Workspace 相关 port 使用必须服从项目级 capability model：

- AppDataStorePort 拥有 app data directory 下 My-Code-X app data documents 的访问能力。
- PathInspectionPort 拥有用户输入项目路径的只读检查和 canonicalization 能力。
- ClockPort 拥有当前时间能力。
- IdPort 拥有内部 id 生成能力。
- RuntimePort 拥有 Codex thread listing、reading 和 mutation transport 能力；Workspace thread page 当前尊重已有 RuntimePort structure，不新增 ThreadCatalogPort。
- Thread session 和 thread mutation 能力通过 thread action 编排消费，不通过 Workspace feature 消费。

Workspace feature 消费 AppDataStorePort、PathInspectionPort、ClockPort 和 IdPort。它不直接消费 RuntimePort。Workspace 页面需要 active 或 archived threads 时，由 Application 消费现有 RuntimePort。

架构刻意不引入 WorkspaceRegistryStorePort、WorkspacePathPort 或 WorkspaceThreadListPort。这些名字会把 port 绑定到单个 feature，并诱导未来 feature 为同一类能力创建平行的一次性 ports。

## API contracts

### Workspace list contract

Workspace list contract represents the side panel list page. It includes resource state, persistence mode, optional persistence warning, selected workspaceId for the current side panel session, and ordered Workspace list items.

Workspace list item includes canonical workspaceId, optional opaque record reference, name, cwd, availability, unavailable reason when useful, selected flag and allowed operations.

### Workspace registry mutation contracts

Workspace add input includes cwd and name. cwd is trimmed by server; name is preserved as submitted.

Workspace rename input includes target record reference when available, current workspaceId for consistency, and new name.

Workspace cwd edit input includes target record reference when available, current workspaceId for consistency, and new cwd.

Workspace remove input includes target record reference when available and current workspaceId.

All registry mutation outputs return either typed validation/persistence errors or an updated Workspace list projection. Successful add, rename, cwd edit and remove do not implicitly return thread list data unless cwd edit changed the Workspace currently being viewed in active thread page.

### Workspace thread page contract

Thread page contract includes workspaceId, page mode, resource state, ordered thread items, nextCursor, load-more state and optional page-level error.

Thread item includes threadId, name, preview, updatedAtIso, whether it is current main Conversation thread when active page allows highlighting, current card operation state, and card-level error.

Archived page thread items do not expose resume, rename or archive operations. Active page thread items expose resume except for the current main Conversation thread, and expose rename/archive unless a local action marker has disabled the card.

### Thread action contracts

Resume active thread action uses canonical workspaceId and threadId. Success returns enough information for the application to switch the main Conversation and close the side panel. Failure returns a card-scoped error.

Rename active thread action uses threadId and raw name. Success returns the accepted name for immediate card update. If the renamed thread is current main Conversation thread, the application also triggers a Conversation-owned refresh.

Archive active thread action uses threadId. Success returns an action result that lets the frontend mark the card as archived and disabled. If the archived thread is current main Conversation thread, the application also clears the current thread selection.

Unarchive archived thread action uses threadId. Success returns an action result that lets the frontend mark the card as restored and disabled. It does not trigger active page prefetch.

### Scope and event contracts

Client scope workspaceId remains canonical cwd. Workspace-specific events and action results should be scoped by slot and canonical workspaceId. Internal record reference, when present, is an opaque mutation target and not a scope identity.

当前 Workspace 功能可以用 request/response action results 承载侧边栏操作。Streaming events only apply when the main client snapshot or cross-feature selection changes. Thread list pagination does not require event streaming.

## Slice 2 Implementation Plan - 侧边栏导航与 Active Threads 浏览闭环

- **Type:** AFK
- **Blocked by:** Workspace Slice 1
- **Feature requirements covered:** 手机端侧边栏导航；Workspace 列表进入；Active Thread 列表；Active Thread resume；Active Thread 分页；当前主 thread 高亮

## 目标

实现 Workspace 侧边栏的第二个完整闭环：用户打开 Workspace panel 后，能按当前 Conversation scope 默认进入 active threads 或 Workspace list；能从 Workspace list 进入某个 Workspace 的 active threads；能分页浏览；能点击非当前 active thread 恢复主 Conversation。

本 slice 尊重 `apps-new` 现有结构：不新增 ThreadCatalogPort。Workspace Registry 仍由 Workspace feature 拥有；thread/list 和 resume 的跨功能编排由 Application 使用现有 RuntimePort 与 thread action capability 完成。

## 已决策设计

- `WorkspacePanelView` 同时持有本次侧边栏打开时的 Workspace list snapshot 和当前 page。
- 当前 page 使用 discriminated union 表达：
  - Workspace list page。
  - Active threads loading page。
  - Active threads ready page。
  - Active threads failed page。
- `open-workspace-panel` 根据当前 Conversation scope 决定默认 page：
  - scope cwd 是已保存且可用 Workspace：默认 active threads。
  - scope cwd 不存在、未保存或不可用：默认 Workspace list。
- 从 active threads 返回 Workspace list 是前端 reducer 本地切页，不重新请求 server。
- 从 Workspace list 进入 active threads、active threads load more 必须请求 server。
- Application 直接使用现有 RuntimePort 调 Codex `thread/list`，不新增 ThreadCatalogPort，不让 Workspace feature 包装 thread list。
- Active thread list 的 server policy 固定：
  - `archived = false`
  - `sortKey = "updated_at"`
  - `sortDirection = "desc"`
  - `limit = 10`
  - 可选 `cursor`
  - 不传 `searchTerm`
- Codex 返回顺序必须原样保留，不在前端或后端重排。
- `updatedAt` 在 server 侧进入 client contract 前规范化为 `updatedAtIso: string | null`。
- 前端只格式化 `updatedAtIso` 为本地绝对时间，不猜测 number 单位。
- Active thread item contract 使用产品字段：`threadId`、`name`、`preview`、`updatedAtIso`、`current`。
- `resume-thread` 复用现有 client action：
  - `scope.workspaceId` 是 canonical cwd。
  - `scope.threadId` 是目标 thread id。
  - `payload` 是 strict empty object。
- 点击当前主 Conversation thread 不响应，侧边栏保持打开。
- resume 非当前 thread 成功后，主 Conversation 切换到该 thread，侧边栏关闭。
- resume 失败时，侧边栏保持打开，并在对应 thread 卡片就地显示错误。

## 垂直路径

### Contracts

- 扩展 Workspace panel contract，让 ready panel 同时包含 `list` 和 `page`。
- 增加 active thread page view：
  - workspace identity。
  - resource state。
  - ordered items。
  - `nextCursor`。
  - load-more 相关错误由前端页面状态承载。
- 增加 active thread item view：
  - `threadId`
  - `name`
  - `preview`
  - `updatedAtIso`
  - `current`
- 增加或收紧 client actions：
  - `open-workspace-active-threads`
  - `load-more-workspace-active-threads`
  - `resume-thread` payload 为 strict empty object。

### Server Application

- `open-workspace-panel`：
  - 读取 Workspace list snapshot。
  - 校验当前 scope workspace 是否 saved + available。
  - 命中时用 RuntimePort 拉 active threads，并返回 active page。
  - 未命中时返回 Workspace list page。
  - 如果 Workspace list 读取失败，返回 panel failed。
  - 如果默认 active thread 首屏失败，返回 ready panel + active failed page。
- `open-workspace-active-threads`：
  - 校验目标 workspace saved + available。
  - 用 RuntimePort 拉 active threads 首屏。
  - 返回 ready panel page。
- `load-more-workspace-active-threads`：
  - 校验目标 workspace saved + available。
  - 用 RuntimePort 拉同一个 cursor 的下一页。
  - 返回新增 page items 和 nextCursor。
- `resume-client-thread`：
  - 校验 `slotId`、`workspaceId`、`threadId`。
  - 校验 workspace saved + available。
  - 调 thread action open/resume。
  - 成功后更新 slot/thread/conversation，并返回 snapshot。
  - 失败后返回 typed rejected result。

### Server Presenter

- 将 RuntimeThread 投影成 active thread item contract。
- `name`、`preview` 为空时保持为空，不兜底。
- `updatedAt` Unix 秒数或秒数字符串规范化为 ISO string；不可解析时返回 null。
- 不暴露 RuntimeThread raw payload、Codex transport 字段或 RuntimePort command 字段。

### Web Model

- 扩展 Workspace panel reducer：
  - 保存 panel list snapshot。
  - 保存当前 page。
  - 支持本地返回 list。
  - 支持 active page loading / ready / failed。
  - 支持 load-more loading / error，并保留失败 cursor。
  - 支持 card-level resume submitting / error。
- Controller 增加：
  - 打开 active threads。
  - 返回 Workspace list。
  - 加载更多。
  - resume thread。
- resume 成功后通知 AppShell 使用返回 snapshot 更新 Conversation 和当前 scope，并关闭 Workspace panel。

### Web Component

- Workspace list item 对 available Workspace 提供进入 active threads 的交互。
- Active page 顶部显示当前 Workspace name 和 cwd，并提供返回 Workspace list 的按钮。
- Active thread card 展示 `name`、`preview`、本地格式化后的 `updatedAtIso`。
- 当前主 Conversation thread 卡片高亮并禁用 resume。
- 首屏失败显示错误和返回 Workspace list 入口。
- 空列表显示空状态，不提供新建 thread 入口。
- load more 失败时保留已有 items，并在 load-more 区域显示错误；再次点击重试同一 cursor。

## 完成后可验证

- 当前 Conversation scope 是 saved available Workspace 时，打开侧边栏默认进入 active threads。
- 当前 Conversation scope 未保存或不可用时，打开侧边栏默认进入 Workspace list。
- 从 Workspace list 进入可用 Workspace 会加载 active threads。
- 从 active threads 返回 Workspace list 不请求 server，且本次侧边栏会话选中 Workspace 保持高亮。
- active thread list 请求参数固定为 cwd、archived=false、limit=10、updated_at desc。
- active thread 顺序与 Codex 返回顺序一致。
- active thread 字段为空时 UI 不显示兜底内容。
- load more 成功 append items；失败保留已有 items 并可重试同一 cursor。
- 点击当前主 thread 不响应。
- 点击非当前 thread 成功后主 Conversation 切换，Workspace panel 关闭。
- resume 失败后 Workspace panel 保持打开，对应 card 显示错误。

## 测试范围

- `npm run test:contracts-new`
- `npm run test:server-new`
- `npm run test:web-new`
- `npm run typecheck:new`
- `npm run lint:new`

## 非目标

- 不实现 active thread rename。
- 不实现 active thread archive。
- 不实现 archived threads 页面。
- 不实现 unarchive。
- 不实现新建 thread 入口。
- 不实现 searchTerm、筛选、手动刷新或最近打开 Workspace。
- 不新增 ThreadCatalogPort。
- 不让 Workspace feature 直接消费 RuntimePort 或包装 thread/list。

## Other Architectural decisions

updatedAt normalization happens before data reaches the frontend. Codex raw updatedAt seconds become ISO string or null. Frontend formats ISO string to local mobile-friendly absolute time and never guesses number units.

Codex thread/list fields are not reinterpreted. Empty name and preview stay empty. Missing updatedAt stays missing. My-Code-X does not synthesize “未命名对话”、fallback preview, fallback time or thread status labels.

Workspace does not watch filesystem changes and does not provide a manual refresh button within the current scope. Availability is checked on side panel open and on operations that need a valid cwd.

Workspace does not read Codex rollout files directly. All thread list, archive, unarchive, rename and resume behavior comes through Codex app-server capabilities.

Concurrency is intentionally simple. Persistent mode reads latest registry before every write and merges by internal record id. Different Workspace changes should be preserved. Same Workspace changes are last-write-wins. If a client can only identify a record by old canonical cwd and concurrent cwd edit made it unfindable, the operation fails with a stale or missing record error.

The architecture optimizes for small, explicit flows rather than a broad Workspace manager. Each operation does one job: registry mutation, availability inspection, thread list query, or thread action orchestration. Cross-feature effects stay in Application, not inside Workspace feature internals.
