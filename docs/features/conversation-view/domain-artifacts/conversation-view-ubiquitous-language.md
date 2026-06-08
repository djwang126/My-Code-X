# Ubiquitous Language — Conversation View

> 按 Bounded Context 字母序;每个 Context 内按术语字母序。跨 Context 同词异义集中在末尾 Cross-Context Terms。

## Composer

### Composer
- **Definition**: 输入区;多行,按对话在本地客户端保存 draft。后端不持有其状态(无 aggregate),只暴露提交/追加/中断的中继命令。
- **Aliases / Disambiguation**: 拒绝 input box / editor。

### Draft
- **Definition**: Composer 中按对话保存的本地未发送文本;不跨客户端同步。输入被接受才清空,失败保持不变。
- **Aliases / Disambiguation**: 拒绝 unsent text。

### InstructionAppend
- **Definition**: turn 进行中、agent cli 支持时,向当前 turn 追加的指令。
- **Aliases / Disambiguation**: 拒绝 follow-up。

### NormalInput
- **Definition**: 用户提交的普通输入;被接受后作为 Normal Conversation Content 进入信息列表。
- **Aliases / Disambiguation**: 拒绝 user message。

### PrimaryActionButton
- **Definition**: Composer 主操作按钮;动作由 (TurnState, Composer 是否有输入, AgentCliCapability) 唯一决定:发送/补充指令/中断/禁用。派生态,不持久。
- **Aliases / Disambiguation**: 拒绝 send button。

### WorkInterrupt
- **Definition**: 中断当前进行中 turn 的工作;需二次确认;结果由后续 agent 信息与 TurnState 变化体现,无独立成功事件。
- **Aliases / Disambiguation**: 拒绝 cancel / stop / abort。

## ConversationProjection

### Classification
- **Definition**: 产品内部对 Message 的渲染归类,四类之一:Normal Conversation / Work Process / Failure / Unrecognized。是样式而非可见文案;无专门规则时落 Generic Field Rendering。
- **Aliases / Disambiguation**: 拒绝 category / kind。

### ConversationProjection
- **Definition**: 后端持有的、某对话当前可读内容的权威投影:有序 Message、Turn、加载/同步相位(Phase)、续接位点。是权威缓存,非持久审计来源(历史靠 agent native recovery)。
- **Aliases / Disambiguation**: 拒绝 conversation state / view model。

### FailureInfo
- **Definition**: 失败信息分类;醒目展示,走 Generic Field Rendering;无结构化内容时显示 `Unknown error`。agent 给出的带归属错误即归此并进入对话列表。
- **Aliases / Disambiguation**: 拒绝 error message。见 Cross-Context「Error/Failure」。

### GenericFieldRendering
- **Definition**: 兜底渲染:把结构化字段(字段名+字段内容)逐条渲染为可读内容,用于无专门展示规则的信息。
- **Aliases / Disambiguation**: 拒绝 fallback render / raw render。

### HistoryRecovery
- **Definition**: 首次打开对话时经 agent cli native 历史恢复加载权威历史的相位;恢复出的对话必为非运行中。空对话/失败有专门文案。
- **Aliases / Disambiguation**: 与 Sync 区分:Recovery 是首次,Sync 是已有内容对齐。

### LiveUpdate
- **Definition**: agent cli 实时输出时后端向前端推送增量、保持前端与后端同步的机制;由 agent cli 是否在输出驱动。
- **Aliases / Disambiguation**: 拒绝 streaming / push。

### Message
- **Definition**: agent cli 输出的一条结构化信息(字段名+字段内容),由 agent cli 固定键唯一标识;携带 NativeType、可选 NativeStatus、Classification、MessageContent。
- **Aliases / Disambiguation**: 拒绝 item / entry;不用 event(避免与 Domain Event 混)。

### NativeStatus
- **Definition**: agent cli 原生提供的状态字段;仅作文案透传,不作产品内部状态依据。
- **Aliases / Disambiguation**: 必带 native 前缀。见 Cross-Context「Status」。

### NativeType
- **Definition**: agent cli 原生提供的类型字段;经 ACL 映射到 Classification。可能缺失,Unrecognized 摘要显示 `Unknown type`。
- **Aliases / Disambiguation**: 必带 native 前缀。

### Phase
- **Definition**: ConversationProjection 的相位状态机:HistoryRecovering / RecoveryFailed / Synced / Syncing / SyncFailed / ProtocolBroken。同时充当 ConversationResyncProcess 的流程状态。
- **Aliases / Disambiguation**: SyncFailed 可重试同步;ProtocolBroken 重试无意义(agent cli 坏/协议不同步)。

### ProtocolBroken
- **Definition**: Phase 的一个终态分支;agent cli 故障或协议不同步(如缺失固定键)导致投影不可信,重试同步无意义,保留已有内容可读。
- **Aliases / Disambiguation**: 区别于 SyncFailed(可重试)。

### ResumeCursor
- **Definition**: 续接位点;保证同步快照与后续 live update 增量不丢不重的游标。
- **Aliases / Disambiguation**: 拒绝 offset / checkpoint。

### Sync
- **Definition**: 已有内容的对话对齐后端权威状态的相位(断线/弱网/切后台/重连后);保持旧内容可读,失败可重试。
- **Aliases / Disambiguation**: 拒绝 refresh / reload。

### Turn
- **Definition**: 一轮交互边界,完全由 agent cli 提供,本 feature 不自行推断;含至少一条用户输入。
- **Aliases / Disambiguation**: 拒绝 round / exchange。

### TurnState
- **Definition**: Turn 的状态:InProgress / Interrupting / Ended,由 agent cli 提供。
- **Aliases / Disambiguation**: 见 Cross-Context「Status」。

### TurnToolbar
- **Definition**: turn 首条用户信息下方 / 末条 agent 回复下方的工具栏;best-effort 显示最接近 turn 起/止的时间;首尾为普通内容时含复制按钮。
- **Aliases / Disambiguation**: 拒绝 action bar。

## InteractionHandling

### InteractionState
- **Definition**: pending interaction 的状态机:Pending / Responded / Invalidated。Responded 与 Invalidated 为终态,不再可操作。
- **Aliases / Disambiguation**: 见 Cross-Context「Status」。

### Invalidated
- **Definition**: InteractionState 终态;交互失效不再可操作。cause 区分 Expired(agent 超时/取消)与 OwningConversationEnded(对话生命周期结束 fan-out);对外行为相同。
- **Aliases / Disambiguation**: 两失效来源收敛为一态 + cause,不拆分。

### PendingInteraction
- **Definition**: agent cli 工作中产生、需用户响应的交互请求(权限审批、确认等);有 InteractionState 状态机与后端自持 ResponseLock。同一对话同一时刻可多个。
- **Aliases / Disambiguation**: 拒绝 prompt / approval request。

### ResponseLock
- **Definition**: 后端自持的、保证多连接「先到先得」的响应裁决锁;至多一个连接占据,后到被拒。后端单实例内串行裁决。
- **Aliases / Disambiguation**: 拒绝 claim / mutex;刻意不接受 agent cli 的锁语义。

### SupplementText
- **Definition**: 某响应选项要求的补充文字;选项 requiresSupplement 时必须存在且非空。
- **Aliases / Disambiguation**: —

## Notification

### Toast
- **Definition**: 无归属错误与操作失败的非阻塞提示;展示超过配置时长 T 后自动消失,可垂直堆叠;绝不插入信息列表。
- **Aliases / Disambiguation**: 拒绝 notification / snackbar。

## Cross-Context Terms

### Status
- **In ConversationProjection**: 两义——`NativeStatus`(agent 原生状态,纯文案)与 `TurnState`(InProgress/Interrupting/Ended,我方状态机)。
- **In InteractionHandling**: `InteractionState`(Pending/Responded/Invalidated,我方状态机)。
- **Resolution**: 加前缀彻底拆分:NativeStatus(纯透传文案)/ TurnState / InteractionState。裸词 "status" 不在代码中使用。

### Error / Failure
- **In ConversationProjection**: `FailureInfo`——agent 给出的带归属错误,进入对话信息列表的一个分类。
- **In Notification**: `UnattributedError`(无归属错误,toast)与 `OperationFailure`(提交/中断/响应等命令失败,toast)。
- **Resolution**: 三概念分别命名;带归属入列表 = FailureInfo,无归属/操作失败 = toast,不混用 "error"。

### Connection
- **In all Contexts**: 一个前端实例与后端的连接;多连接对等,无独占/活跃设备概念。ResponseLock 的持有者以 connectionId 标识。
- **Resolution**: 统一一义,拒绝 device / client session 作动作主体。

