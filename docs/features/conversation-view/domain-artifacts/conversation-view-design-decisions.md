# Design Decisions — Conversation View

> 本次领域建模中做出的关键决策及其理由。按主题组织,每条含「决策 / 理由 / 影响 / 出处」。

## DD-1 后端单实例假设

- **决策**: My-Code-X 后端为单实例进程。
- **理由**: BDD 背景「产品用户的电脑持续运行 My-Code-X 后端」即单机单后端。
- **影响**: `PendingInteraction` 的 ResponseLock「先到先得」(INV-10)由 aggregate 内存串行保证,无需分布式锁。若未来多实例,需重新设计并发。
- **出处**: Phase 3 step 3.1 用户确认。

## DD-2 以后端为权威投影,前端 dumb

- **决策**: 领域以后端为中心;前端只持有少量本地态(draft、展开/折叠、滚动位置),不进后端模型,不跨端同步。
- **理由**: SKILL「domain 以后端为中心保持前端 dumb」+ BDD「draft 不跨客户端同步」「展开态切走再切回重置」。
- **影响**: 展开态(原 I8)、Composer 本地态不建后端 aggregate。
- **出处**: Phase 1 分类 / Phase 3 aggregate 边界。

## DD-3 AgentCli 是唯一外部系统;前端是 Actor

- **决策**: External System 仅 `AgentCli`;`FrontendClient` 是 Actor(用我方语言发命令),非外部系统。
- **理由**: 前端发的是我方语言的 Command,无需语义翻译;agent cli 才是需跨边界翻译的异构第三方。
- **影响**: 只为 AgentCli(及后续 AgentLifecycle)建 ACL。
- **出处**: Phase 1 step 1.3 用户确认。

## DD-4 两个 Core subdomain 合并为单一 Bounded Context

- **决策**: Conversation Rendering 与 Live Sync 两个 Core subdomain 合并为 `ConversationProjection` Context。
- **理由**: 二者共享同一模型对象(ConversationProjection)、无语言漂移;拆开会制造跨 context aggregate(最常见建模失败)。Rendering 在其中是「无状态投影函数」。
- **影响**: 单一 aggregate 承载相位机 + 消息分类。
- **出处**: Phase 2 step 2.3 用户确认。

## DD-5 PendingInteraction 独立成 Context,响应锁后端自持

- **决策**: Interaction Handling 独立为 Context;ResponseLock 由我方后端自持,不透传给 agent cli。
- **理由**: 「强一致裁决(先到先得)」与「最终一致投影」是两套关注点(语言+一致性模型漂移);BDD「响应被后端接受/拒绝」。刻意丢弃 agent 的锁语义。
- **影响**: 先到先得是我方 domain 不变量(INV-10);agent 的失效只翻译为 invalidate(Expired)。
- **出处**: Phase 1 H4 / Phase 2 / Phase 4 ACL,用户确认。

## DD-6 Composer 后端无 aggregate

- **决策**: 后端不为 Composer 建 aggregate;后端只暴露中继命令(submit/append/interrupt)并处理回执。
- **理由**: draft/在途/按钮动作几乎全是前端本地态;符合 DD-2。
- **影响**: 后端 aggregate 仅 ConversationProjection 与 PendingInteraction 两个。
- **出处**: Phase 3 step 3.2 用户确认(方案 A)。

## DD-7 用户输入不乐观插入

- **决策**: 用户输入被接受后不乐观插入信息列表;以 agent cli 回吐为准,仅当不回吐才由后端非乐观插入。
- **理由**: BDD「发送内容与位置如 agent cli 提供则以其为准」(H9)。
- **影响**: Policy `OnInputAccepted_InsertUserMessageIfNotEchoed`;列表插入发生在 BC1 而非 Composer。
- **出处**: Phase 1 H9 用户确认。

## DD-8 缺失固定键 = 协议级故障,新增 ProtocolBroken 终态

- **决策**: agent cli 固定键缺失视作协议级故障(agent 坏/协议不同步),Phase 新增 `ProtocolBroken` 终态;重试同步无意义。
- **理由**: 用户指出缺固定键非数据小毛病而是协议契约被破坏,重新同步会再走坏协议陷入循环。make impossible states unrepresentable——把「协议坏(不可救)」与「同步失败(可重试)」编码为不同态。
- **影响**: 新增领域错误 `AgentCliProtocolViolation`;`ApplyLiveUpdate` 遇此不触发同步;UI 展示不带重试按钮的错误 banner。「重连/重启 agent」属 AgentLifecycle feature。
- **出处**: Phase 4 AgentCli ACL,用户确认方案 B。

## DD-9 Invalidated 单状态 + cause,不按来源分裂

- **决策**: PendingInteraction 失效合并为单一 `Invalidated` 状态,用 cause 区分 Expired / OwningConversationEnded。
- **理由**: INV-11「失效即不可操作」对两来源行为完全一致;状态分裂应针对行为不同的态,而非仅来源不同。
- **影响**: 类型层不强制区分两种失效,仅记录 cause 供展示/审计。
- **出处**: Phase 3 step 3.3 用户确认。

## DD-10 ConversationResyncProcess 复用 Phase 作流程状态

- **决策**: 重连→同步→续接的 Process Manager 不建独立状态对象,复用 `ConversationProjection.Phase`。
- **理由**: Phase 本就是 recovery/sync/live 状态机;独立状态会制造两个状态机互相同步的反模式。
- **影响**: ConversationProjection aggregate 承担少量流程编排语义(Aligned 后 attach live update)。
- **出处**: Phase 4 Saga step 用户确认。

## DD-11 InvalidatePendingInteractions 是 fan-out Policy 而非 Saga

- **决策**: 撤回「Saga 候选」判定;owning-ended 批量失效是事件触发的 fan-out service。
- **理由**: 同种操作批量、步骤间无依赖、终态无需补偿——不满足 Saga 的多步+补偿+流程状态触发。
- **影响**: 每条 interaction 各自一事务、幂等可重试;不引入 Saga 机制。
- **出处**: Phase 4 Saga step。

## DD-12 agent cli 生命周期是独立 feature

- **决策**: agent cli 的开/关/keep-alive(空闲自关、有 pending 不关、加载时启动)不纳入本 feature,作为独立 feature 另行建模。
- **理由**: BDD 明确划归 scope 外;混入会让 Core feature 失焦并污染「阅读体验」模型,且本 feature 无其验收规格(违反 Ask-don't-assume)。
- **影响**: 本 feature 与 AgentLifecycle 有 3 个集成点(M3/M7/M8),全部经 port 隔离;Lifecycle ACL 职责收紧为只消费 OwningConversationEnded。遗留 H11 待对齐。
- **出处**: Phase 4,用户确认方案 A。

## Carried-Forward

- **H11**: AgentLifecycle feature 的契约(ended 信号可靠性、pending 状态订阅、加载触发启动)待该 feature 建模时对齐。
