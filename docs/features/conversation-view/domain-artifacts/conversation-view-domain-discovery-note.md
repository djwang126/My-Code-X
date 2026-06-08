# Domain Discovery Note — Conversation View

> 范围: 仅 `Conversation View` 自身可验收行为。选中/取消选中对话、agent cli 选择切换、生命周期管理在本 feature 之外。
> 关键定位: 本 feature 以后端为权威投影 + 中继 + ACL; `AgentCli` 是唯一外部系统; 多个对等前端实例为 Actor, 各自持本地状态(draft/展开态/滚动位置, 不跨端同步)。

## 1. Domain Event Timeline

```yaml
events:
  - seq: 1
    name: ConversationHistoryRecoveryStarted
    trigger: LoadConversationHistory
    payload: [conversationId]
    pivotal: true            # 进入加载相位
  - seq: 2
    name: ConversationHistoryRecovered
    trigger: DeliverRecoveredHistory
    payload: [conversationId, authoritativeSnapshot, isEmpty]
    pivotal: true            # 加载相位结束, 得到权威投影(必为非运行中)
  - seq: 3
    name: ConversationHistoryRecoveryFailed
    trigger: FailHistoryRecovery
    payload: [conversationId, reason]
    pivotal: false
  - seq: 4
    name: ConversationSyncStarted
    trigger: SyncConversation
    payload: [conversationId, resumeCursor]
    pivotal: true            # 进入同步相位, 旧内容保持可读
  - seq: 5
    name: ConversationAlignedToAuthoritativeState
    trigger: DeliverAuthoritativeState
    payload: [conversationId, authoritativeSnapshot, resumeCursor]
    pivotal: true            # 同步相位结束, 对齐权威; 之后续接 live update
  - seq: 6
    name: ConversationSyncFailed
    trigger: FailSync
    payload: [conversationId, reason]
    pivotal: false
  - seq: 7
    name: NormalInputAcceptedByAgent
    trigger: SubmitNormalInput
    payload: [conversationId, rawInput]
    pivotal: true            # 清 draft; 输入以普通对话内容进入列表(内容/位置以 agent 为准)
  - seq: 8
    name: InstructionAppendedToTurn
    trigger: AppendInstruction
    payload: [conversationId, turnId, rawInput]
    pivotal: false
  - seq: 9
    name: InputSubmissionFailed
    trigger: SubmitInput
    payload: [conversationId, reason]
    pivotal: false
  - seq: 10
    name: WorkInterruptRequestFailed
    trigger: RequestWorkInterrupt
    payload: [conversationId, turnId, reason]
    pivotal: false
  - seq: 11
    name: PendingInteractionResponseAccepted
    trigger: RespondToPendingInteraction
    payload: [conversationId, interactionId, selectedOption, supplementText]
    pivotal: true            # 转已响应, 不再可操作, 广播至其他连接
  - seq: 12
    name: PendingInteractionResponseRejected
    trigger: RespondToPendingInteraction
    payload: [conversationId, interactionId, reason]
    pivotal: false           # 先到先得裁决(后端自持锁)
  - seq: 13
    name: PendingInteractionResponseFailed
    trigger: RespondToPendingInteraction
    payload: [conversationId, interactionId, reason]
    pivotal: false
```

## 2. Command → Actor Mapping

```yaml
commands:
  - command: LoadConversationHistory
    actor: ProductUser
    preconditions: "已选中一个对话; 该对话在本视图会话内尚未加载"
    triggers: ConversationHistoryRecoveryStarted
  - command: DeliverRecoveredHistory
    actor: AgentCli
    preconditions: "该对话正处于历史恢复中; 恢复出的对话为非运行中(无进行中 turn)"
    triggers: ConversationHistoryRecovered
  - command: FailHistoryRecovery
    actor: AgentCli
    preconditions: "该对话正处于历史恢复中"
    triggers: ConversationHistoryRecoveryFailed
  - command: SyncConversation
    actor: ProductUser            # 也由 OnReconnected_SyncConversation 反应式触发
    preconditions: "该对话已有可读内容; 内容可能因断线/弱网/切后台而非最新"
    triggers: ConversationSyncStarted
  - command: DeliverAuthoritativeState
    actor: AgentCli
    preconditions: "该对话正处于同步中"
    triggers: ConversationAlignedToAuthoritativeState
  - command: FailSync
    actor: AgentCli
    preconditions: "该对话正处于同步中"
    triggers: ConversationSyncFailed
  - command: SubmitNormalInput
    actor: ProductUser
    preconditions: "对话存在; turn 非进行中; Composer 非空; 内容已加载且已同步且连接可用"
    triggers: NormalInputAcceptedByAgent
  - command: AppendInstruction
    actor: ProductUser
    preconditions: "turn 进行中; agent cli 支持追加指令; Composer 非空; 内容已加载已同步连接可用"
    triggers: InstructionAppendedToTurn
  - command: SubmitInput               # 伞形, 覆盖 SubmitNormalInput / AppendInstruction 的失败
    actor: ProductUser
    preconditions: "已发起一次普通输入或追加指令的提交"
    triggers: InputSubmissionFailed
  - command: RequestWorkInterrupt
    actor: ProductUser
    preconditions: "turn 进行中; agent cli 支持中断; 用户已在 modal 二次确认"
    triggers: WorkInterruptRequestFailed
  - command: RespondToPendingInteraction
    actor: ProductUser
    preconditions: "该 interaction 仍待响应; 选项有效; 需文字补充时文字已提供"
    triggers: [PendingInteractionResponseAccepted, PendingInteractionResponseRejected, PendingInteractionResponseFailed]
```

## 3. Read Models

```yaml
read-models:
  - name: ConversationSelectionView
    actor: ProductUser
    read-before: LoadConversationHistory
    decision: "是否有已选中且尚未加载的对话, 决定是否触发加载; 无选中则首屏「开始工作」"
    source: [ConversationSelection(外部功能), ConversationProjection]
  - name: SyncStatusBanner
    actor: ProductUser
    read-before: SyncConversation
    decision: "看到同步失败/内容可能非最新, 决定点击重试同步"
    source: [ConversationProjection]
  - name: ComposerActionView
    actor: ProductUser
    read-before: [SubmitNormalInput, AppendInstruction, RequestWorkInterrupt]
    decision: "由 turn 是否进行中 + Composer 是否有输入 + agent cli 能力, 决定主操作按钮动作"
    source: [ConversationProjection, ComposerDraft(本地), AgentCliCapability]
  - name: InterruptConfirmModal
    actor: ProductUser
    read-before: RequestWorkInterrupt
    decision: "二次确认是否中断当前工作"
    source: [ConversationProjection]
  - name: PendingInteractionList
    actor: ProductUser
    read-before: RespondToPendingInteraction
    decision: "选择哪条、哪个选项、是否需补充文字, 决定提交响应"
    source: [PendingInteraction, AgentCli(交互内容)]
```

## 4. Reactive Policies

```yaml
policies:
  - name: OnConversationOpened_LoadHistory
    trigger: event
    when: ConversationOpenedInView
    then: [LoadConversationHistory]
  - name: OnReconnected_SyncConversation
    trigger: event
    when: FrontendReconnected
    then: [SyncConversation]
  - name: OnAligned_AttachLiveUpdate
    trigger: event
    when: ConversationAlignedToAuthoritativeState
    then: [AttachLiveUpdate]
  - name: OnInputAccepted_ClearDraft
    trigger: event
    when: [NormalInputAcceptedByAgent, InstructionAppendedToTurn]
    then: [ClearDraft]
  - name: OnInputAccepted_InsertUserMessageIfNotEchoed
    trigger: event
    when: NormalInputAcceptedByAgent
    then: [InsertUserMessageAsNormalContent]   # H9: 非乐观; 仅当 agent cli 不回吐
  - name: OnPendingResponseAccepted_BroadcastResolved
    trigger: event
    when: PendingInteractionResponseAccepted
    then: [NotifyOtherConnectionsResolved]
  - name: OnOwningConversationEnded_InvalidatePendingInteractions
    trigger: event
    when: OwningConversationEnded        # Integration Event, 来自 Lifecycle context (H10)
    then: [InvalidatePendingInteractions]
  - name: OnToastShown_AutoDismiss
    trigger: temporal
    when: "toast 已展示超过配置时长 T"
    then: [DismissToast]
```

## 5. External Systems

```yaml
external-systems:
  - name: AgentCli
    direction: both
    flows:
      # inbound (it -> us)
      - AgentStartedOutputting
      - AgentStoppedOutputting
      - AgentMessageRecorded        # 含 native type/status + 四大分类原料
      - AgentMessageUpdated         # 就地更新: 追加增量 或 整条替换, 由 cli + type 决定
      - NativeTypeIntentionallyIgnored
      - TurnStarted
      - TurnEnded                   # turn 边界与时间戳, best-effort
      - PendingInteractionRaised
      - PendingInteractionExpired   # 超时/取消, 由 agent cli 负责 (H5)
      - AttributedErrorRaised       # 带归属 -> 对话内失败信息
      - UnattributedErrorRaised     # 无归属 -> toast
      - RecoveredHistorySnapshot    # native 历史恢复, 必为非运行中
      # outbound (us -> it)
      - SubmitNormalInput
      - AppendInstruction
      - RequestWorkInterrupt
      - RespondToPendingInteraction
```

## 6. Hotspots (carried into Phase 2/3)

```yaml
hotspots:
  - id: H1
    status: resolved
    note: "消息身份键由 agent cli 提供且稳定(固定键); 驱动就地更新与展开态保持。"
  - id: H2
    status: deferred-to-integration
    note: "turn 边界/时间戳 best-effort 规则属 agent cli 接入细节, 不在 domain 模型展开。"
  - id: H3
    status: deferred-to-integration
    note: "native type -> 四大分类映射、刻意忽略/未识别判据, 接入时确定。"
  - id: H4
    status: resolved
    note: "pending interaction 响应锁由后端自持; 先到先得是本 domain 不变量。"
  - id: H5
    status: resolved
    note: "单条 pending interaction 超时/取消失效由 agent cli 负责, 我们透传。"
  - id: H6
    status: resolved
    note: "展开态以 agent cli 固定键(H1)保持; 同步对齐/整条替换不丢展开态。"
  - id: H7
    status: resolved
    note: "turn 状态机需含 interrupting 过渡态; 中断结果由后续 agent 消息/turn 变化体现。"
  - id: H8
    status: resolved
    note: "同步与 live update 衔接需续接位点/游标, 保证不丢不重。"
  - id: H9
    status: resolved
    note: "用户输入不乐观插入; 优先等 agent cli 回吐, 不回吐才由后端(非乐观)插入。"
  - id: H10
    status: open
    type: cross-team-friction
    note: "依赖 Lifecycle context 发出对话级 OwningConversationEnded 信号, 我们 fan-out 成逐条失效。契约待 context-mapping 对齐; 我们为 downstream/Conformist。"
```
