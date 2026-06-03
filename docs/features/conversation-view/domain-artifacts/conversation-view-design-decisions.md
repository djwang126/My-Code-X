# Design Decisions — Conversation View

## DD-001: 建模边界聚焦业务领域

**Status**: accepted

### Context

`conversation-view-bdd.md` 以前端 `Conversation View` 的可验收行为视角书写,文中混合了两类内容:真正承载业务不变量的领域概念(对话内容恢复、信息分类、turn、pending interaction、发送/中断/补充指令语义、多连接幂等)与纯 UI 交互状态(滚动位置、展开折叠、draft 本地保存、banner 计时)。需要先确定本次领域建模的目标边界。

### Options Considered

**Option A — 全栈领域视角**
- Pros: 覆盖最全,前后端概念统一建模。
- Cons: 把 UI 交互状态当领域概念,违背 DDD 关注业务不变量的初衷,模型臃肿。

**Option B — 聚焦业务领域**
- Pros: 只建模真正承载业务不变量的领域;UI 交互状态作为约束记录而非领域概念;符合 DDD 实践。
- Cons: 部分前端行为需要明确划到领域外,需在过程中持续判别。

**Option C — 纯前端视图模型**
- Pros: 贴合 BDD 文档的前端验收视角。
- Cons: 把 agent cli 交互全当外部系统,丢失对话/turn/interaction 等核心业务语义的建模深度。

### Decision

采用 Option B,聚焦真正承载业务不变量的领域。纯 UI 交互状态(滚动、折叠、banner 计时、draft 本地持久化的展示细节)排除在领域模型之外,仅作为约束/边界记录。

### Rationale

DDD 建模的价值在于围绕业务不变量(Evans 四支柱)组织模型。`Conversation View` 的核心业务事实是:对话信息的接收与分类、turn 边界、pending interaction 的幂等响应、发送/中断/补充指令的语义保真,这些才是值得深建的部分。UI 渲染细节属于表现层关注点,不应污染 Ubiquitous Language。

## DD-002: 唯一外部系统为 AgentCLI,后端属模型内部

**Status**: accepted

### Context

最初识别外部系统时,曾把 `My-Code-X Backend` 列为外部系统(因建模视角钉在前端 `Conversation View`,把后端当成前端要跨越的边界)。这违背 DD-001 的业务领域视角。需要确定模型边界外到底有哪些系统。

### Options Considered

**Option A — Agent CLI 与 Backend 都是外部系统**
- Pros: 贴合前端视角,边界清晰。
- Cons: 后端是 My-Code-X 自身的一部分,把它当外部系统会把 live update 广播、幂等去重、内容恢复等核心业务职责错误推到边界外。

**Option B — 仅 Agent CLI 是外部系统**
- Pros: 后端是 My-Code-X 自身组件,前后端分工属落地架构而非领域边界;核心业务职责留在模型内深建。
- Cons: 需要明确把"经后端中转"这一传输细节与领域职责分离。

### Decision

采用 Option B。唯一外部系统是 `AgentCLI`(codex/claude code 等第三方 cli agent)。My-Code-X 后端属模型内部组件。

### Rationale

外部系统的判据是"概念模型不受我们控制"。只有 agent cli 满足。「native 信息→四类分类」「turn 边界消费」「幂等去重」「内容恢复」全部是 My-Code-X 自己的领域职责,应在模型内建模;唯一对外的 ACL 边界落在对 agent cli 的翻译上。

## DD-003: 领域设计语言用英文

**Status**: accepted

### Context

BDD 文档与日常沟通用中文,而代码标识符惯例用英文。建模过程中事件/命令/术语一度双语并列,需要锁定规范名语言。

### Options Considered

**Option A — 中文规范名**
- Pros: 与 BDD、沟通完全一致。
- Cons: 与代码标识符脱节,落地时仍需翻译,反而增加映射成本。

**Option B — 英文规范名,中文定义**
- Pros: 规范名直接对应代码标识符;定义保留中文供领域专家校验。
- Cons: 术语表需中英两栏维护。

### Decision

采用 Option B。Ubiquitous Language 规范名用英文,定义用中文。

### Rationale

规范名最终要落到代码,英文名消除"领域名→代码名"的二次翻译;中文定义保证领域专家可校验语义。BDD 仍保留中文产品语言,不强行改写。

## DD-004: TranscriptEntry 总称 + 四平级变体,去 Information 后缀

**Status**: accepted

### Context

四类信息最初命名为 `ConversationInformation`(总称)与 `WorkProgressInformation`/`FailureInformation`/`UnrecognizedInformation`,而普通对话叫 `ConversationMessage`。命名不一致使"四类平级"关系不可见,且 `Information` 后缀冗余。

### Options Considered

**Option A — 保留 XxxInformation 命名**
- Pros: 直译 BDD 的"信息"。
- Cons: 总称与变体后缀不统一,看不出 Message 与其他三类平级;Information 后缀无信息量。

**Option B — TranscriptEntry 总称 + 裸名变体**
- Pros: 总称锚定 ConversationTranscript;四变体 `Message`/`WorkProgress`/`Failure`/`Unrecognized` 裸名平级,判别联合关系一目了然。
- Cons: 偏离 BDD 字面用词,需术语表桥接。

### Decision

采用 Option B。总称 `TranscriptEntry`(Entity),四平级变体 `Message`(含 `UserInput`/`AgentReply`)、`WorkProgress`、`Failure`、`Unrecognized`。

### Rationale

命名即模型。统一裸名让"四类平级、Message 不是总称"这一结构自解释,符合 make-impossible-states-unrepresentable 的取向。`TranscriptEntry` 锚定 transcript,消除 "content/message" 一词多义(见 UL 文档 PT-1/PT-2)。

## DD-005: 中断不引入独立领域事件,生效经回到 idle 观察

**Status**: accepted

### Context

`NormalInput`/`SupplementaryInstruction` 都有 Accepted/Failed 结果事件。中断当前工作是否需要对称的"中断已接受"领域事件?BDD 只描述到"发送中断请求"。产品事实:中断后 agent cli 会产生后续信息并带来状态变化,但具体每个 agent cli 给什么信息不确定。

### Options Considered

**Option A — 引入 InterruptAccepted/Failed 对称事件**
- Pros: 与其他发送动作形式一致。
- Cons: 各 agent cli 中断反馈形态不一,强造对称 ack 是臆测;增加无依据的模型复杂度。

**Option B — 不引入独立事件,生效经状态变化观察**
- Pros: 不臆造 agent cli 行为;中断生效自然体现为对话回到 idle(turn 结束)。
- Cons: "中断成功"无显式领域事件,需经状态投影间接观察。

### Decision

采用 Option B。领域层不引入中断结果事件,中断生效通过 agent cli 后续信息与对话回到 idle 体现。

### Rationale

遵循"不重设计 agent cli 能力"与 YAGNI。中断的可观察后果已由既有的 turn 结束 / idle 状态承载,无需新增对称事件。具体反馈形态属 ACL 接入细节(HS-002)。

## DD-006: 不建模 pending interaction 与 turn 的从属关系

**Status**: accepted

### Context

PendingInteraction 在工作过程中产生,与 turn 边界、busy 状态存在客观从属关系(产品事实:pending 存在必处 turn 进行中,这是各 agent cli 的共性设计)。问题是 My-Code-X 是否需要建模这层关系。

### Options Considered

**Option A — 建模 interaction 归属 turn**
- Pros: 结构完整。
- Cons: 该从属关系对 Conversation View 的任何行为都不产生影响;建模它增加无用耦合。

**Option B — 不建模该关系,interaction 独立**
- Pros: PendingInteraction 自成有状态机的概念,按发生位置展示即可;无用关系不进模型。
- Cons: 丢失一处"完整性"(但该完整性无业务用途)。

### Decision

采用 Option B。PendingInteraction 独立建模,不挂 turn;"pending 存在必处 turn 进行中"作为已知事实但不在模型中表达。

### Rationale

用户明确该对应关系"对 My-Code-X 不重要"。YAGNI:不被任何 scenario 消费的关系不应建模(HS-006)。

## DD-007: 响应有效性不在领域校验,交 agent cli

**Status**: accepted

### Context

PendingInteraction 的响应(选项选择 / 选项+文字补充)是否需要在 My-Code-X 领域层校验有效性(选项合法、必填文字是否填写)?后端已负责幂等去重(接受首个、拒绝重复)。

### Options Considered

**Option A — 领域层校验响应有效性**
- Pros: 提前拦截无效响应。
- Cons: 需在模型内复刻各 agent cli 的校验规则,与"不重设计 agent cli 能力"冲突;规则随 agent cli 变化,维护成本高。

**Option B — 不校验,直接交 agent cli**
- Pros: agent cli 是响应的最终权威;不接受则报错,My-Code-X 以失败信息呈现即可。模型简单。
- Cons: 无效响应要到 agent cli 往返后才暴露。

### Decision

采用 Option B。领域层不校验响应有效性;无效响应由 agent cli 拒绝,结果以失败信息呈现。幂等去重(先到先得)仍是模型内职责。

### Rationale

agent cli 是交互的定义者与最终裁决者,有效性规则应由它持有。My-Code-X 只负责按 interaction 提供的方式渲染控件、提交响应、做幂等去重(HS-007)。

## DD-008: 内容恢复与 live update 互斥,不引入对账去重机制

**Status**: accepted

### Context

内容恢复(快照/历史)与 live update(增量)是两条入站路径。最初担心重连后二者内容重叠需要去重对账。

### Options Considered

**Option A — 引入对账/去重机制**
- Pros: 防御两路径内容重叠。
- Cons: 增加复杂度去解决一个不存在的场景。

**Option B — 依据互斥事实,不引入对账**
- Pros: 产品事实是二者互斥——恢复内容必为 idle 态,live update 仅在 turn 进行中发生,不会同时到达。无需去重。
- Cons: 依赖该互斥前提成立(已确认)。

### Decision

采用 Option B。不引入恢复/live update 对账或去重机制。

### Rationale

恢复完成必为 idle、live update 仅 turn 进行中发生,二者时间上互斥(已写入 BDD 背景)。该互斥是 agent cli 端事实(选中对话后才能开新 turn,fetchHistory 仅在 idle 时返回),my-code-x 不内部 guard 也不需对账。本决策范围限于「ContentRestore = 对 agent cli 历史装载」与 LiveUpdate 之间;前端弱网重连后从 my-code-x 后端拉快照/续 live 不在此命题内,由表现层 freshness banner 与应用层重连 Policy 处理。YAGNI(HS-010)。

## DD-009: TranscriptEntry 凭稳定标识对账,定为 Entity

**Status**: accepted

### Context

多处 BDD 行为要求"更新原有信息"而非新增:进行中 AgentReply 的增量、WorkProgress 的后续进展、PendingInteraction 的状态变更。要实现"更新而非新增",必须能识别"同一条信息"。产品事实:每个 agent cli 都会提供某种稳定标识,形态因 agent cli 而异。

### Options Considered

**Option A — TranscriptEntry 为值对象(Value Object)**
- Pros: 简单,纯按内容渲染。
- Cons: 值对象无身份,无法表达"同一条信息被更新";增量/进展只能不断追加,违背 BDD 的"更新原有信息"。

**Option B — TranscriptEntry 为 Entity,凭稳定标识对账**
- Pros: 有身份即可对账更新;增量更新、进展更新、interaction 状态流转都落在同一实体上。
- Cons: 依赖 agent cli/后端提供稳定标识(已确认必定存在)。

### Decision

采用 Option B。`TranscriptEntry` 是有身份的 Entity,身份由 agent cli/后端提供的稳定标识承载;"更新而非新增"凭该标识对账。

### Rationale

"更新原有信息"是 BDD 的硬性行为,只有有身份的实体能表达。标识的具体形态(各 agent cli 不同)属 ACL 翻译细节,不影响领域将其建模为 Entity(HS-009)。

## DD-010: TranscriptEntry 每条独立聚合,ConversationTranscript 降为 Read Model

**Status**: accepted

### Context

BC-1 的可读内容是「一个对话内按序排列的全部 entry」。最直觉的建法是一个 `ConversationTranscript` 大聚合持有所有 entry。但 BC-1 的不变量几乎全是「单条 entry 自身」的(四类判别、身份对账、各自独立保留、流式状态),只有「顺序稳定」涉及集合。需要决定聚合边界画在哪。

### Options Considered

**Option A — ConversationTranscript 大聚合持有全部 entry**
- Pros: 对象图直观,transcript 即聚合。
- Cons: 数百条消息进同一聚合,违反小聚合原则;流式增量/进展更新会锁整个 transcript,引发争用与整列表重排;"多条 Failure 各自保留"需额外守卫。

**Option B — TranscriptEntry 每条独立聚合,ConversationTranscript 为 Read Model**
- Pros: 一条信息到达 = 一事务改一个小聚合(Vernon);流式增量/进展只动单条,天然不重排;"各自独立保留"在独立聚合下自然成立;契合单向事件流 append+投影。
- Cons: 集合顺序由 entry 携带不可变 EntrySequence + 读侧投影保证,而非聚合内显式持有;ConversationTranscript 需 list finder(或后续 CQRS)实现。

### Decision

采用 Option B。`TranscriptEntry` 为聚合根(每条独立);`Turn` 为独立聚合,by ID 引用 entry;`ConversationTranscript` 是按 EntrySequence 排序的 Read Model,非聚合。

### Rationale

不变量驱动边界:BC-1 不变量绝大多数是单条 entry 的,集合层只有「顺序稳定」且由不可变 EntrySequence 保证。小聚合直接满足非功能要求(数百条不卡顿、流式增量不整列表重排)与「多条 Failure 不合并」。这是 Phase 3 影响整个 BC-1 的结构性决策(step 3.2)。

## DD-011: Phase 4 只采纳 ACL + Policy,拒绝 CQRS 与 Saga(YAGNI)

**Status**: accepted

### Context

Phase 4 可选战术需逐一核对触发条件。8 个战术中,ACL(强触发,闭环 HS-005+008)、Policy(分类规则随 agent cli 而异,真变化)明确满足;CQRS(transcript 读模型)与 Saga(内容恢复批量装配)弱触发;Domain Service / Specification / Factory / Event Sourcing 未触发。

### Options Considered

**Option A — 同时引入 CQRS 与 Saga**
- Pros: 预先固化读模型分离与跨聚合流程编排。
- Cons: 投机。list finder 已顶住 transcript 读路径;内容恢复→装配是无补偿的 Policy 链、CM-8 已保证无跨聚合事务,Saga 是过度设计。违背 YAGNI(AGENTS.md 核心原则)。

**Option B — 只做 ACL + Policy**
- Pros: 只在真实触发处投入;ACL 闭环唯一 carried-forward 热点,Policy 支撑多 agent cli 接入;读/流程需求未达战术阈值则不固化。
- Cons: 若日后读路径需独立伸缩,需再引入 CQRS(届时按需,成本可控)。

### Decision

采用 Option B。Phase 4 仅设计 AgentCliACL 与 InformationClassificationPolicy。CQRS、Saga 记为「触发弱、YAGNI 暂不做」,留待真实需求出现再引入;其余四战术未触发。

### Rationale

战术按需引入(skill 原则 + YAGNI)。ACL/Policy 有明确触发与变化依据;CQRS/Saga 的所谓需求都已被更轻的手段覆盖(list finder、Policy 链 + Separate Ways),现在固化只增复杂度。


