# Ubiquitous Language (final) — Conversation View

> **命名语言**: English 规范名;定义用中文供领域专家校验。
> **分组**: 按已确认的 Bounded Context 分组(Transcript / Interaction / ContentSync / PageNotification),按 Context 字母序、Context 内术语字母序。跨 Context 异义词集中在 Cross-Context Terms。
> **四类层级**(贯穿): `TranscriptEntry`(总称 Entity)→ 四平级变体 `Message`(含 `UserInput`/`AgentReply`)、`WorkProgress`、`Failure`、`Unrecognized`。
> **聚合**: TranscriptEntry、Turn(BC Transcript)、PendingInteraction(BC Interaction)、ContentRestore(BC ContentSync);BC PageNotification 无持久聚合。

## ContentSync

### ContentRestore
- **Definition**: per 对话的内容恢复/可得性状态聚合,身份 `ConversationId`;状态机 `Restoring → {Restored | RestoredEmpty | RestoreFailed}`。恢复完成必为 idle 态,与 LiveUpdate 互斥。
- **Aliases / Disambiguation**: 所有结果都是合法领域数据,**不**抛 Domain Error;RestoreFailed 是值非异常。

### LiveUpdate
- **Definition**: TurnInProgress 期间增量到达的对话信息流(新 entry、回复增量、信息进展、interaction 状态变更);所有对等连接都接收。
- **Aliases / Disambiguation**: 传输机制 set aside;承载的领域事实在领域内。与 ContentRestore 互斥。

### RestoreOutcome
- **Definition**: ACL `ContentRestorePort.fetchHistory` 的返回:`Restored`(raw 批次)/ `RestoredEmpty` / `RestoreFailed`。"空≠失败"判定在此边界确立。
- **Aliases / Disambiguation**: 空批次 → RestoredEmpty,绝不 RestoreFailed。

## Interaction

### AgentCapabilities
- **Definition**: 当前 agent cli 是否支持「工作中追加指令」「中断当前工作」;Read Model,决定 Composer 主操作语义与降级。
- **Aliases / Disambiguation**: 是 agent 上报的能力事实,非开关配置。不支持的动作禁用/隐藏,不模拟。

### Composer
- **Definition**: 产品用户输入区,承载发送/补充/中断三主操作;按对话保存 Draft(领域外)。
- **Aliases / Disambiguation**: 非聚合;主操作语义由 Read Model `ComposerState` 推导。

### ComposerState
- **Definition**: 决定主操作三态(NormalInput/Supplementary/Interrupt/禁用)所需的业务信息投影:SelectedConversation 是否存在、TurnInProgress(投影自 Transcript)、可得性状态(投影自 ContentSync)、AgentCapabilities、输入是否非空。Read Model。
- **Aliases / Disambiguation**: 只读投影,非可写共享内核(customer-supplier);非 UI 控件本身。

### IdempotentAdjudication
- **Definition**: 对 InteractionResponse 的幂等去重裁决:接受首个有效响应,拒绝后续重复;模型内职责,由 PendingInteraction.accept 守卫 + 持久层乐观锁实现"先到先得"。
- **Aliases / Disambiguation**: 不校验响应有效性(交 agent cli,拒则报错)。

### InteractionResponse
- **Definition**: 对 PendingInteraction 的响应,方式由 interaction 自身决定(选项选择 / 选项+文字补充);`selectedOption` + `textSupplement: Option`。
- **Aliases / Disambiguation**: 拒绝 "reply";"response" 专指此。textSupplement 缺失合法,**不**做必填校验。

### InterruptCurrentWork
- **Definition**: TurnInProgress 且 Composer 为空时,经二次确认后发送的中断请求;生效经对话回到 idle 观察(无独立 ack)。
- **Aliases / Disambiguation**: 需 AgentCapabilities 支持,否则禁用/隐藏,不模拟。

### NormalInput
- **Definition**: 空闲态(非 TurnInProgress)发送的普通输入请求,携带原文不删改。
- **Aliases / Disambiguation**: 与 SupplementaryInstruction 互斥(由 busy/idle 区分);空文本不能发送。

### PendingInteraction
- **Definition**: 聚合根,身份 `InteractionId`,带 `Sequence`(transcript 内发生位置)。agent 工作中产生的待响应交互;状态机 `Pending → {Resolved | Expired | Cancelled}`,终态不可逆不可操作。多个各自独立。
- **Aliases / Disambiguation**: 存在时必处 TurnInProgress(该从属关系不建模);超时/取消由 agent 触发,MyCodeX 不自行计时失效。

### SupplementaryInstruction
- **Definition**: TurnInProgress 时追加的补充指令请求,携带原文不删改;需 AgentCapabilities 支持。
- **Aliases / Disambiguation**: 不是新 NormalInput;由对话 busy 决定走此路径。

## PageNotification

### PageNotice
- **Definition**: 无法归属到具体对话的 agent 错误 / My-Code-X 自身错误的页面级提示;Generic,无持久聚合。
- **Aliases / Disambiguation**: 表现为 banner(一次性/持续状态、计时、堆叠属表现层);绝不插入 transcript。

### UnattributedAgentError
- **Definition**: agent cli 产生的、无法归属到具体对话的错误;入站领域事实,仅取 native message,展示为 PageNotice banner。
- **Aliases / Disambiguation**: 区别于 Failure(归属对话内某位置、进 transcript)。

## Transcript

### AgentCliACL
- **Definition**: 对唯一外部系统 AgentCLI 的 Anti-Corruption Layer;port 在 domain layer(InformationClassificationPort / TurnSignalPort / InteractionSignalPort / AgentRequestPort / ContentRestorePort / UnattributedErrorPort),adapter 每 agent cli 一个、在 infrastructure。
- **Aliases / Disambiguation**: 一外部 Context 一 ACL,不跨系统共享;内部代码不 import native 类型。

### AgentReply
- **Definition**: agent cli 产生的一条普通对话消息,可流式(`ReplyStreamState`: InProgress → Completed,单向);`Message` 的一种。
- **Aliases / Disambiguation**: 拒绝 "response"(留给 InteractionResponse)。

### ConversationTranscript
- **Definition**: 一个 Conversation 内按 `Sequence` 排序的全部 TranscriptEntry(+ PendingInteraction 按发生位置)集合。BDD 口语「消息列表」即指它。**Read Model**(非聚合),由 list finder 服务。
- **Aliases / Disambiguation**: 拒绝把 "content"(歧义)、"message list" 作类型名。

### Failure
- **Definition**: agent 给出的、归属对话内某发生位置的失败;TranscriptEntry 一类。进 transcript、不折叠、更醒目;`FailureMessage` 构造即落兜底(缺 native message → `Unknown error`)。
- **Aliases / Disambiguation**: 区别于 PageNotice(不归属对话、不进 transcript)与 Unrecognized(不能安全归类、不当失败)。多条 Failure 不合并。

### InformationClassificationPolicy
- **Definition**: 领域 Policy,把 `NativeDescriptor` 判为四类 `ClassificationDecision`;实现按 agent cli 一个(`CodexClassificationPolicy`/`ClaudeCodeClassificationPolicy`…),未知 native type 默认 `Unrecognized`。
- **Aliases / Disambiguation**: 只决定类别,不构造 entry(构造/兜底/流式映射在 ACL adapter);按当前 agent cli 身份选择实现。

### Message
- **Definition**: 普通对话消息;TranscriptEntry 一类,与 WorkProgress/Failure/Unrecognized 平级。细分 `UserInput` / `AgentReply`。不可折叠。
- **Aliases / Disambiguation**: 拒绝当全体条目总称(总称是 TranscriptEntry);「消息列表」指 ConversationTranscript。

### TranscriptEntry
- **Definition**: 聚合根,身份 `EntryId`(agent/后端提供的稳定标识),带不可变 `Sequence`。判别联合 body:`Message`/`WorkProgress`/`Failure`/`Unrecognized`(恰属其一)。同一信息后续进展更新原条目而非新增。
- **Aliases / Disambiguation**: 总称,与 `Message`/`WorkProgress`/`Failure`/`Unrecognized` 四变体形成层级关系;BDD 口语「消息」指其中 `Message` 那一类,不指总称。

### Turn
- **Definition**: 聚合根,身份 `TurnId`;边界**由 agent cli 提供不自行推断**。`TurnStatus`: `InProgress`(带 firstUserInputRef/userInputTime)→ `Completed`(再带 lastAgentReplyRef/lastReplyCompletedTime)。by ID 引用 entry。
- **Aliases / Disambiguation**: 进行中 turn 不展示 agent 侧工具栏;补充指令归属哪个 turn 由 agent 决定。

### TurnInProgress
- **Definition**: 存在 status=InProgress 的 Turn 的派生状态;≡「正在工作/busy」;LiveUpdate 仅在此态发生;PendingInteraction 存在时必处此态。
- **Aliases / Disambiguation**: 规范状态词;拒绝 "working/busy" 作类型名(口语别名)。反面为 idle。

### Unrecognized
- **Definition**: 不能安全归类的信息;TranscriptEntry 分类**兜底桶**(唯一兜底)。紧凑展示可展开;不当失败、不阻断阅读输入;有 native status 则展示。
- **Aliases / Disambiguation**: 「分类兜底」≠「渲染兜底」——已归类但无专门展示样式的 entry 仍属原类,**不**降级为 Unrecognized。

### UserInput
- **Definition**: 产品用户输入的普通对话消息,携带 Markdown 原文;`Message` 的一种。**经 agent round-trip 回流**进入 transcript,非本地直塞。
- **Aliases / Disambiguation**: 与 NormalInput/SupplementaryInstruction(发送请求)区分:UserInput 是已进入 transcript 的消息条目。

### WorkProgress
- **Definition**: 工作过程信息(reasoning/文件修改/命令运行等);TranscriptEntry 一类。携带 `NativeType`+`NativeStatus`(均 Option,缺失降级不占位)+ `GenericFields`;默认折叠可展开。
- **Aliases / Disambiguation**: 拒绝旧名 "WorkProgressInformation";不是聚合,是 TranscriptEntry 的变体。

## Cross-Context Terms

<!-- 来自外部系统 AgentCLI、经 AgentCliACL 翻译后在多个 Context 出现的概念 -->

### native type / native status / native message
- **In AgentCLI**: agent cli 原生输出字段,语义各自定义。
- **In Transcript**: native type 经 InformationClassificationPolicy 映射四类;native status → NativeStatus(原样,缺失不占位);native message → MarkdownText/FailureMessage(Failure 缺失兜底 `Unknown error`)。用户可见文案默认沿用 native。
- **Resolution**: `native` 前缀标来源边界;翻译在 AgentCliACL。

### Conversation
- **In AgentCLI**: 由 agent cli 维护的会话身份与历史。
- **In Transcript / Interaction / ContentSync**: 三个 Context 共同围绕的根对话实体;有 `title: Option`、`workingDirectory: Option`(均可缺,缺失不展示占位文案);由外部「选择对话」功能提供,本特性只消费。
- **Resolution**: 单一 `Conversation` 实体跨 Context 引用;optionality 是真实领域态,缺失字段不渲染。

### SelectedConversation
- **In Transcript / Interaction / ContentSync**: 当前被选中、正在 Conversation View 消费的 Conversation;喂入 ComposerState、驱动 SelectedConversationChanged → ContentRestore 启动;无选中对话 = 合法空态。
- **In AgentCLI**: 不直接消费;选择/取消选择 out-of-scope。
- **Resolution**: 仅本系统跨 Context 概念;由外部功能提供选中事实。

