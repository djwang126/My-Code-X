# Domain Discovery Note — Conversation View

> Scope: 聚焦业务领域 (DD-001)。纯 UI 交互状态 (滚动跟随、展开折叠、banner 计时、
> Draft 本地持久化、输入框高度) 已 set aside,不在本 note 内。
> 唯一外部系统:Agent CLI (codex / claude code 等的统称)。
> 命名规范语言:English (HS-012 resolved)。

## 1. Domain Event Timeline

<!-- Ordered by business flow, not by discovery order -->
<!-- ConversationBecameBusy/Idle 已折叠进 TurnStarted/TurnCompleted (HS-001 resolved):
     busy ≡ turn 进行中,是同一事实的投影 -->

```yaml
events:
  # --- Selection & content restore (restore ⇒ idle, 与 live update 互斥, HS-010) ---
  - seq: 1
    name: SelectedConversationChanged
    trigger: ChangeSelectedConversation
    payload: [conversationId, title?, workingDirectory?]
    classification: pivotal
  - seq: 2
    name: ConversationContentRestoreStarted
    trigger: RestoreConversationContent
    payload: [conversationId]
    classification: supporting
  - seq: 3
    name: ConversationContentRestored
    trigger: CompleteContentRestore
    payload: [conversationId, classifiedInformationList]
    classification: pivotal
  - seq: 4
    name: ConversationContentRestoredEmpty
    trigger: CompleteContentRestore
    payload: [conversationId]            # 空内容 != 失败
    classification: edge
  - seq: 5
    name: ConversationContentRestoreFailed
    trigger: CompleteContentRestore
    payload: [conversationId, nativeMessage?]
    classification: edge

  # --- Composer send: normal input (idle) ---
  - seq: 6
    name: NormalInputSubmitted
    trigger: SubmitNormalInput
    payload: [conversationId, markdownSource]   # 原文不删改
    classification: pivotal
  - seq: 7
    name: NormalInputAccepted
    trigger: AcceptNormalInput
    payload: [conversationId]
    classification: pivotal
  - seq: 8
    name: NormalInputSendFailed
    trigger: SubmitNormalInput
    payload: [conversationId, error]            # 保留 draft + 非阻塞提示
    classification: edge

  # --- Information arrival & classification (ACL: native -> 4 categories, HS-005 CF) ---
  - seq: 9
    name: ConversationInformationReceived
    trigger: IngestConversationInformation
    payload: [conversationId, informationId, nativeType, nativeStatus?, rawContent]
    classification: pivotal
  - seq: 10
    name: InformationClassifiedAsConversation
    trigger: ClassifyConversationInformation
    payload: [informationId, role]              # role: userInput | agentReply
    classification: supporting
  - seq: 11
    name: InformationClassifiedAsWorkProgress
    trigger: ClassifyConversationInformation
    payload: [informationId, nativeType?, nativeStatus?]   # 缺失字段不占位
    classification: supporting
  - seq: 12
    name: InformationClassifiedAsFailure
    trigger: ClassifyConversationInformation
    payload: [informationId, nativeMessage?]    # 缺失时兜底 Unknown error
    classification: supporting
  - seq: 13
    name: InformationClassifiedAsUnrecognized
    trigger: ClassifyConversationInformation
    payload: [informationId, genericFields, nativeStatus?]
    classification: supporting

  # --- Conversation content & streaming reply (live update ⇒ turn 进行中) ---
  - seq: 14
    name: UserInputAppearedInConversation
    trigger: AppendUserInput
    payload: [informationId, markdownSource]
    classification: supporting
  - seq: 15
    name: TurnStarted                           # ≡ ConversationBecameBusy
    trigger: BeginTurn
    payload: [conversationId, turnId, firstUserInputAt]
    classification: pivotal
  - seq: 16
    name: AgentReplyStreamStarted
    trigger: BeginAgentReply
    payload: [informationId]
    classification: supporting
  - seq: 17
    name: AgentReplyDeltaReceived
    trigger: AppendAgentReplyDelta
    payload: [informationId, deltaContent]      # 更新进行中回复,非新增
    classification: supporting
  - seq: 18
    name: AgentReplyCompleted
    trigger: CompleteAgentReply
    payload: [informationId, finalContent, markdownSource]
    classification: pivotal
  - seq: 19
    name: WorkProgressInformationProgressed
    trigger: ProgressWorkProgressInformation
    payload: [informationId, updatedFields]     # 按 informationId 更新原信息
    classification: supporting
  - seq: 20
    name: FailureInformationReceived
    trigger: ReportFailureInformation
    payload: [conversationId, informationId, nativeMessage?, genericFields]
    classification: supporting                  # 多条不合并 (HS-004 -> 不变量)
  - seq: 21
    name: UnrecognizedInformationReceived
    trigger: ReportUnrecognizedInformation
    payload: [conversationId, informationId, genericFields, nativeStatus?]
    classification: edge

  # --- Pending interaction (raised ⇒ turn 进行中, HS-006; 不校验有效性, HS-007) ---
  - seq: 22
    name: PendingInteractionRaised
    trigger: RaisePendingInteraction
    payload: [conversationId, interactionId, interactionContent, responseOptions]
    classification: pivotal
  - seq: 23
    name: InteractionResponseSubmitted
    trigger: RespondToPendingInteraction
    payload: [interactionId, selectedOption, supplementaryText?]
    classification: pivotal
  - seq: 24
    name: InteractionResponseAccepted
    trigger: AcceptInteractionResponse
    payload: [interactionId]                    # 幂等去重:第一个有效响应
    classification: pivotal
  - seq: 25
    name: InteractionResponseRejected
    trigger: AcceptInteractionResponse
    payload: [interactionId]                    # 重复响应被拒 (模型内裁决)
    classification: edge
  - seq: 26
    name: PendingInteractionResolved
    trigger: ResolvePendingInteraction
    payload: [interactionId]                    # 已响应,不再可操作
    classification: supporting
  - seq: 27
    name: PendingInteractionExpired
    trigger: ExpirePendingInteraction
    payload: [interactionId]
    classification: edge
  - seq: 28
    name: PendingInteractionCancelled
    trigger: CancelPendingInteraction
    payload: [interactionId]
    classification: edge

  # --- Composer: supplementary instruction & interrupt (turn 进行中) ---
  - seq: 29
    name: SupplementaryInstructionSubmitted
    trigger: SubmitSupplementaryInstruction
    payload: [conversationId, markdownSource]   # 仅当 agent 支持追加
    classification: pivotal
  - seq: 30
    name: SupplementaryInstructionAccepted
    trigger: AcceptSupplementaryInstruction
    payload: [conversationId]
    classification: supporting
  - seq: 31
    name: SupplementaryInstructionSendFailed
    trigger: SubmitSupplementaryInstruction
    payload: [conversationId, error]
    classification: edge
  - seq: 32
    name: WorkInterruptRequested
    trigger: InterruptCurrentWork
    payload: [conversationId]                    # 生效 = 回到 idle (HS-002)
    classification: pivotal

  # --- Turn conclusion ---
  - seq: 33
    name: TurnCompleted                          # ≡ ConversationBecameIdle
    trigger: ConcludeTurn
    payload: [conversationId, turnId, lastReplyCompletedAt]
    classification: pivotal

  # --- Page-level notice (无法归属对话的 agent 错误) ---
  - seq: 34
    name: UnattributedAgentErrorReceived
    trigger: ReportUnattributedAgentError
    payload: [nativeMessage?]                    # banner 展示,不入消息列表
    classification: edge
```

## 2. Command → Actor Mapping

<!-- Actors: ProductUser (my-code-x 用户) | AgentCLI (外部) | MyCodeX (系统自身) -->
<!-- 成功/失败/空 共享同一命令,以不同 outcome 事件呈现 -->

```yaml
commands:
  - command: ChangeSelectedConversation
    actor: ProductUser            # 经外部功能;角色仍是产品用户
    preconditions: "存在可选中的对话"
    triggers: SelectedConversationChanged
  - command: RestoreConversationContent
    actor: MyCodeX
    preconditions: "已选中对话"
    triggers: ConversationContentRestoreStarted
  - command: CompleteContentRestore
    actor: MyCodeX
    preconditions: "恢复进行中"
    triggers: [ConversationContentRestored, ConversationContentRestoredEmpty, ConversationContentRestoreFailed]
  - command: SubmitNormalInput
    actor: ProductUser
    preconditions: "对话 idle 且目标状态明确;输入非空"
    triggers: [NormalInputAccepted, NormalInputSendFailed]
  - command: IngestConversationInformation
    actor: AgentCLI
    preconditions: "已选中对话存在"
    triggers: ConversationInformationReceived
  - command: ClassifyConversationInformation
    actor: MyCodeX                # ACL 翻译职责 (HS-005 carried-forward)
    preconditions: "收到一条 native 信息"
    triggers: [InformationClassifiedAsConversation, InformationClassifiedAsWorkProgress, InformationClassifiedAsFailure, InformationClassifiedAsUnrecognized]
  - command: AppendUserInput
    actor: MyCodeX
    preconditions: "信息已归类为普通对话内容 (userInput)"
    triggers: UserInputAppearedInConversation
  - command: BeginTurn
    actor: AgentCLI               # ConversationBecameBusy 同因
    preconditions: "至少一条用户输入进入对话"
    triggers: TurnStarted
  - command: BeginAgentReply
    actor: AgentCLI
    preconditions: "turn 进行中"
    triggers: AgentReplyStreamStarted
  - command: AppendAgentReplyDelta
    actor: AgentCLI
    preconditions: "回复进行中"
    triggers: AgentReplyDeltaReceived
  - command: CompleteAgentReply
    actor: AgentCLI
    preconditions: "回复进行中"
    triggers: AgentReplyCompleted
  - command: ProgressWorkProgressInformation
    actor: AgentCLI
    preconditions: "存在同一 informationId 的工作过程信息"
    triggers: WorkProgressInformationProgressed
  - command: ReportFailureInformation
    actor: AgentCLI
    preconditions: "agent 产生失败信息"
    triggers: FailureInformationReceived
  - command: ReportUnrecognizedInformation
    actor: AgentCLI
    preconditions: "信息不能安全归类"
    triggers: UnrecognizedInformationReceived
  - command: RaisePendingInteraction
    actor: AgentCLI
    preconditions: "turn 进行中 (HS-006)"
    triggers: PendingInteractionRaised
  - command: RespondToPendingInteraction
    actor: ProductUser
    preconditions: "interaction 未响应且可操作"
    triggers: [InteractionResponseAccepted, InteractionResponseRejected]
  - command: AcceptInteractionResponse
    actor: MyCodeX                # 幂等去重在模型内裁决 (先到先得)
    preconditions: "收到响应;判定是否首个有效响应"
    triggers: [InteractionResponseAccepted, InteractionResponseRejected]
  - command: ResolvePendingInteraction
    actor: AgentCLI
    preconditions: "响应被接受"
    triggers: PendingInteractionResolved
  - command: ExpirePendingInteraction
    actor: AgentCLI
    preconditions: "interaction 超时"
    triggers: PendingInteractionExpired
  - command: CancelPendingInteraction
    actor: AgentCLI
    preconditions: "agent cli 取消 interaction"
    triggers: PendingInteractionCancelled
  - command: SubmitSupplementaryInstruction
    actor: ProductUser
    preconditions: "turn 进行中;agent 支持追加;输入非空"
    triggers: [SupplementaryInstructionAccepted, SupplementaryInstructionSendFailed]
  - command: InterruptCurrentWork
    actor: ProductUser
    preconditions: "turn 进行中;agent 支持中断;输入为空;已二次确认"
    triggers: WorkInterruptRequested
  - command: ConcludeTurn
    actor: AgentCLI               # ConversationBecameIdle 同因;中断生效经此体现
    preconditions: "turn 进行中"
    triggers: TurnCompleted
  - command: ReportUnattributedAgentError
    actor: AgentCLI
    preconditions: "agent 错误无法归属到具体对话"
    triggers: UnattributedAgentErrorReceived
```

## 3. Hotspots

Phase 1 末有 1 个 carried-forward(H-1),其余 11 个已在 Phase 1 内 resolved/downgrade。
**H-1 已在 Phase 4 闭环为 resolved**(落点见下),故截至最终交付,全部 hotspot 均 resolved/downgrade,无悬留。

### H-1: Agent CLI native 语义的 ACL 翻译职责 (合并 HS-005 + HS-008)

- **Where**: ClassifyConversationInformation;TurnStarted / TurnCompleted (turn 边界与成员归属)
- **Type**: cross-team-friction
- **Status**: **resolved in Phase 4**(Phase 1 末为 carried-forward)
- **Description**: native type → 四类信息分类的映射、"能否安全归类" 的判定、turn 边界与
  turn 内成员 (多条用户输入 / 多条回复 / 补充指令归属) 均由各 agent cli 接入时定义,
  My-Code-X 从 agent cli 消费而不自行推断。这是对 Agent CLI 的 ACL 翻译职责,非领域内歧义。
- **Resolution (Phase 4)**: 由 `AgentCliACL`(InformationClassificationPort / TurnSignalPort,
  adapter 每 agent cli 一个)+ 领域 Policy `InformationClassificationPolicy`(native type→四类,
  未知→Unrecognized)闭环。映射表/turn 信令形态在各 agent cli 接入时按其 native 词汇填充;
  Conversation View 核心模型只消费已分类、带 turnId 的结果。见 context-map.yaml 的 AgentCLI→Transcript(ACL)
  与 design-decisions DD-011。

### Resolved / downgrade 台账 (可追溯)

```yaml
hotspot_ledger:
  - id: HS-001; topic: "busy ≡ turn 进行中"; status: resolved
    note: "两者同一事实的投影;busy/idle 折叠进 TurnStarted/TurnCompleted"
  - id: HS-002; topic: "中断结果"; status: resolved
    note: "无独立领域事件;生效 = 回到 idle,经后续 agent 信息体现"
  - id: HS-003; topic: "Draft 领域化"; status: resolved
    note: "留领域外;clear/retain 是应用层对 Accepted/SendFailed 的 reaction"
  - id: HS-004; topic: "失败不合并"; status: resolved
    note: "范围内无合并通用规则;转为不变量 each-failure-preserved"
  - id: HS-006; topic: "interaction 与 turn 关系"; status: resolved
    note: "pending 存在 ⇒ turn 进行中;该对应关系 My-Code-X 不建模"
  - id: HS-007; topic: "响应有效性"; status: resolved
    note: "不校验;agent 不接受则报错,呈现为失败信息"
  - id: HS-009; topic: "信息同一性"; status: resolved
    note: "ConversationInformation 为 Entity;稳定 id 必存在,形态因 agent 而异 (ACL)"
  - id: HS-010; topic: "恢复/live update 对账"; status: resolved
    note: "互斥:restore ⇒ idle,live update ⇒ turn 进行中;无需去重"
  - id: HS-011; topic: "freshness 来源"; status: downgrade
    note: "连接级视图状态,set aside;禁用发送/banner 为应用层 guard"
  - id: HS-012; topic: "命名语言"; status: resolved
    note: "领域设计用 English"
  - id: HS-013; topic: "页面级错误归属"; status: resolved
    note: "有业务意义的失败已建模;泛化前端崩溃 banner set aside"
  - id: HS-005+008; topic: "Agent CLI ACL 翻译"; status: "carried-forward (P1) -> resolved (P4)"
    note: "Phase 4 经 AgentCliACL + InformationClassificationPolicy 闭环;见 H-1 Resolution"
```

## Set-aside (excluded from downstream, kept for traceability)

```yaml
set_aside:
  ui_state: [滚动跟随/锁定, 工作过程/未识别信息展开折叠, banner 自动消失计时与堆叠, 输入框高度增长, 首次打开定位底部]
  client_local: [Draft 三事件 (DraftCaptured/Restored/Cleared)]
  transport: [LiveUpdateConnectionLost, LiveUpdateReconnected, LiveUpdateBroadcastToAllConnections, ConversationContentFreshnessUnconfirmed]
  read_model_not_event: [AgentCapabilitiesReported (是否支持追加/中断 → Read Model, step 1.6)]
  platform_capability: [Clipboard 复制, External Link Opener 开链]
  runtime_error: [PageLevelErrorOccurred 泛化前端崩溃]
```

