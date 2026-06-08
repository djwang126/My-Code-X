# Domain Model — Conversation View

## Related Artifacts

- Ubiquitous Language: [link](./domain-artifacts/conversation-view-ubiquitous-language.md)
- Context Map: [link to YAML](./domain-artifacts/domain-context-map.yaml)
- Discovery Note: [link](./domain-artifacts/conversation-view-domain-discovery-note.md)

## Context Overview

```yaml
contexts:
  - name: ConversationProjection
    type: core
    responsibility: 一条对话的权威可读投影——有序消息(含分类)、turn、加载/同步相位、续接位点。
  - name: InteractionHandling
    type: supporting
    responsibility: pending interaction 状态机与后端自持响应锁,保证多连接先到先得。
  - name: Composer
    type: supporting
    responsibility: 输入 draft(前端本地)与主操作按钮决策;后端仅中继输入意图,无 aggregate。
  - name: Notification
    type: generic
    responsibility: 无归属错误与操作失败的非阻塞 toast。
```

外部系统:`AgentCli`(唯一外部权威,经 AgentCli ACL 集成)、`AgentLifecycle`(独立 feature,经边界集成,见 H11)。

后端为单实例(强一致裁决依赖此前提)。前端 dumb,持有少量本地态(draft、展开/折叠、滚动位置),不跨端同步。

---

## Bounded Context: ConversationProjection

### Aggregate: ConversationProjection

#### Structure

```yaml
root: ConversationProjection
members:
  - { name: ConversationProjection, role: root,   type: Entity }
  - { name: Message,                role: entity, type: Entity, relation: "投影持有有序 Message 集合, 以 stableKey 标识" }
  - { name: Turn,                   role: entity, type: Entity, relation: "投影持有 Turn 集合, agent cli 提供边界" }
  - { name: Phase,                  role: vo, type: VO, semantics: "相位状态机判别联合" }
  - { name: Classification,         role: vo, type: VO, semantics: "四大分类之一" }
  - { name: NativeType,             role: vo, type: VO, semantics: "agent 原生类型" }
  - { name: NativeStatus,           role: vo, type: VO, semantics: "agent 原生状态, 纯文案" }
  - { name: TurnState,              role: vo, type: VO, semantics: "InProgress/Interrupting/Ended" }
  - { name: MessageContent,         role: vo, type: VO, semantics: "结构化字段集" }
  - { name: ResumeCursor,           role: vo, type: VO, semantics: "续接位点" }
```

#### Fields — ConversationProjection

```yaml
fields:
  - { name: conversationId, type: ConversationId, constraints: [required, immutable], note: identity }
  - { name: phase,    type: Phase,       constraints: [required], note: "相位状态机" }
  - { name: messages, type: "List<Message>", constraints: [ordered_by_sequence], note: "按 agent 给定顺序" }
  - { name: turns,    type: "List<Turn>", constraints: [], note: "agent cli 提供的 turn 边界" }
```

#### Fields — Message (Entity)

```yaml
fields:
  - { name: stableKey,    type: string,         constraints: [required, immutable], note: "agent cli 固定键; identity" }
  - { name: sequence,     type: int,            constraints: [required], note: "agent 给定发生顺序" }
  - { name: classification, type: Classification, constraints: [required] }
  - { name: nativeType,   type: NativeType,     constraints: [required] }
  - { name: nativeStatus, type: NativeStatus,   constraints: [optional], note: "缺失=该 type 本无 status" }
  - { name: content,      type: MessageContent, constraints: [required] }
  - { name: belongsToTurn, type: TurnId,        constraints: [optional], note: "缺失=agent 未归入任何 turn" }
```

#### Fields — Turn (Entity)

```yaml
fields:
  - { name: turnId,    type: TurnId,    constraints: [required, immutable], note: "agent 提供; identity" }
  - { name: state,     type: TurnState, constraints: [required] }
  - { name: startTime, type: DateTime,  constraints: [optional], note: "best-effort; 缺失则工具栏留空" }
  - { name: endTime,   type: DateTime,  constraints: [optional], note: "best-effort" }
```

#### State Machine — ConversationProjection

```yaml
state_machine:
  discriminant: phase
  states:
    - { name: HistoryRecovering, fields: [] }
    - { name: RecoveryFailed,    fields: [reason] }
    - { name: Synced,            fields: [resumeCursor] }
    - { name: Syncing,           fields: [resumeCursor] }
    - { name: SyncFailed,        fields: [resumeCursor, reason] }
    - { name: ProtocolBroken,    fields: [reason] }
  transitions:
    - { from: "∅",               to: HistoryRecovering, on: LoadConversationHistory }
    - { from: HistoryRecovering, to: Synced,            on: DeliverRecoveredHistory }
    - { from: HistoryRecovering, to: RecoveryFailed,    on: FailHistoryRecovery }
    - { from: RecoveryFailed,    to: HistoryRecovering, on: LoadConversationHistory }
    - { from: Synced,            to: Syncing,           on: SyncConversation }
    - { from: Syncing,           to: Synced,            on: DeliverAuthoritativeState }
    - { from: Syncing,           to: SyncFailed,        on: FailSync }
    - { from: SyncFailed,        to: Syncing,           on: SyncConversation }
    - { from: "*",               to: ProtocolBroken,    on: AgentCliProtocolViolation }
```

说明:`resumeCursor` 仅在「已恢复过」之后的相位携带(排除「未恢复却有 cursor」)。`RecoveryFailed`(无内容可读) 与 `SyncFailed`(保留旧内容可读) 语义不同,不合并。`ProtocolBroken` 为终态,无重试同步出边——agent cli 恢复属 AgentLifecycle feature。

#### Invariants

```yaml
invariants:
  - { id: INV-1, rule: "投影任一时刻恰处于一个 Phase", enforced_at: "Phase 判别联合 + 相位流转方法" }
  - { id: INV-2, rule: "Message 由 stableKey 唯一标识; 同键后续数据就地更新, 不新增列表项", enforced_at: "recordMessage / updateMessageInPlace" }
  - { id: INV-3, rule: "消息严格按 agent 给定 sequence 排列", enforced_at: "recordMessage" }
  - { id: INV-4, rule: "每条 Message 恰属一个 Classification; 无专门规则落 GenericFieldRendering", enforced_at: "Message 构造 (经 ACL 翻译)" }
  - { id: INV-5, rule: "History Recovery 恢复出的投影必为非运行中 (无进行中 turn)", enforced_at: "applyRecoveredSnapshot" }
  - { id: INV-6, rule: "Turn 边界完全由 agent cli 提供, 不自行推断", enforced_at: "applyTurnBoundary" }
  - { id: INV-7, rule: "ResumeCursor 使同步快照与后续 live update 增量不丢不重", enforced_at: "alignTo / applyLiveUpdate" }
```

展开态保持(原 I8)不在此 aggregate——前端本地态,以 stableKey 关联,随视图生命周期(切走再切回重置)。

#### Boundary Rationale

INV-2/INV-3/INV-7 要求消息集合、顺序、续接位点单事务一致——一条增量到达须原子地「按 stableKey 找到→就地更新/插入→推进 cursor」,故同 aggregate。INV-5/INV-6 把 Turn 与 Message 绑在同一致性边界(恢复时「无进行中 turn」是 turn 与消息的联合约束),故 Turn 为内部 entity 而非独立 aggregate。

#### Domain Events

```yaml
events:
  - { name: ConversationHistoryRecoveryStarted, payload: [conversationId], emitted_when: "进入 HistoryRecovering" }
  - { name: ConversationHistoryRecovered,       payload: [conversationId, isEmpty], emitted_when: "恢复成功, 进入 Synced" }
  - { name: ConversationHistoryRecoveryFailed,  payload: [conversationId, reason], emitted_when: "进入 RecoveryFailed" }
  - { name: ConversationSyncStarted,            payload: [conversationId, resumeCursor], emitted_when: "进入 Syncing" }
  - { name: ConversationAlignedToAuthoritativeState, payload: [conversationId, resumeCursor], emitted_when: "对齐成功, 回到 Synced" }
  - { name: ConversationSyncFailed,             payload: [conversationId, reason], emitted_when: "进入 SyncFailed" }
```

#### Repository Port

```pseudo
interface ConversationProjectionRepository {   // domain layer
  find_by_id(conversationId): ConversationProjection   // raises ConversationProjectionNotFound
  save(projection): void
}
```

#### Domain Errors

##### ConversationProjectionNotFound
- **Condition**: find_by_id 找不到该 conversationId 的投影
- **Business meaning**: 该对话尚无投影(未加载或已丢弃)
- **Severity**: not-found
- **Raised by**: ConversationProjectionRepository.find_by_id

##### InvalidPhaseTransition
- **Condition**: 相位流转不在 INV-1 允许集内
- **Business meaning**: 在错误的相位上执行了操作
- **Severity**: conflict
- **Raised by**: ConversationProjection 相位流转方法

##### RecoveredConversationStillRunning
- **Condition**: 恢复出的投影含进行中 turn,违反 INV-5
- **Business meaning**: 恢复的历史不应有进行中的工作
- **Severity**: business-rule
- **Raised by**: ConversationProjection.applyRecoveredSnapshot

##### MessageOrderViolation
- **Condition**: 收到消息的 sequence 破坏 INV-3 既定顺序
- **Business meaning**: 消息顺序与 agent 给定不一致(投影内容错乱, 可重新同步救)
- **Severity**: conflict
- **Raised by**: ConversationProjection.recordMessage

##### ResumeCursorGap
- **Condition**: live update 增量与当前 resumeCursor 不连续,违反 INV-7
- **Business meaning**: 续接位点错位, 可能丢/重消息(可重新同步救)
- **Severity**: conflict
- **Raised by**: ConversationProjection.applyLiveUpdate

##### AgentCliProtocolViolation
- **Condition**: inbound 流缺失固定键等协议契约违反(经 AgentCli ACL 检出)
- **Business meaning**: agent cli 连接异常/协议不同步, 非内容错乱; 重试同步无意义
- **Severity**: conflict
- **Raised by**: AgentCliInboundPort.applyLiveUpdate 翻译阶段 → markProtocolBroken

---

## Bounded Context: InteractionHandling

### Aggregate: PendingInteraction

#### Structure

```yaml
root: PendingInteraction
members:
  - { name: PendingInteraction, role: root, type: Entity }
  - { name: InteractionState,   role: vo, type: VO, semantics: "Pending/Responded/Invalidated 判别联合" }
  - { name: ResponseLock,       role: vo, type: VO, semantics: "Unlocked | HeldBy(connectionId)" }
  - { name: InteractionContent, role: vo, type: VO, semantics: "agent 提供的 prompt + options" }
  - { name: ResponseOption,     role: vo, type: VO, semantics: "选项 (id, requiresSupplement)" }
  - { name: SubmittedResponse,  role: vo, type: VO, semantics: "已选 option + 可选 supplement" }
  - { name: SupplementText,     role: vo, type: VO, semantics: "补充文字" }
```

#### Fields — PendingInteraction

```yaml
fields:
  - { name: interactionId,  type: InteractionId, constraints: [required, immutable], note: identity }
  - { name: conversationId, type: ConversationId, constraints: [required], note: "软关联所属对话" }
  - { name: content,        type: InteractionContent, constraints: [required] }
  - { name: state,          type: InteractionState, constraints: [required] }
```

#### State Machine — PendingInteraction

```yaml
state_machine:
  discriminant: state
  states:
    - { name: Pending,     fields: [lock] }
    - { name: Responded,   fields: [by_connection, response] }
    - { name: Invalidated, fields: [cause] }   # cause: Expired | OwningConversationEnded
  transitions:
    - { from: "∅",     to: Pending,     on: RaisePendingInteraction }
    - { from: Pending, to: Responded,   on: "RespondToPendingInteraction (检查 Pending + 占锁 + 转态, 同事务)" }
    - { from: Pending, to: Invalidated, on: "ExpirePendingInteraction (Expired) | InvalidatePendingInteractions (OwningConversationEnded)" }
```

说明:Responded/Invalidated 各只携其有效字段——无法表达「已响应却带 lock」或「已失效却有 response」。两失效来源收敛为 Invalidated + cause(对外行为相同, INV-11)。

#### Invariants

```yaml
invariants:
  - { id: INV-9,  rule: "interaction 任一时刻恰处于一个 InteractionState", enforced_at: "InteractionState 判别联合" }
  - { id: INV-10, rule: "ResponseLock 至多被一个连接占据; 先到先得, 后到被拒", enforced_at: "PendingInteraction.respond (单实例内串行)" }
  - { id: INV-11, rule: "Responded/Invalidated 为终态, 不再可操作", enforced_at: "PendingInteraction.respond / invalidate" }
  - { id: INV-13, rule: "接受响应需 option 有效; 选项 requiresSupplement 时 supplement 必须存在且非空", enforced_at: "SubmittedResponse 构造 + respond" }
```

#### Boundary Rationale

INV-10 是 immediate 强一致——「先到先得」要求对同一 interaction 的响应裁决在单事务内串行(后端单实例,内存串行)。Lock + State + 响应有效性必须同 aggregate 原子裁决。每条 interaction 一个 aggregate 实例(小,符合 Vernon)。owning-ended 的批量失效(INV-12, 见 Tactics)跨多个实例、为 eventual,由 Policy fan-out 逐个失效,不进单事务。

#### Domain Events

```yaml
events:
  - { name: PendingInteractionResponseAccepted, payload: [conversationId, interactionId, byConnection], emitted_when: "响应被接受, 转 Responded" }
  - { name: PendingInteractionResponseRejected, payload: [conversationId, interactionId, reason], emitted_when: "锁被占/已终态, 拒绝重复响应" }
  - { name: PendingInteractionResponseFailed,   payload: [conversationId, interactionId, reason], emitted_when: "响应提交技术失败" }
```

#### Repository Port

```pseudo
interface PendingInteractionRepository {   // domain layer
  find_by_id(interactionId): PendingInteraction   // raises PendingInteractionNotFound
  save(interaction): void
  find_pending_by_conversation(conversationId): List<PendingInteraction>
    // 驱动: PendingInteractionList read model + owning-ended fan-out; 仅返回 Pending 态
}
```

#### Domain Errors

##### PendingInteractionNotFound
- **Condition**: find_by_id 找不到该 interactionId
- **Business meaning**: 该交互请求不存在
- **Severity**: not-found
- **Raised by**: PendingInteractionRepository.find_by_id

##### InteractionAlreadyResolved
- **Condition**: 对已 Responded/Invalidated 的 interaction 再响应,违反 INV-11
- **Business meaning**: 该交互已被处理, 不能再操作
- **Severity**: conflict
- **Raised by**: PendingInteraction.respond

##### ResponseLockHeldByAnother
- **Condition**: Pending 但 ResponseLock 已被另一连接占据,违反 INV-10
- **Business meaning**: 已有其他设备先提交, 你的响应被拒(先到先得)
- **Severity**: conflict
- **Raised by**: PendingInteraction.respond

##### MissingRequiredSupplement
- **Condition**: 所选 option.requiresSupplement 但无 supplement,违反 INV-13
- **Business meaning**: 该选项需要补充文字
- **Severity**: business-rule
- **Raised by**: SubmittedResponse 构造 / PendingInteraction.respond

##### InvalidResponseOption
- **Condition**: 提交的 option 不在 InteractionContent.options 内,违反 INV-13
- **Business meaning**: 选择了无效选项
- **Severity**: business-rule
- **Raised by**: PendingInteraction.respond

---

## Bounded Context: Composer

后端无 aggregate(决策见 Design Decisions)。Draft、SubmissionInFlight、PrimaryActionButton 动作均为**前端本地态**;后端仅经 Application Services 暴露中继命令并处理回执。相关本地不变量(draft 按对话本地不跨端、在途禁重复、接受才清 draft、不乐观插入)由前端持有,违反时走 Operation Failure → toast,不抛领域错误。

---

## Bounded Context: Notification

无 aggregate、无领域错误。无归属错误 / 操作失败 → toast(展示超 T 自动消失、垂直堆叠、绝不入信息列表)。带归属错误作为 FailureInfo 进入 ConversationProjection(经 INV-4)。属 generic,可用现成组件。

---

## Application Services

> 「AgentCli 投递」类方法是 `AgentCliInboundPort` 的实现入口,接收的已是 ACL 翻译后的领域概念,服务体内不做 native 解析。

### LoadConversationHistoryService
**Input**: `LoadConversationHistory` — conversationId
**Output**: void
**Steps**: 1. 新建/取 projection — `ConversationProjectionRepository` 2. `projection.startRecovery()` (→ HistoryRecovering) 3. `save` 4. 经 `AgentCliCommandPort.requestHistoryRecovery`(agent 启动藏于 port 后, M8)
**Error propagation**: —
**Transaction boundary**: 单事务 ConversationProjection

### ApplyRecoveredHistoryService  (AgentCli 投递)
**Input**: conversationId, recoveredSnapshot
**Output**: void | raises [RecoveredConversationStillRunning, InvalidPhaseTransition]
**Steps**: 1. `find_by_id` 2. `projection.applyRecoveredSnapshot` (INV-5; → Synced) 3. `save` 4. emit ConversationHistoryRecovered
**Error propagation**: 错误向上传播给 ACL 入口, 投影停 RecoveryFailed, 不吞
**Transaction boundary**: 单事务

### SyncConversationService  (ProductUser 重试 / OnReconnected policy — ConversationResyncProcess step1)
**Input**: conversationId
**Output**: void | raises [ConversationProjectionNotFound, InvalidPhaseTransition]
**Steps**: 1. `find_by_id` 2. `projection.startSync()` (→ Syncing, 留旧 cursor) 3. `save` 4. emit ConversationSyncStarted; 经 AgentCli 请求权威状态
**Error propagation**: NotFound 传播; InvalidPhaseTransition(已在 Syncing) 幂等忽略
**Transaction boundary**: 单事务

### ApplyAuthoritativeStateService  (AgentCli 投递 — step2)
**Input**: conversationId, snapshot, resumeCursor
**Output**: void
**Steps**: 1. `find_by_id` 2. `projection.alignTo(snapshot, cursor)` (→ Synced) 3. `save` 4. emit ConversationAlignedToAuthoritativeState (触发 OnAligned_AttachLiveUpdate)
**Transaction boundary**: 单事务

### ApplyLiveUpdateService  (AgentCli 投递 — step3 续接)
**Input**: conversationId, MessageDelta | TurnBoundary
**Output**: void | raises [MessageOrderViolation, ResumeCursorGap, AgentCliProtocolViolation]
**Steps**: 1. `find_by_id` 2. `projection.recordMessage / updateMessageInPlace / applyTurnBoundary` (INV-2/3/6/7) 3. `save`
**Error propagation**: MessageOrderViolation / ResumeCursorGap → 触发 ConversationResyncProcess(可救); AgentCliProtocolViolation → `markProtocolBroken`, **不**触发同步(终态)
**Transaction boundary**: 单事务

### RespondToPendingInteractionService  (ProductUser)
**Input**: `RespondToPendingInteraction` — interactionId, connectionId, option, supplement?
**Output**: void | raises [PendingInteractionNotFound, InteractionAlreadyResolved, ResponseLockHeldByAnother, MissingRequiredSupplement, InvalidResponseOption]
**Steps**: 1. 边界解析为 SubmittedResponse (INV-13 构造校验) 2. `find_by_id` 3. `interaction.respond(connectionId, response)` (INV-10 占锁 + INV-11 终态校验, 单实例串行) 4. `save` 5. emit PendingInteractionResponseAccepted (触发 OnPendingResponseAccepted_BroadcastResolved)
**Error propagation**: ResponseLockHeldByAnother/InteractionAlreadyResolved → PendingInteractionResponseRejected(toast「已被处理」); Missing/InvalidOption → 响应被拒提示; 均不吞
**Transaction boundary**: 单事务 PendingInteraction

### InvalidatePendingInteractionsForConversationService  (OnOwningConversationEnded policy)
**Input**: conversationId
**Output**: void
**Steps**: 1. `find_pending_by_conversation` 2. for each: `interaction.invalidate(OwningConversationEnded)`; `save(interaction)`
**Error propagation**: 单条失败不影响其他条, 幂等可重试
**Transaction boundary**: **每个 interaction 各自一事务**(非跨 aggregate)

### Composer 中继命令  (SubmitNormalInput / AppendInstruction / RequestWorkInterrupt)
**Input**: conversationId, rawInput(, turnId)
**Output**: Accepted | Failed(技术失败 → Operation Failure toast)
**Steps**: 1. 保真转发原文给 `AgentCliCommandPort`(UTF-8/CJK/emoji 不损) 2. 接受 → emit NormalInputAccepted/InstructionAppended(触发 ClearDraft + InsertUserMessageIfNotEchoed); 失败 → Operation Failure
**Error propagation**: 非领域错误; 失败时 draft 保持不变(前端)
**Transaction boundary**: 无后端 aggregate 事务(纯中继); 中断结果由后续 ApplyLiveUpdate 的 TurnState 体现

---

## Adopted Tactics

### ACL — AgentCli ACL
- **Trigger reason**: agent cli 第三方,native type/status/turn 标记/更新语义/能力差异会扭曲三个 context 的模型。
- **Scope**: ConversationProjection / InteractionHandling / Composer ↔ AgentCli;一个 ACL,内部按用途分 inbound(消息/交互/错误)与 outbound(中继)模块。
- **Design summary**: port(`AgentCliInboundPort` / `AgentCliCommandPort`)在领域层;adapter 在 infra 讲 native 协议。翻译:native type→Classification、status→NativeStatus(文案)、更新→AppendDelta|FullReplace、固定键→stableKey、agent 失效→invalidate(Expired)(剥离锁语义)。缺固定键→AgentCliProtocolViolation→ProtocolBroken。

### ACL — Lifecycle ACL
- **Trigger reason**: 把 AgentLifecycle 的「生命周期结束」翻成 BC2 的「交互不再可能被响应」。
- **Scope**: InteractionHandling ← AgentLifecycle。
- **Design summary**: `LifecycleInboundPort.onOwningConversationEnded(conversationId)`;丢弃结束原因与计时细节;幂等(对空集 no-op)。契约风险见 H11。

### Process Manager — ConversationResyncProcess
- **Trigger reason**: 重连→同步→续接 live update 是多步有序、步骤间依赖(须先对齐拿权威 cursor 才能从正确位点续接),不可用长事务。
- **Scope**: ConversationProjection(单 aggregate),跨「我方↔AgentCli」异步边界。
- **Design summary**: orchestrated,**复用 Phase 作流程状态**(单一真相,不建独立状态对象)。step1 SyncConversation → step2 等 Aligned(新 cursor) → step3 AttachLiveUpdate。补偿即重新驱动到一致:SyncFailed/ResumeCursorGap→重回 step1;ProtocolBroken 不可补偿,显式 surface 为终态。完成条件:Phase=Synced 且 live update attached。

### Policy-driven fan-out — InvalidatePendingInteractions (INV-12)
- **Trigger reason**: owning-ended 需对该对话所有 Pending interaction 批量失效;同种操作批量、无步骤依赖、无需补偿——**非 Saga**。
- **Scope**: 多个 PendingInteraction 实例。
- **Design summary**: 事件触发的 fan-out service,每条一事务、幂等;非 Saga 编排。

---

## Carried-Forward Hotspot

- **H11** (cross-team friction): agent cli 生命周期管理是**独立 feature**,需单独 domain modeling。本 feature 与其有 3 个集成点——M3(OwningConversationEnded→失效)、M7(pending 状态→keep-alive)、M8(加载→启动)。三者契约待该 feature 建模时对齐;本 feature 侧已用 port 隔离,不持有生命周期逻辑。
