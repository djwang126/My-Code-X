# Domain Discovery Note — Conversation View

## 1. Domain Event Timeline

<!-- Ordered by business flow, not by discovery order -->
<!-- ConversationBecameBusy/Idle 折叠进 TurnStarted/TurnCompleted:busy ≡ turn 进行中,是同一事实的投影 -->

```yaml
events:
  # --- Selection & content restore (restore ⇒ idle, 与 live update 互斥) ---
  - seq: 1
    name: SelectedConversationChanged
    trigger: ChangeSelectedConversation
    payload: [conversationId, title?, workingDirectory?]
    pivotal: true
  - seq: 2
    name: ConversationContentRestoreStarted
    trigger: RestoreConversationContent
    payload: [conversationId]
    pivotal: false
  - seq: 3
    name: ConversationContentRestored
    trigger: CompleteContentRestore
    payload: [conversationId, classifiedInformationList]
    pivotal: true
  - seq: 4
    name: ConversationContentRestoredEmpty
    trigger: CompleteContentRestore
    payload: [conversationId]
    pivotal: false
  - seq: 5
    name: ConversationContentRestoreFailed
    trigger: CompleteContentRestore
    payload: [conversationId, nativeMessage?]
    pivotal: false

  # --- Composer send: normal input (idle) ---
  - seq: 6
    name: NormalInputSubmitted
    trigger: SubmitNormalInput
    payload: [conversationId, markdownSource]
    pivotal: true
  - seq: 7
    name: NormalInputAccepted
    trigger: AcceptNormalInput
    payload: [conversationId]
    pivotal: true
  - seq: 8
    name: NormalInputSendFailed
    trigger: SubmitNormalInput
    payload: [conversationId, error]
    pivotal: false

  # --- Information arrival & classification (ACL: native -> 4 categories) ---
  - seq: 9
    name: ConversationInformationReceived
    trigger: IngestConversationInformation
    payload: [conversationId, informationId, nativeType, nativeStatus?, rawContent]
    pivotal: true
  - seq: 10
    name: InformationClassifiedAsConversation
    trigger: ClassifyConversationInformation
    payload: [informationId, role]
    pivotal: false
  - seq: 11
    name: InformationClassifiedAsWorkProgress
    trigger: ClassifyConversationInformation
    payload: [informationId, nativeType?, nativeStatus?]
    pivotal: false
  - seq: 12
    name: InformationClassifiedAsFailure
    trigger: ClassifyConversationInformation
    payload: [informationId, nativeMessage?]
    pivotal: false
  - seq: 13
    name: InformationClassifiedAsUnrecognized
    trigger: ClassifyConversationInformation
    payload: [informationId, genericFields, nativeStatus?]
    pivotal: false

  # --- Conversation content & streaming reply (live update ⇒ turn 进行中) ---
  - seq: 14
    name: UserInputAppearedInConversation
    trigger: AppendUserInput
    payload: [informationId, markdownSource]
    pivotal: false
  - seq: 15
    name: TurnStarted
    trigger: BeginTurn
    payload: [conversationId, turnId, firstUserInputAt]
    pivotal: true
  - seq: 16
    name: AgentReplyStreamStarted
    trigger: BeginAgentReply
    payload: [informationId]
    pivotal: false
  - seq: 17
    name: AgentReplyDeltaReceived
    trigger: AppendAgentReplyDelta
    payload: [informationId, deltaContent]
    pivotal: false
  - seq: 18
    name: AgentReplyCompleted
    trigger: CompleteAgentReply
    payload: [informationId, finalContent, markdownSource]
    pivotal: true
  - seq: 19
    name: WorkProgressInformationProgressed
    trigger: ProgressWorkProgressInformation
    payload: [informationId, updatedFields]
    pivotal: false
  - seq: 20
    name: FailureInformationReceived
    trigger: ReportFailureInformation
    payload: [conversationId, informationId, nativeMessage?, genericFields]
    pivotal: false
  - seq: 21
    name: UnrecognizedInformationReceived
    trigger: ReportUnrecognizedInformation
    payload: [conversationId, informationId, genericFields, nativeStatus?]
    pivotal: false

  # --- Pending interaction (raised ⇒ turn 进行中;不校验有效性) ---
  - seq: 22
    name: PendingInteractionRaised
    trigger: RaisePendingInteraction
    payload: [conversationId, interactionId, interactionContent, responseOptions]
    pivotal: true
  - seq: 23
    name: InteractionResponseSubmitted
    trigger: RespondToPendingInteraction
    payload: [interactionId, selectedOption, supplementaryText?]
    pivotal: true
  - seq: 24
    name: InteractionResponseAccepted
    trigger: AcceptInteractionResponse
    payload: [interactionId]
    pivotal: true
  - seq: 25
    name: InteractionResponseRejected
    trigger: AcceptInteractionResponse
    payload: [interactionId]
    pivotal: false
  - seq: 26
    name: PendingInteractionResolved
    trigger: ResolvePendingInteraction
    payload: [interactionId]
    pivotal: false
  - seq: 27
    name: PendingInteractionExpired
    trigger: ExpirePendingInteraction
    payload: [interactionId]
    pivotal: false
  - seq: 28
    name: PendingInteractionCancelled
    trigger: CancelPendingInteraction
    payload: [interactionId]
    pivotal: false

  # --- Composer: supplementary instruction & interrupt (turn 进行中) ---
  - seq: 29
    name: SupplementaryInstructionSubmitted
    trigger: SubmitSupplementaryInstruction
    payload: [conversationId, markdownSource]
    pivotal: true
  - seq: 30
    name: SupplementaryInstructionAccepted
    trigger: AcceptSupplementaryInstruction
    payload: [conversationId]
    pivotal: false
  - seq: 31
    name: SupplementaryInstructionSendFailed
    trigger: SubmitSupplementaryInstruction
    payload: [conversationId, error]
    pivotal: false
  - seq: 32
    name: WorkInterruptRequested
    trigger: InterruptCurrentWork
    payload: [conversationId]
    pivotal: true

  # --- Turn conclusion ---
  - seq: 33
    name: TurnCompleted
    trigger: ConcludeTurn
    payload: [conversationId, turnId, lastReplyCompletedAt]
    pivotal: true

  # --- Page-level notice (无法归属对话的 agent 错误) ---
  - seq: 34
    name: UnattributedAgentErrorReceived
    trigger: ReportUnattributedAgentError
    payload: [nativeMessage?]
    pivotal: false
```

## 2. Command → Actor Mapping

<!-- Actors: ProductUser (my-code-x 用户) | AgentCLI (外部) | MyCodeX (系统自身) -->
<!-- 成功/失败/空 共享同一命令,以不同 outcome 事件呈现 -->

```yaml
commands:
  - command: ChangeSelectedConversation
    actor: ProductUser
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
    actor: MyCodeX
    preconditions: "收到一条 native 信息"
    triggers: [InformationClassifiedAsConversation, InformationClassifiedAsWorkProgress, InformationClassifiedAsFailure, InformationClassifiedAsUnrecognized]
  - command: AppendUserInput
    actor: MyCodeX
    preconditions: "信息已归类为普通对话内容 (userInput)"
    triggers: UserInputAppearedInConversation
  - command: BeginTurn
    actor: AgentCLI
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
    preconditions: "turn 进行中"
    triggers: PendingInteractionRaised
  - command: RespondToPendingInteraction
    actor: ProductUser
    preconditions: "interaction 未响应且可操作"
    triggers: [InteractionResponseAccepted, InteractionResponseRejected]
  - command: AcceptInteractionResponse
    actor: MyCodeX
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
    actor: AgentCLI
    preconditions: "turn 进行中"
    triggers: TurnCompleted
  - command: ReportUnattributedAgentError
    actor: AgentCLI
    preconditions: "agent 错误无法归属到具体对话"
    triggers: UnattributedAgentErrorReceived
```

## 3. Read Models

<!-- The data an Actor consults before issuing a decision-making Command. -->

```yaml
read-models:
  - name: ComposerState
    actor: ProductUser
    read-before: SubmitNormalInput
    decision: "决定能否发送普通输入:对话已选中、内容非恢复中/状态可确认、agent idle、输入非空"
    source: [SelectedConversation, Turn, ContentRestore]
  - name: ComposerState
    actor: ProductUser
    read-before: SubmitSupplementaryInstruction
    decision: "决定走补充指令路径:对话 turn 进行中、agent 支持追加、输入非空"
    source: [Turn, AgentCapabilities]
  - name: ComposerState
    actor: ProductUser
    read-before: InterruptCurrentWork
    decision: "决定中断:turn 进行中、agent 支持中断、输入为空、已二次确认"
    source: [Turn, AgentCapabilities]
  - name: PendingInteractionView
    actor: ProductUser
    read-before: RespondToPendingInteraction
    decision: "决定选哪个选项、是否需要文字补充并提交;该 interaction 仍待响应"
    source: [PendingInteraction]
  - name: ConversationList
    actor: ProductUser
    read-before: ChangeSelectedConversation
    decision: "决定查看哪个对话(选择动作本身在 out-of-scope)"
    source: [ExternalConversationSelectionFeature]
  - name: InteractionResponseLedger
    actor: MyCodeX
    read-before: AcceptInteractionResponse
    decision: "幂等去重裁决:该 interaction 是否已被接受过响应"
    source: [PendingInteraction]
  - name: AgentInformationClassificationRules
    actor: MyCodeX
    read-before: ClassifyConversationInformation
    decision: "把一条 native 信息判为四类之一;不能安全归类→Unrecognized"
    source: [AgentCLI]
  - name: AgentCapabilities
    actor: ProductUser
    read-before: [SubmitSupplementaryInstruction, InterruptCurrentWork]
    decision: "判定追加/中断动作是否可用;不支持则禁用或隐藏"
    source: [AgentCLI]
```

## 4. Reactive Policies

<!-- "Whenever Event X (or a deadline) → Command Y" -->

```yaml
policies:
  - name: OnSelectedConversationChanged_RestoreContent
    trigger: event
    when: SelectedConversationChanged
    then: [RestoreConversationContent]
  - name: OnConversationInformationReceived_Classify
    trigger: event
    when: ConversationInformationReceived
    then: [ClassifyConversationInformation]
  - name: OnClassifiedAsConversation_AppendUserInput
    trigger: event
    when: InformationClassifiedAsConversation
    then: [AppendUserInput]
  - name: OnInteractionResponseSubmitted_AdjudicateIdempotency
    trigger: event
    when: InteractionResponseSubmitted
    then: [AcceptInteractionResponse]
  - name: OnInteractionResponseAccepted_ResolveInteraction
    trigger: event
    when: InteractionResponseAccepted
    then: [ResolvePendingInteraction]
```

## 5. External Systems

```yaml
external-systems:
  - name: AgentCLI
    direction: both
    flows:
      inbound:
        - ConversationInformationReceived
        - AgentReplyStreamStarted
        - AgentReplyDeltaReceived
        - AgentReplyCompleted
        - WorkProgressInformationProgressed
        - FailureInformationReceived
        - UnrecognizedInformationReceived
        - TurnStarted
        - TurnCompleted
        - PendingInteractionRaised
        - PendingInteractionResolved
        - PendingInteractionExpired
        - PendingInteractionCancelled
        - UnattributedAgentErrorReceived
        - NormalInputAccepted
        - NormalInputSendFailed
        - SupplementaryInstructionAccepted
        - SupplementaryInstructionSendFailed
        - AgentCapabilities (Read Model)
      outbound:
        - SubmitNormalInput
        - SubmitSupplementaryInstruction
        - InterruptCurrentWork
        - RespondToPendingInteraction
        - RestoreConversationContent (fetchHistory)
```
