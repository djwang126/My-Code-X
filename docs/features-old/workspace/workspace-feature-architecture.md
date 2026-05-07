# Architecture Decisions

## Summary

Workspace 采用“Workspace Registry + Codex thread 权威来源 + Application 跨功能编排 + Frontend 侧边栏会话态”的结构。

Workspace Registry 只保存 My-Code-X 自己管理的工作区记录。Codex app-server 是 thread 列表、thread 字段、thread 顺序、分页游标、归档状态、重命名结果和恢复结果的权威来源。Workspace 不从 registry 推断 thread，不持久化 thread UI 标记，也不把 Codex thread 重新解释成 My-Code-X 自定义状态。

Workspace 的产品身份是 canonical cwd。内部稳定记录 id 只服务于 registry 记录定位、cwd 编辑和并发合并，不成为 URL、client scope、selection 或 Codex 请求中的 Workspace 身份。

## Domain Model & Invariants

Workspace record 是用户手动保存的本机项目目录记录。每条记录包含内部稳定记录 id、canonical cwd、name 和 createdAt。

canonical cwd 是 Workspace 的产品身份、重复判断依据、client scope workspaceId 和 Codex thread/list cwd 参数。name 是纯显示字段，不参与身份判断。createdAt 只用于保留添加顺序和合并后的稳定顺序，不表达最近打开时间。

Workspace registry 是有序记录集合。同一个 canonical cwd 最多存在一条记录。cwd 编辑会让同一条 Workspace record 使用新的 canonical cwd，内部记录 id、name 和 createdAt 保持不变。cwd 编辑不创建旧 cwd 别名，不迁移 Codex threads，不维护旧 cwd 到新 cwd 的映射。

cwd canonicalization 必须保留跨平台路径语义。Windows 支持盘符路径和 UNC 路径，重复判断按 Windows 路径大小写不敏感语义处理。Linux 和 macOS 使用当前文件系统给出的 canonical path 作为重复判断依据。

Workspace availability 是即时检查结果，不是持久字段。不可用 Workspace 仍是 registry record，但只允许 remove。不可用原因可以进入展示和调试信息，但不成为新的 Workspace 生命周期状态。

Workspace thread page 是 Codex thread/list 的分页查询结果，不属于 Workspace registry。active page 使用 active threads，archived page 使用 archived threads。两类页面都保留 Codex 返回顺序。name、preview 为空时保持为空。updatedAt 在进入客户端展示协议前规范化为可展示时间值或 null。

“已归档”和“已恢复”是当前侧边栏页面会话中的动作结果标记。它们只存在于前端临时页面状态中，不写入 Workspace registry，不写入 Codex，也不成为 thread feature 的持久状态。

Workspace resource state 使用 loading、ready、failed 表达首屏状态。空列表是 ready state 下的空 items，不是 failed state。加载更多失败不清空已加载 items，只记录 load-more 区域错误并保留重试所需的分页上下文。

## System Boundaries

Workspace feature 负责 registry 领域规则、路径 canonicalization 策略、重复检查、availability inspection、persistence mode 和读写合并策略。

Codex app-server 负责 thread facts、thread order、pagination cursor、archive/unarchive state、thread name、thread preview、updatedAt 和 resume result。

Application 负责跨功能编排。它校验 Workspace scope，协调 Workspace feature、Codex runtime capability、thread action capability、slot、thread 和 Conversation，然后返回 action result 或 snapshot。

Presenter 负责把 domain snapshot 投影成客户端协议。Presenter 会剥离内部字段，并在数据到达 web client 前规范化 Codex 时间值。

Frontend 负责侧边栏 UI 会话态、页面切换、弹窗状态、提交锁、加载更多错误、卡片级错误、动作结果标记和本地时间格式化。

Adapters 负责 filesystem、app data storage 和 Codex process 集成。Adapter 实现 application 和 feature 需要的 capability，但不把 raw transport vocabulary 泄漏进产品 contract。

Workspace 不拥有 Conversation timeline，不实现消息发送，不处理 turn 生命周期，不删除本地目录，不删除 Codex threads，不扫描 Codex session 文件作为 Workspace 数据来源。

## State Ownership

Workspace feature owns Workspace Registry domain state、record identity、canonical cwd policy、duplicate detection、availability inspection result、persistence mode 和 registry merge policy。

Codex app-server owns thread facts、thread ordering、pagination、archive state、thread names、previews、updatedAt 和 resume behavior。

Thread action capability owns Codex thread id 上的 resume、rename、archive 和 unarchive 操作。它不拥有 Workspace registry，也不决定某个 cwd 是否是已保存 Workspace。

Slot feature owns 当前 client slot selection。未来 slot persistence 可以拥有“上次打开 Workspace”。

Conversation feature owns conversation timeline 和 conversation resource state。Workspace 可以触发 application-level selection change 或 resume flow，但不直接修改 Conversation 内部状态。

Presenter owns frontend-facing projection。内部 record id、adapter 细节和 raw Codex payload 不作为产品状态暴露。

Frontend owns side panel UI state：drawer open/closed、current panel、current side panel selected Workspace、modal state、submit lock、load-more error、card-level action error、action result marker 和 local time formatting。

## Backend Architecture

### Data Model & Schema Definition

Workspace registry 是 My-Code-X app data 中的版本化文档。registry 包含按添加顺序保存的 Workspace records。

My-Code-X app data 位于用户 home 下的 `.my-code-x` 数据目录。Workspace registry 不存储在项目仓库目录中，也不写入 Codex 原生 `.codex` 数据目录。数据目录不存在时，服务端在启动或首次写入时创建。

Workspace record 字段：

1. 内部稳定记录 id。
2. canonical cwd。
3. name。
4. createdAt。

内部稳定记录 id 在记录创建时生成。cwd 编辑、rename 和并发合并保持该 id 不变。canonical cwd 是对外 workspaceId、重复判断依据和 Codex thread/list cwd 参数。name 保存用户输入结果。createdAt 只服务于稳定添加顺序。

Workspace registry 不保存 thread 列表、不保存当前选中的 Workspace、不保存 lastOpenedAt、不保存 active 或 archived 页面状态、不保存卡片动作标记。

Persistence mode 有两种：

1. Persistent mode：读取并写入 app data registry，变更写入前读取最新 registry 并合并。
2. Memory mode：registry 不可读、损坏、不可写或写入失败后，使用内存 registry 继续运行，并通过 contract 暴露持久化警告。

Memory mode 进入后，本次运行内的 Workspace add、rename、cwd edit 和 remove 都更新内存 registry。服务重启后重新评估持久化可用性。

registry 损坏时不得自动覆盖、自动修复或自动备份原 registry，也不得把内存状态写回已知损坏的 registry。写入失败后，用户刚刚执行的变更保留在内存 registry 中，然后切换到 Memory mode。进入 Memory mode 后，本次运行内不继续尝试写回已知损坏或不可写的 registry。

### Data Flow

用户打开侧边栏时，Application 读取当前 Conversation scope，获取 Workspace registry snapshot 和 availability snapshot。如果当前 Conversation scope 的 canonical cwd 已保存且可用，Application 查询该 Workspace 的 active threads 并返回 active page；否则返回 Workspace list page。

添加 Workspace 时，前端提交 cwd 和 name。Workspace feature trim cwd、校验路径、canonicalize、检查重复、创建 record，然后更新 registry。添加成功返回更新后的 Workspace list projection，不触发 thread list 查询。

rename Workspace 时，前端提交目标记录引用、当前 workspaceId 和新 name。Workspace feature 定位目标记录，使用当前 workspaceId 做一致性保护，只更新 name，并返回更新后的 Workspace list projection。

编辑 Workspace cwd 时，前端提交目标记录引用、当前 workspaceId 和新 cwd。Workspace feature 校验并 canonicalize 新 cwd，检查新 canonical cwd 不与其他 Workspace 重复，然后替换目标记录的 cwd。当前侧边栏正在查看该 Workspace active page 时，Application 使用新 cwd 重新查询 active threads。

remove Workspace 时，Workspace feature 删除 registry record。该操作只影响 Workspace registry，不删除本地目录，不删除 Codex threads，不通知主 Conversation。

进入 active thread page 时，Application 先确认 workspaceId 对应已保存且可用 Workspace，再查询 Codex active thread list。查询参数固定包含当前 Workspace cwd、archived=false、limit=10、sortKey=updated_at、sortDirection=desc 和可选 cursor，不传 searchTerm。返回结果保持 Codex 顺序，Presenter 只做产品 contract 投影和时间规范化。

进入 archived thread page 时，Application 使用同一 canonical cwd 查询 Codex archived thread list。查询参数固定包含当前 Workspace cwd、archived=true、limit=10、sortKey=updated_at、sortDirection=desc 和可选 cursor，不传 searchTerm。archived page 不允许 resume、rename 或 archive。

resume active thread 时，Application 校验 Workspace scope，调用 thread action capability 恢复目标 thread，并协调 slot、thread 和 Conversation 状态。成功后返回主界面更新所需 snapshot 并关闭侧边栏；失败时返回卡片级错误。

rename active thread 时，Application 调用 thread action capability，并把用户输入的 raw name 交给 Codex。成功后当前卡片显示新 name。若目标 thread 是当前主 Conversation thread，Application 触发 Conversation 自己刷新相关显示。

archive active thread 时，Application 调用 thread action capability。成功后前端在当前 active page 保留卡片，标记“已归档”并禁用交互。若目标 thread 是当前主 Conversation thread，Application 清除当前 thread selection，使 Conversation 进入空选择状态。

unarchive archived thread 时，Application 调用 thread action capability。成功后前端在当前 archived page 保留卡片，标记“已恢复”并禁用交互。返回 active page 时重新查询 active threads。

### Module Boundary

Workspace feature 聚焦 Workspace registry、路径校验、availability inspection 和 registry persistence policy。它暴露 registry 管理和 saved-workspace 校验能力，不实现消息发送、turn 生命周期、Conversation timeline mutation 或 Codex thread 自定义语义。

Application 是 Workspace 与 Codex thread 能力之间的编排层。Workspace feature 确认 workspaceId 已保存且可用后，Application 查询 Codex threads 或执行 thread action。

Contracts 定义产品面对的 Workspace panel shape、action input 和 action result。Contracts 不暴露 raw Codex transport payload、filesystem adapter 细节或 storage implementation 细节。

HTTP 只把请求映射到 application use case，并把结果映射为响应。HTTP 不读取 registry，不 canonicalize path，不直接调用 Codex。

Presenter 是 domain state 到 client snapshot、events 和 action results 的唯一投影层。Feature 内部状态不直接重新导出为 client contract。

Frontend Workspace UI 是独立于 Conversation View 的 feature area。它可以被 mobile shell 承载，但 reducer 和侧边栏页面状态不混入 Conversation timeline component。

### API contracts

Workspace list contract 表达侧边栏列表页。它包含 resource state、persistence mode、可选 persistence warning、本次侧边栏会话选中的 workspaceId，以及有序 Workspace list items。

Workspace list item 包含 canonical workspaceId、可选不透明 record reference、name、cwd、availability、可选 unavailable reason、selected flag 和 allowed operations。

Workspace add input 包含 cwd 和 name。服务端 trim cwd，name 按提交值保存。

Workspace rename input 包含目标 record reference、当前 workspaceId 和新 name。

Workspace cwd edit input 包含目标 record reference、当前 workspaceId 和新 cwd。

Workspace remove input 包含目标 record reference 和当前 workspaceId。

Registry mutation output 返回 typed validation error、typed persistence error 或更新后的 Workspace list projection。成功 add、rename、cwd edit 和 remove 不隐式返回 thread list，除非 cwd edit 改变了当前正在查看的 active thread page。

Thread page contract 包含 workspaceId、page mode、resource state、ordered thread items、nextCursor、load-more state 和可选 page-level error。

Thread item 包含 threadId、name、preview、updatedAtIso、active page 下是否为当前主 Conversation thread、当前卡片操作状态和 card-level error。

Archived page thread item 不暴露 resume、rename 或 archive 操作。Active page thread item 暴露 resume、rename 和 archive，但当前主 Conversation thread 的 resume 被禁用，被动作结果标记禁用的卡片不再暴露交互操作。

Resume active thread action 使用 canonical workspaceId 和 threadId。成功返回足够让 application 切换主 Conversation 并关闭侧边栏的信息；失败返回 card-scoped error。

Rename active thread action 使用 threadId 和 raw name。成功返回被接受的 name 供当前卡片立即更新。当前主 Conversation thread 被 rename 时，application 同步触发 Conversation refresh。

Archive active thread action 使用 threadId。成功返回 action result，让前端把卡片标记为 archived 并禁用。当前主 Conversation thread 被 archive 时，application 同步清除当前 thread selection。

Unarchive archived thread action 使用 threadId。成功返回 action result，让前端把卡片标记为 restored 并禁用。该 action 不触发 active page 预取。

Client scope workspaceId 始终是 canonical cwd。URL 或 client scope 中携带 workspaceId 时必须使用 URL encoded canonical cwd。内部 record reference 是 mutation target，不是 scope identity。

Workspace-specific action results 和 events 必须按 slot 与 canonical workspaceId 定位。Thread list pagination 使用 request/response action result，不需要 streaming event。Streaming event 只用于 main client snapshot 或跨功能 selection 变化。

### Error Handling

路径校验错误是 typed validation failure，包括空 cwd、非绝对路径、路径不存在、不是目录、不可访问、canonicalize 失败和重复 Workspace。

持久化错误是 typed persistence failure，包括 registry 不可读、schema 损坏、不可写和写入失败。进入 Memory mode 后，mutation 结果作用于内存 registry，并通过 contract 提示本次变更不会持久保存。

Workspace list、active thread page 和 archived thread page 的首屏失败使用 failed resource state，不用空数组伪装失败。

加载更多失败保留已加载 items、保留失败 cursor，并在 load-more 区域记录错误。再次点击加载更多时重试同一次分页请求。

卡片级操作错误绑定到触发操作的 thread item。resume、rename、archive 和 unarchive 失败不关闭侧边栏，不清空页面。

提交中弹窗通过前端 submit lock 阻止关闭。已经提交且不可取消的后端请求不会因为侧边栏关闭而被取消；请求完成后如果对应页面已关闭，不重新打开侧边栏。

### Adapter / Port Decisions

App data storage capability 负责读取和原子写入 My-Code-X app data documents。写入 registry 时必须使用临时文件和原子替换。它不知道 Workspace schema，也不知道 Workspace merge rules。

Path inspection capability 负责用户输入项目路径的只读检查和 canonicalization。它不写项目目录，不扫描项目，不监听目录变化，也不访问 app data storage。

Clock capability 负责创建时间值。Id capability 负责内部记录 id 生成。

Codex runtime capability 负责 Codex thread listing、reading 和 mutation transport。Workspace feature 不直接消费 Codex runtime capability；需要 thread list 或 thread action 时由 Application 编排。

Thread action capability 负责 resume、rename、archive 和 unarchive 的产品级动作结果。Workspace registry mutation 和 thread mutation 保持分离。

### Other Backend Decisions

写 registry 时，Persistent mode 在每次 mutation 前读取最新 registry，按内部 record id 合并目标记录，再写回完整 registry。不同 Workspace 的并发修改尽量保留。同一 Workspace 的并发修改采用最后写入结果。

cwd canonicalization 在服务端完成。前端不判断路径语义，只显示服务端返回的校验结果。

Codex thread/list 的排序和分页策略由服务端固定为当前 Workspace 功能需要的最近更新时间降序和每页 10 条。前端不发送任意排序或过滤字段，也不发送 searchTerm。

## Frontend Architecture

### UI State Model

Workspace panel state 包含 drawer open/closed、本次侧边栏会话选中的 workspaceId、Workspace list snapshot、当前 page、modal state、submit lock、load-more state、card-level action state 和 action result markers。

当前 page 使用明确状态表达 Workspace list、active threads loading、active threads ready、active threads failed、archived threads loading、archived threads ready 和 archived threads failed。

从 active 或 archived 返回 Workspace list 是前端本地页面切换。返回 list 不重新请求 server，并保留本次侧边栏会话选中 Workspace 用于高亮和 remove 禁用。

关闭侧边栏会清除本次侧边栏会话选中 Workspace、当前 page、modal state、load-more error、card-level error 和 action result markers。

### Data Model & Schema Definition

Frontend Workspace list item 使用 client contract 中的 workspaceId、record reference、name、cwd、availability、selected flag 和 allowed operations。

Frontend thread item 使用 threadId、name、preview、updatedAtIso、current flag、operation state、card-level error 和 action result marker。

Frontend 不持有 raw Codex payload，不猜测 updatedAt number 单位，不把 action result marker 写入持久状态。

### Data Flow

打开 Workspace panel 时，frontend 发起 open panel action，并用返回的 panel snapshot 初始化 list snapshot 和当前 page。

从 Workspace list 进入 active threads 时，frontend 发起 open active threads action。成功后替换当前 page；失败后展示 active failed page 或 action error。

加载更多时，frontend 使用当前 page 的 nextCursor 发起 load-more action。成功后 append items 并更新 nextCursor；失败后保留 items 和失败 cursor。

resume thread 成功后，frontend 使用返回 snapshot 更新 AppShell、Conversation 和当前 scope，然后关闭 Workspace panel。失败后在对应卡片展示错误。

rename thread 成功后，frontend 只更新当前卡片 name，不重新拉列表，不重排列表。失败后保留弹窗并展示错误。

archive 或 unarchive 成功后，frontend 在当前页面给卡片设置动作结果标记并禁用交互。失败后在对应卡片或操作区域展示错误。

overlay close intent 进入本地 reducer。没有提交中弹窗时关闭侧边栏；存在提交中弹窗时忽略 close intent。

### Module Boundary

Workspace frontend model 负责侧边栏 reducer、client action orchestration 和 Workspace page state。

Workspace frontend components 负责渲染列表、thread page、empty state、failed state、modal 和操作入口。

Mobile shell 只承载 Workspace 入口和 drawer 容器。Conversation timeline component 不拥有 Workspace page state。

### API contracts

Frontend 只依赖 Workspace panel contract、Workspace mutation action result、thread page contract 和 thread action result。

Frontend 发送 Workspace mutation 时传递用户输入值和当前 contract 中的不透明 target reference。Frontend 不构造内部 record id，不 canonicalize cwd，不决定 Workspace 是否重复。

Frontend 展示 thread 时间时只消费 updatedAtIso。updatedAtIso 为 null 或不可格式化时，UI 显示为空或不可用状态，不发明 fallback 时间。

### Error Handling

首屏 failed page 必须提供返回 Workspace list 或返回当前 Workspace 的入口，避免用户卡在错误页。

load-more error 显示在加载更多区域，不覆盖首屏 items。

card-level error 显示在对应 thread 卡片或对应操作区域，不提升为整个 panel failed state。

提交中的 modal 禁止关闭，并禁用重复提交。提交完成后按成功或失败结果更新 modal 和页面状态。

### Other Frontend Decisions

Workspace list、active page 和 archived page 的空状态不提供新建 thread 入口。

Active page 高亮当前主 Conversation thread，并禁用该卡片的 resume 交互。

Archived page 不高亮当前主 Conversation thread，不提供 resume、rename 或 archive 交互。

本地时间格式化只发生在 frontend display 层。排序和时间语义不由 frontend 推断。

## Cross-cutting Decisions

Workspace 使用 typed validation 和 typed persistence errors，确保 UI 能展示具体、可操作的错误。

Workspace 不监听 filesystem 变化，不提供手动刷新。Availability 在侧边栏打开和需要有效 cwd 的操作中检查。

Workspace 不删除用户项目目录，不删除 Codex threads，不从 Codex rollout 文件直接构建 Workspace 数据。

Workspace 的并发策略保持简单。Persistent mode 每次写入前读取最新 registry 并按内部记录 id 合并。同一记录冲突时最后写入结果生效。

Workspace 对外暴露 canonical cwd 会出现在本地个人工具的 URL 或 client scope 中。该 scope 不承诺可跨设备分享。

Workspace feature、thread action、slot、thread 和 Conversation 的状态所有权保持分离。跨功能影响由 Application 编排，不在 feature 内部互相修改。
