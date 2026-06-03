# Domain Model — Conversation View

## Related Artifacts

- Ubiquitous Language: [link](./domain-artifacts/conversation-view-ubiquitous-language.md)
- Context Map: [link to YAML](./domain-artifacts/conversation-view-domain-context-map.yaml)
- Design Decisions: [link](./domain-artifacts/conversation-view-design-decisions.md)
- BDD Source: [link](./conversation-view-bdd.md)

## Context Overview

```yaml
contexts:
  - name: Transcript
    type: core
    responsibility: 把已分类信息装配成按序、保真、可读的 ConversationTranscript;持有四类分类。
  - name: Interaction
    type: core
    responsibility: 产品用户对 agent 的操控——发送语义与 PendingInteraction 响应、状态机、幂等裁决。
  - name: ContentSync
    type: supporting
    responsibility: 让 transcript 在移动/远程/多连接下可得且尽量最新——内容恢复生命周期与可得性状态。
  - name: PageNotification
    type: generic
    responsibility: 无法归属到具体对话的 agent 错误,以通用页面提示呈现,不入 transcript。
```

> **唯一外部系统**: AgentCLI(codex/claude code 等),经 AgentCliACL 翻译。
> **建模边界**(DD-001): 聚焦业务领域;纯 UI 交互状态(滚动/折叠/banner 计时/Draft 持久化)排除在外,仅作约束登记。

---

## Bounded Context: Transcript

### Aggregate: TranscriptEntry

#### Structure

```yaml
root: TranscriptEntry
members:
  - { name: TranscriptEntry, role: root, type: Entity }
  - { name: EntryId,        role: vo, type: VO, semantics: "agent/后端提供的稳定标识,不透明" }
  - { name: Sequence,       role: vo, type: VO, semantics: "不可变发生序,排序与定位" }
  - { name: EntryBody,      role: vo, type: VO, semantics: "判别联合:Message|WorkProgress|Failure|Unrecognized" }
  - { name: MarkdownText,   role: vo, type: VO, semantics: "保真原文,UTF-8/CJK/emoji 不损坏" }
  - { name: NativeStatus,   role: vo, type: VO, semantics: "agent 原生 status,原样展示" }
  - { name: NativeType,     role: vo, type: VO, semantics: "agent 原生 type" }
  - { name: GenericFields,  role: vo, type: VO, semantics: "通用/结构化字段,供展开排查" }
  - { name: FailureMessage, role: vo, type: VO, semantics: "可展示失败文案,构造即落兜底" }
  - { name: ReplyStreamState, role: vo, type: VO, semantics: "AgentReply 流式状态 InProgress|Completed" }
```

#### Fields — TranscriptEntry

```yaml
fields:
  - name: id
    type: EntryId
    constraints: [required, immutable]
    note: identity (HS-009;agent/后端提供)
  - name: sequence
    type: Sequence
    constraints: [required, immutable]
    note: 发生序;保证顺序稳定不重排
  - name: body
    type: EntryBody
    constraints: [required]
    note: "判别联合,恰属四类之一"
```

EntryBody 判别联合(让非法状态不可表达):

```yaml
EntryBody:
  Message:
    UserInput:  { markdown: MarkdownText }
    AgentReply: { content: MarkdownText, stream: ReplyStreamState }   # InProgress|Completed
  WorkProgress: { nativeType: Optional<NativeType>, nativeStatus: Optional<NativeStatus>, detail: GenericFields }
  Failure:      { message: FailureMessage, detail: GenericFields }    # message 构造即非空
  Unrecognized: { nativeStatus: Optional<NativeStatus>, detail: GenericFields }
```

#### Invariants

```yaml
invariants:
  - id: INV-1
    rule: "TranscriptEntry 恰属四类之一,无第五类、无未分类悬空"
    enforced_at: "EntryBody 判别联合构造"
  - id: INV-2
    rule: "每个 entry 有稳定身份;同一信息后续进展更新原条目而非新增"
    enforced_at: "EntryId + TranscriptEntryRepository.findById"
  - id: INV-3
    rule: "多条 Failure 各自独立保留,绝不被通用规则合并为一条"
    enforced_at: "每条 entry 独立聚合(结构保证)"
  - id: INV-4
    rule: "Unrecognized 仅用于不能安全归类者;无专门展示样式不导致降级"
    enforced_at: "InformationClassificationPolicy(未知 type→Unrecognized)"
  - id: INV-5
    rule: "Failure 无可展示 message 时兜底 Unknown error"
    enforced_at: "FailureMessage 构造"
  - id: INV-6
    rule: "AgentReply 流式单向 InProgress→Completed;完成后不再增量"
    enforced_at: "AgentReply.appendDelta / complete 守卫"
  - id: INV-7
    rule: "已有 entry 顺序稳定不重排"
    enforced_at: "不可变 Sequence"
```

#### Boundary Rationale

每条信息一个独立聚合(根 = TranscriptEntry):INV-1/4/5/6 都是单条 entry 的内部规则;INV-3 在"每条独立"下天然成立(无合并入口);INV-7 由不可变 Sequence 保证。小聚合支撑数百条消息不锁一起、流式增量不整列表重排。`ConversationTranscript` 是按 Sequence 排序的 Read Model,非聚合。

#### Domain Events

```yaml
events:
  - { name: InformationClassifiedAsConversation, payload: [entryId, sequence], emitted_when: "归类为 Message" }
  - { name: InformationClassifiedAsWorkProgress,  payload: [entryId, sequence], emitted_when: "归类为 WorkProgress" }
  - { name: InformationClassifiedAsFailure,       payload: [entryId, sequence], emitted_when: "归类为 Failure" }
  - { name: InformationClassifiedAsUnrecognized,  payload: [entryId, sequence], emitted_when: "不能安全归类" }
  - { name: AgentReplyStreamStarted,  payload: [entryId], emitted_when: "AgentReply 开始流式" }
  - { name: AgentReplyDeltaReceived,  payload: [entryId, delta], emitted_when: "收到增量" }
  - { name: AgentReplyCompleted,      payload: [entryId], emitted_when: "回复完成" }
  - { name: WorkProgressInformationProgressed, payload: [entryId], emitted_when: "工作过程进展更新" }
```

#### Repository Port

```pseudo
interface TranscriptEntryRepository {            // domain layer
  find_by_id(conversationId: ConversationId, entryId: EntryId): TranscriptEntry  // raises TranscriptEntryNotFound
  save(entry: TranscriptEntry): void
  list_by_conversation(conversationId: ConversationId): List<TranscriptEntry>    // 按 Sequence 有序;空集合合法
}
```

#### Domain Errors

##### TranscriptEntryNotFound
- **Condition**: 对未知 EntryId 施加流式增量或进展更新(INV-2)
- **Severity**: not-found
- **Raised by**: TranscriptEntryRepository.find_by_id;AppendAgentReplyDelta / ProgressWorkProgressInformation

##### ReplyAlreadyCompleted
- **Condition**: 对已 Completed 的 AgentReply 再增量或重复完成(INV-6)
- **Severity**: conflict
- **Raised by**: AgentReply.appendDelta / complete

---

### Aggregate: Turn

#### Structure

```yaml
root: Turn
members:
  - { name: Turn,       role: root, type: Entity }
  - { name: TurnId,     role: vo, type: VO, semantics: "agent cli 提供的回合标识" }
  - { name: TurnStatus, role: vo, type: VO, semantics: "判别联合 InProgress|Completed" }
  - { name: Timestamp,  role: vo, type: VO, semantics: "用户输入时间 / 最后回复完成时间" }
```

#### Fields — Turn

```yaml
fields:
  - name: id
    type: TurnId
    constraints: [required, immutable]
    note: identity;边界由 agent cli 提供
  - name: status
    type: TurnStatus
    constraints: [required]
    note: "判别联合,见下"
```

TurnStatus 判别联合(by ID 跨聚合引用 entry):

```yaml
TurnStatus:
  InProgress: { firstUserInputRef: EntryId, userInputTime: Timestamp }
  Completed:  { firstUserInputRef: EntryId, userInputTime: Timestamp,
                lastAgentReplyRef: EntryId, lastReplyCompletedTime: Timestamp }
```

#### Invariants

```yaml
invariants:
  - id: INV-8
    rule: "Turn 边界由 agent cli 提供,My-Code-X 不自行推断"
    enforced_at: "AgentCliACL.TurnSignalPort(仅消费)"
  - id: INV-9
    rule: "Completed turn 必含 firstUserInput 与 lastAgentReply(+时间);InProgress 无 agent 侧信息"
    enforced_at: "TurnStatus 判别联合构造"
  - id: INV-10
    rule: "TurnInProgress(busy)≡ 存在 status=InProgress 的 Turn;完成单向不可逆"
    enforced_at: "Turn.conclude 守卫 + TurnRepository.find_in_progress 派生"
```

#### Boundary Rationale

Turn 独立成聚合:其状态机(INV-10)与成员完整性(INV-9)是独立于单条 entry 内容的一致性单元;只 by ID 引用 TranscriptEntry(firstUserInputRef/lastAgentReplyRef),不持有其内部。Turn 与 entry 间 eventual(分别到达)。busy/idle 是 find_in_progress 的派生,不落独立字段。

#### Domain Events

```yaml
events:
  - { name: TurnStarted,   payload: [turnId, firstUserInputRef, userInputTime], emitted_when: "agent 提供进行中 turn" }
  - { name: TurnCompleted, payload: [turnId, lastAgentReplyRef, lastReplyCompletedTime], emitted_when: "agent 标记 turn 完成" }
```

#### Repository Port

```pseudo
interface TurnRepository {                       // domain layer
  find_by_id(turnId: TurnId): Turn               // raises TurnNotFound
  save(turn: Turn): void
  find_in_progress(conversationId: ConversationId): Optional<Turn>   // busy/idle 派生,喂 ComposerState
  list_by_conversation(conversationId: ConversationId): List<Turn>   // Turn Toolbar 渲染
}
```

#### Domain Errors

##### TurnNotFound
- **Condition**: 对未知 TurnId 完成/更新
- **Severity**: not-found
- **Raised by**: TurnRepository.find_by_id;ConcludeTurn

##### TurnAlreadyCompleted
- **Condition**: 对已 Completed 的 Turn 再次 conclude(INV-10)
- **Severity**: conflict
- **Raised by**: Turn.conclude

---

## Bounded Context: Interaction

### Aggregate: PendingInteraction

#### Structure

```yaml
root: PendingInteraction
members:
  - { name: PendingInteraction, role: root, type: Entity }
  - { name: InteractionId,      role: vo, type: VO, semantics: "agent cli 提供的交互标识" }
  - { name: Sequence,           role: vo, type: VO, semantics: "transcript 内发生位置" }
  - { name: InteractionContent, role: vo, type: VO, semantics: "native 交互内容 + OptionSet" }
  - { name: OptionSet,          role: vo, type: VO, semantics: "InteractionOption 列表" }
  - { name: InteractionOption,  role: vo, type: VO, semantics: "选项;requiresTextSupplement 渲染提示" }
  - { name: InteractionStatus,  role: vo, type: VO, semantics: "判别联合 Pending|Resolved|Expired|Cancelled" }
  - { name: InteractionResponse, role: vo, type: VO, semantics: "selectedOption + 可选 textSupplement" }
```

#### Fields — PendingInteraction

```yaml
fields:
  - name: id
    type: InteractionId
    constraints: [required, immutable]
    note: identity
  - name: sequence
    type: Sequence
    constraints: [required, immutable]
    note: 发生位置;按位置在 transcript 流中渲染
  - name: content
    type: InteractionContent
    constraints: [required]
    note: agent 提供的交互内容与选项
  - name: status
    type: InteractionStatus
    constraints: [required]
    note: "判别联合,见下"
```

InteractionStatus 判别联合:

```yaml
InteractionStatus:
  Pending:   {}
  Resolved:  { acceptedResponse: InteractionResponse }
  Expired:   {}
  Cancelled: {}
InteractionResponse: { selectedOption: OptionId, textSupplement: Optional<Text> }   # 不做必填校验(HS-007)
```

#### Invariants

```yaml
invariants:
  - id: INV-11
    rule: "一个 interaction 至多被接受一个有效响应(首个 Accepted,后续 Rejected)"
    enforced_at: "PendingInteraction.accept(Pending→Resolved 守卫)+ 持久层乐观锁"
  - id: INV-12
    rule: "状态机单向 Pending→{Resolved|Expired|Cancelled};终态不可逆、不再可操作"
    enforced_at: "InteractionStatus 判别联合 + 转移守卫"
  - id: INV-13
    rule: "同对话多个 interaction 各自独立;响应/失效一个不影响其他"
    enforced_at: "每个 interaction 独立聚合(结构保证)"
  - id: INV-14
    rule: "响应方式由 interaction 自身决定;不校验响应有效性(交 agent cli)"
    enforced_at: "InteractionContent/OptionSet 渲染;accept 不做有效性校验"
```

#### Boundary Rationale

每个 interaction 独立聚合:INV-13 即"独立聚合"的直接体现;INV-11 幂等裁决在单聚合单事务内完成(检查是否已 Resolved)。多连接"先到先得"由持久层乐观锁/串行化在 save 时强制。

#### Domain Events

```yaml
events:
  - { name: PendingInteractionRaised, payload: [interactionId, sequence, content], emitted_when: "agent 产生待响应交互" }
  - { name: InteractionResponseAccepted, payload: [interactionId, response], emitted_when: "首个有效响应被接受" }
  - { name: InteractionResponseRejected, payload: [interactionId], emitted_when: "重复/失效后响应被拒(对应 Domain Error)" }
  - { name: PendingInteractionResolved,  payload: [interactionId], emitted_when: "转 Resolved" }
  - { name: PendingInteractionExpired,   payload: [interactionId], emitted_when: "超时失效" }
  - { name: PendingInteractionCancelled, payload: [interactionId], emitted_when: "agent 取消" }
```

#### Repository Port

```pseudo
interface PendingInteractionRepository {         // domain layer
  find_by_id(interactionId: InteractionId): PendingInteraction   // raises PendingInteractionNotFound
  save(interaction: PendingInteraction): void
  list_by_conversation(conversationId: ConversationId): List<PendingInteraction>  // 按 Sequence 有序,含已 Resolved
}
```

#### Domain Errors

##### PendingInteractionNotFound
- **Condition**: 对未知 interactionId 响应/expire/cancel
- **Severity**: not-found
- **Raised by**: PendingInteractionRepository.find_by_id

##### InteractionAlreadyResolved
- **Condition**: 对已 Resolved 的 interaction 再提交响应(多连接先到先得,INV-11)
- **Severity**: conflict
- **Raised by**: PendingInteraction.accept

##### InteractionNoLongerPending
- **Condition**: 对 Expired/Cancelled 的 interaction 提交响应(INV-12)
- **Severity**: conflict
- **Raised by**: PendingInteraction.accept

> **Composer 发送语义不构成持久聚合**:`ComposerState` 是读侧投影(Read Model,投影自 Transcript 的 TurnInProgress + ContentSync 的可得性 + AgentCapabilities);`NormalInput`/`SupplementaryInstruction`/`InterruptCurrentWork` 是出站请求 VO,经 AgentCliACL.AgentRequestPort 发出,返回 `SendOutcome`(Accepted|SendFailed)。输入经 agent round-trip 回流后由 Transcript 装配为 UserInput(CM-8 Separate Ways),不本地入 transcript。

---

## Bounded Context: ContentSync

### Aggregate: ContentRestore

#### Structure

```yaml
root: ContentRestore
members:
  - { name: ContentRestore, role: root, type: Entity }
  - { name: ConversationId, role: vo, type: VO, semantics: "身份;一对话一恢复实例" }
  - { name: RestoreStatus,  role: vo, type: VO, semantics: "判别联合 Restoring|Restored|RestoredEmpty|RestoreFailed" }
```

#### Fields — ContentRestore

```yaml
fields:
  - name: id
    type: ConversationId
    constraints: [required, immutable]
    note: identity (一对话一实例)
  - name: status
    type: RestoreStatus
    constraints: [required]
    note: "Restoring→{Restored|RestoredEmpty|RestoreFailed},空≠失败"
```

#### Invariants

```yaml
invariants:
  - id: INV-15
    rule: "恢复完成必为 idle 态;与 LiveUpdate 互斥(不同时发生)"
    enforced_at: "RestoreStatus 转移守卫(idle 才 restore)"
  - id: INV-16
    rule: "空内容恢复结果 ≠ 失败(RestoredEmpty 与 RestoreFailed 互斥不可混淆)"
    enforced_at: "RestoreStatus 判别联合 + AgentCliACL.ContentRestorePort 判定"
```

#### Boundary Rationale

ContentRestore 是有明确状态机的可得性一致性单元,per 对话。INV-16(空≠失败)的权威归属在此(Transcript 侧仅为展示投影)。重连后"尽量最新、非阻塞、保留既有内容"(eventual)不落此聚合,由重连 Policy + 应用层 freshness guard 承载。

#### Domain Events

```yaml
events:
  - { name: ConversationContentRestoreStarted, payload: [conversationId], emitted_when: "启动恢复" }
  - { name: ConversationContentRestored,       payload: [conversationId], emitted_when: "恢复成功且有内容" }
  - { name: ConversationContentRestoredEmpty,  payload: [conversationId], emitted_when: "恢复成功但无可展示内容" }
  - { name: ConversationContentRestoreFailed,  payload: [conversationId], emitted_when: "恢复失败" }
```

#### Repository Port

```pseudo
interface ContentRestoreRepository {             // domain layer
  find_by_id(conversationId: ConversationId): Optional<ContentRestore>   // None=尚未发起
  save(restore: ContentRestore): void
}
```

#### Domain Errors

无。所有恢复结果(Restored/RestoredEmpty/RestoreFailed)都是状态机合法终态、领域数据,不抛异常。互斥(INV-15)由应用层路由保证(idle 才 restore)。

---

## Bounded Context: PageNotification

无持久聚合(Generic 子域)。`UnattributedAgentError`(仅取 native message)经 AgentCliACL.UnattributedErrorPort 翻译为 `PageNotice` 值,交表现层 banner。I4-1:绝不插入 transcript。无 Repository、无 Domain Error。

---

## Application Services

> 编排原则:服务只 load→invoke→save→publish,不含业务规则;一事务至多一聚合;Domain Error 传播不吞;agent cli 失败翻译为领域数据(SendFailed/Failure/RestoreFailed),不抛 Domain Error。

### IngestAndClassifyInformationService

**Input**: `RawAgentInformation`(native 字段)

**Output**: EntryId | (无 Domain Error;不能归类→Unrecognized 兜底)

**Steps**:
1. 解析 — `AgentCliACL.parseNative(raw) → NativeDescriptor`(infra adapter)
2. 分类 — `classificationPolicyRegistry.policyFor(agentCliId).classify(descriptor) → ClassificationDecision`(领域 Policy)
3. 构造 — `AgentCliACL.buildEntryBody(decision, raw) → EntryBody`;`new TranscriptEntry(id, sequence, body)`
4. 持久 — `TranscriptEntryRepository.save`
5. 发布 — `InformationClassifiedAs*`

**Error propagation**: 无(分类不抛错)。

**Transaction boundary**: 单聚合(TranscriptEntry)。服务体无 native 类型、无 if-by-vendor、无分类规则。

### AppendAgentReplyDeltaService

**Input**: `EntryId`, `DeltaContent`

**Output**: void | raises [TranscriptEntryNotFound, ReplyAlreadyCompleted]

**Steps**:
1. 加载 — `TranscriptEntryRepository.find_by_id`
2. 行为 — `entry.appendDelta(delta)`(INV-6 守卫)
3. 持久 — `save`
4. 发布 — `AgentReplyDeltaReceived`

**Error propagation**: 传播;乱序到达导致的 TranscriptEntryNotFound 由应用层缓冲/丢弃迟到增量,不视为致命。

**Transaction boundary**: 单聚合。(CompleteAgentReplyService、ProgressWorkProgressInformationService 同构,分别 invoke `complete()` / `progress()`。)

### BeginTurnService / ConcludeTurnService

**Input**: BeginTurn(`TurnId`, `firstUserInputRef`, `userInputTime`)| ConcludeTurn(`TurnId`, `lastAgentReplyRef`, `lastReplyCompletedTime`)

**Output**: void | ConcludeTurn raises [TurnNotFound, TurnAlreadyCompleted]

**Steps**: Begin → `new Turn(InProgress)` → save → `TurnStarted`;Conclude → `find_by_id` → `turn.conclude()`(INV-9/10 守卫)→ save → `TurnCompleted`

**Error propagation**: 直接传播。

**Transaction boundary**: 单聚合(Turn)。

### RespondToPendingInteractionService

**Input**: `InteractionId`, `InteractionResponse`(不校验有效性,HS-007)

**Output**: void | raises [PendingInteractionNotFound, InteractionAlreadyResolved, InteractionNoLongerPending]

**Steps**:
1. 加载 — `PendingInteractionRepository.find_by_id`
2. 行为 — `interaction.accept(response)`(INV-11 幂等守卫)
3. 持久 — `save`(持久层乐观锁强制先到先得)
4. 发布 — `InteractionResponseAccepted`(失败时错误传播 = InteractionResponseRejected 的业务对应)

**Error propagation**: 传播;AlreadyResolved/NoLongerPending 上层转为非阻塞提示(已处理/已失效,两种文案)。

**Transaction boundary**: 单聚合。(RaisePendingInteraction / Resolve / Expire / Cancel 同构。)

### Composer 出站请求(SubmitNormalInput / SubmitSupplementaryInstruction / InterruptCurrentWork)

**Input**: `MarkdownText`(发送类;保真不删改)/ 无(中断)

**Output**: SendOutcome(Accepted | SendFailed);中断无 ack(HS-002)

**Steps**:
1. 准入(应用层 guard,读 ComposerState 投影):目标状态明确、文本非空、无在途请求 — 非业务规则
2. 发出 — `AgentCliACL.AgentRequestPort.send*/interrupt`
3. 裁决传播给调用方

**Error propagation**: agent 失败 = SendFailed 数据(非 Domain Error);Accepted→ClearDraft、SendFailed→保留 Draft + 非阻塞提示(应用层 reaction)。

**Transaction boundary**: 无领域事务(纯出站;无本地聚合)。输入经 round-trip 回流后由 IngestAndClassify 装配为 UserInput(CM-8)。

### RestoreConversationContentService / CompleteContentRestoreService

**Input**: Restore(`ConversationId`)| Complete(`ConversationId`, `RestoreOutcome`)

**Output**: void | (无 Domain Error)

**Steps**: Restore → `new ContentRestore(Restoring)` → save → `ConversationContentRestoreStarted` → `AgentCliACL.ContentRestorePort.fetchHistory`;Complete → `find_by_id` → `restore.complete(outcome)`(INV-15/16)→ save → 发布对应事件 → 若 Restored/Empty,raw 批次转交 IngestAndClassify

**Error propagation**: 无(失败是 RestoreFailed 数据)。

**Transaction boundary**: 单聚合(ContentRestore);后续每条 entry 装配各自独立事务(eventual,无 Saga)。

### ReportUnattributedAgentErrorService

**Input**: `UnattributedAgentError`(native message)

**Output**: void

**Steps**: `AgentCliACL.UnattributedErrorPort.interpret` → `PageNotice` 值 → 交表现层 banner

**Transaction boundary**: 无(无聚合、无持久化;I4-1 绝不入 transcript)。

---

## Adopted Tactics

### Anti-Corruption Layer — AgentCliACL

- **Trigger reason**: 闭环 HS-005+008。agent cli 的 native type/status/message、turn 信令、interaction 信令异构且不可控;无 ACL 则污染四类分类与 Turn/Interaction 语义,并滋生 if-by-vendor。
- **Scope**: 唯一外部系统 AgentCLI;覆盖全部 4 个 Context 的外部边界(CM-1/2/3/4)。
- **Design summary**: 一个 ACL,按 BC 拆 6 个领域层 port(InformationClassificationPort / TurnSignalPort / InteractionSignalPort / AgentRequestPort / ContentRestorePort / UnattributedErrorPort);adapter 每 agent cli 一个、在 infrastructure。外部失败翻译为领域数据(SendFailed/Failure/RestoreFailed/Unrecognized)或 Domain Error,内部不见 native 类型/错误码。稳定 id 不透明保留(HS-009);"空≠失败"判定在 ContentRestorePort 确立。

### Policy — InformationClassificationPolicy

- **Trigger reason**: native type→四类映射"在各 agent cli 接入时确定"(HS-005)。真实变化:codex/claude code 已两种,未来更多;写死会把领域规则漏进基础设施并迫使改核心。
- **Scope**: Transcript Context 的分类决策。
- **Design summary**: 领域层 port `classify(NativeDescriptor) → ClassificationDecision`;实现按 agent cli 一个(CodexClassificationPolicy / ClaudeCodeClassificationPolicy…),未知 native type 默认 Unrecognized。按当前 agent cli 身份经 registry 选择。只决定类别,构造/兜底/流式映射留在 ACL adapter。

> **未采纳**(YAGNI / 未触发):CQRS(list finder 已顶住 transcript 读)、Saga(内容恢复装配是 Policy 链、无补偿)、Domain Service / Specification / Factory / Event Sourcing(未触发)。详见 design-decisions。

---

## Modeling Completeness

- **Hotspots**: 13 条全部 resolved(HS-011 downgrade 后 resolved),0 carried-forward,0 静默丢弃。
- **Aggregates**: 4(TranscriptEntry / Turn / PendingInteraction / ContentRestore),各 1 Repository port;PageNotification 无聚合。
- **Invariants**: INV-1..16 全部映射到聚合的构造/方法/守卫或结构保证。
- **建模边界**(DD-001): 纯 UI 交互状态(滚动/折叠/banner 计时/Draft/freshness/二次确认 modal)排除,登记于 Ubiquitous Language 的 Out-of-Domain Terms。
