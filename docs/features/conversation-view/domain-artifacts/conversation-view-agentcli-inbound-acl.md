# AgentCli Inbound ACL Contract — Conversation View

> driven 侧(右)契约,与[前端 API contract](../conversation-view-api-contract.md)方向相反。
> 定义 agent cli → 我方的 inbound 翻译:native 协议如何被 ACL adapter 翻成领域概念,再调领域层 inbound port。
> 源:[Domain Model](../conversation-view-domain-model.md) Application Services(标 **(AgentCli 投递)** 者)+ [Context Map](./domain-context-map.yaml) AgentCli→{ConversationProjection, InteractionHandling} 两条 ACL 关系。

## 定位

```
agent cli (native 协议)
      │  inbound 流:消息/交互/错误
      ▼
┌─────────────────────────────┐
│ AgentCli ACL adapter (infra) │  ← 唯一讲 native 协议处;每个 cli 一套 adapter
│  · classify() 等翻译         │
│  · 缺固定键判定              │
└─────────────────────────────┘
      │  已翻译的领域概念
      ▼
ConversationInboundPort / InteractionInboundPort  (domain layer)
      │
      ▼
ConversationProjection / PendingInteraction  (aggregates)
```

**契约边界**:本文件定义 (1) inbound port 方法签名(领域层暴露给 adapter 的入口)、(2) native → 领域的翻译规则、(3) inbound 侧域错误。**不**定义 native 协议本身(各 cli 各异,属 adapter 实现)、**不**定义 outbound `AgentCliCommandPort`(那侧含生命周期集成,待 H11 对齐)。

## 与前端契约的三处反向

| 维度 | 前端 API contract | 本 inbound 契约 |
|---|---|---|
| `resumeCursor` | 完全不暴露 | **一等公民**:applyAuthoritativeState/applyLiveUpdate 必带,INV-7 在此实现 |
| 协议层错误 | 不可见(只见 phase 结果) | **在此抛出**:MessageOrderViolation / ResumeCursorGap / AgentCliProtocolViolation / RecoveredConversationStillRunning |
| 语言 | 已是领域词(Classification/Phase) | 入口已翻译完;native 词(type/status/固定键/turn 标记)只活在 adapter 内 |

---

## Inbound Ports

按 BC 拆两个 port,各驻其 bounded context 的领域层(对应 context map 两条独立 ACL 关系)。adapter 翻译后调对应 port;port 方法体内**不做 native 解析**(domain model 约定)。

### ConversationInboundPort

```pseudo
interface ConversationInboundPort {   // domain layer, BC: ConversationProjection

  // 历史恢复投递 → ApplyRecoveredHistoryService
  // recoveredSnapshot 必为非运行中(无进行中 turn);违反 → RecoveredConversationStillRunning
  applyRecoveredHistory(conversationId, recoveredSnapshot: RecoveredSnapshot): void
    raises [RecoveredConversationStillRunning, InvalidPhaseTransition]

  // 权威状态对齐投递(resync step2)→ ApplyAuthoritativeStateService
  // 带权威 resumeCursor,后续 live update 据此续接
  applyAuthoritativeState(conversationId, snapshot: AuthoritativeSnapshot, resumeCursor): void

  // live update 增量投递(resync step3 续接)→ ApplyLiveUpdateService
  // 一条增量原子地:按 stableKey 找到→就地更新/插入→推进 cursor(INV-2/3/7)
  applyLiveUpdate(conversationId, update: MessageDelta | TurnBoundary, resumeCursor): void
    raises [MessageOrderViolation, ResumeCursorGap, AgentCliProtocolViolation]

  // 协议契约违反(adapter 翻译阶段检出,如缺固定键)→ markProtocolBroken
  // 非内容错乱,重试同步无意义;Phase → ProtocolBroken(终态)
  markProtocolBroken(conversationId, reason): void
}
```

### InteractionInboundPort

```pseudo
interface InteractionInboundPort {   // domain layer, BC: InteractionHandling

  // 交互请求投递 → 新建 PendingInteraction(→ Pending)
  raisePendingInteraction(interactionId, conversationId, content: InteractionContent): void

  // agent 失效/取消/超时投递 → ExpirePendingInteractionService
  // 唯一来源 Expired;剥离 agent 锁语义(响应锁我方自持)
  // OwningConversationEnded 走 LifecycleInboundPort,不在本契约
  expirePendingInteraction(interactionId): void
    raises [PendingInteractionNotFound]   // 已终态则幂等忽略,不抛
}
```

---

## Translation Rules (native → 领域)

翻译是本契约的核心,全部发生在 adapter 内。下表是**所有** cli 共享的目标语义;具体 native 字段名/取值因 cli 而异,由各 adapter 实现。

| native 输入 | 领域产物 | 规则 |
|---|---|---|
| native type(+ 可选其他字段) | `Classification` + `NativeType` | 见下 `classify()`;NativeType 原样保留作文案 |
| native status | `NativeStatus`(可空) | 纯文案透传;**绝不**作产品状态依据;缺失=该 type 本无 status |
| cli 固定键 | `Message.stableKey` | identity;**缺失 → AgentCliProtocolViolation**(非内容错乱) |
| native 发生顺序 | `Message.sequence` | 破坏既定顺序 → MessageOrderViolation |
| 字段名+字段内容 | `MessageContent.fields[]` | 有序保留,作 Generic Field Rendering 原料;UTF-8/CJK/emoji 不损 |
| 更新语义 | `MessageDelta`(AppendDelta \| FullReplace) | 由 cli + 信息类型决定;映射到前端 message-updated 的 append \| replace |
| turn 标记 | `Turn` + `TurnState`(InProgress/Interrupting/Ended) | 完全采信 agent,不自行推断(INV-6) |
| turn 时间戳 | `Turn.startTime` / `endTime` | best-effort 取最接近的可用信息;缺失留空 |
| 续接原料 | `ResumeCursor` | 不丢不重的游标(INV-7);前端不可见 |
| agent 失效/取消/超时 | `expire`(cause=Expired) | 剥离 agent 锁语义 |
| 交互请求 prompt+选项 | `InteractionContent` + `ResponseOption[]` | option 携 requiresSupplement |

### classify() — 分类映射扩展点

每个 cli adapter 实现,而非声明式配置表——允许分类依赖多个 native 字段而非仅 type 字符串。

```pseudo
// 每个 cli adapter 实现;在各 cli 接入时确定映射
classify(nativeMessage): ClassificationOutcome

ClassificationOutcome =
  | Classified(Classification)   // 四类之一:NormalConversation | WorkProcess | Failure | Unrecognized
  | Ignored                      // 可识别但刻意不进四大分类(留作后续 feature / 刻意忽略)
```

规则约束(INV-4):
- 每条进入投影的 Message **恰属一个** Classification;无专门规则 → 落 `Unrecognized`(前端走 Generic Field Rendering,摘要缺 type 时显示 `Unknown type`)。
- `Ignored` 的信息**不进**投影(不产生 Message),与 `Unrecognized`(进投影、兜底渲染)语义不同。
- `Failure` 仅用于 agent 给出的**带归属**错误;无归属错误不走此路径(见下)。

### 错误归属路由

错误是否归属由 agent cli 自身逻辑决定,adapter 不自行判断(BDD):

| agent 给出 | adapter 翻译为 | 去向 |
|---|---|---|
| 带归属错误 | Message(classification=Failure) | 经 `applyLiveUpdate` 进对应对话信息列表 |
| 无归属错误 | UnattributedError | 经 Notification(toast),**不**进任何投影 |

---

## Inbound DTOs(port 接收的领域形态)

```jsonc
// 历史恢复快照 — 必为非运行中(INV-5)
RecoveredSnapshot {
  messages: Message[],          // 已分类、已带 stableKey/sequence
  turns:    Turn[]              // 全部 Ended(无进行中 turn,违反 → RecoveredConversationStillRunning)
}

// 权威状态快照 — resync 对齐用
AuthoritativeSnapshot {
  messages: Message[],
  turns:    Turn[]              // 可含进行中 turn(与 recovery 不同)
}

// live update 增量
MessageDelta {
  stableKey: string,
  mode:      "AppendDelta" | "FullReplace",
  fields:    Field[]            // AppendDelta=增量字段;FullReplace=整条字段集
}
TurnBoundary {
  turnId: string,
  state:  "InProgress" | "Interrupting" | "Ended",
  startTime?: DateTime,
  endTime?:   DateTime
}

// Message / Turn / InteractionContent / ResponseOption 同 domain model 定义,不重述
```

注:这些是 **adapter 翻译后** 的领域 DTO,非 native wire 格式。Message 在此已携 Classification——分类发生在 adapter 调 port 之前。

---

## Inbound 侧错误契约

这些域错误**只在 inbound 路径产生**,前端永不直接收到(只通过前端契约的 `phase-changed` 看结果)。

| 域错误 | 触发 | adapter/service 后续动作 | 前端最终所见 |
|---|---|---|---|
| AgentCliProtocolViolation | adapter 翻译阶段:缺固定键等协议契约违反 | `markProtocolBroken` → Phase=ProtocolBroken;**不**触发同步(终态) | `phase-changed: ProtocolBroken`(banner 无重试) |
| MessageOrderViolation | sequence 破坏既定顺序(INV-3) | 触发 ConversationResyncProcess(可救) | `Syncing` → `Synced`(自愈) |
| ResumeCursorGap | live update 与当前 cursor 不连续(INV-7) | 触发 ConversationResyncProcess(可救) | `Syncing` → `Synced`(自愈) |
| RecoveredConversationStillRunning | 恢复快照含进行中 turn(INV-5) | 向上传播,投影停 RecoveryFailed,不吞 | `phase-changed: RecoveryFailed`(banner 带重试) |
| InvalidPhaseTransition | 在错误相位投递 | 视情况幂等忽略或传播 | 通常无感知 |

**判定归属**:`AgentCliProtocolViolation`(协议坏,不可救,终态)与 `MessageOrderViolation`/`ResumeCursorGap`(内容错乱,可重新同步救)是 DD-8 刻意区分的两类——前者重试同步会再走坏协议陷入循环,故不触发 resync。

---

## ResumeCursor 与续接(INV-7)

cursor 是 inbound 契约独有的一等概念,贯穿 resync 三步:

1. `applyAuthoritativeState(snapshot, resumeCursor)` — 对齐时拿到权威 cursor 作基线(resync step2)。
2. `applyLiveUpdate(update, resumeCursor)` — 每条增量带 cursor;port 校验与当前 cursor **连续**:连续则就地更新/插入并推进 cursor;不连续 → `ResumeCursorGap` → 触发 resync 回 step1。
3. cursor 保证同步快照与后续 live update 增量**不丢不重**。

前端契约里 cursor 完全不出现——前端只发 `/sync`、看 `phase-changed`,续接对齐全在这层完成。这正是两份契约方向相反的体现。

---

## Carried-Forward

- **outbound 未定**:`AgentCliCommandPort`(requestHistoryRecovery / requestAuthoritativeState / relay* / queryCapability)含生命周期集成点(M7 keep-alive、M8 加载触发启动),待 AgentLifecycle feature 建模时随 H11 一并对齐。本 inbound 契约不依赖其形态。
- **每 cli 一套 adapter**:codex / claude code 等各实现 `classify()` 与 native 翻译,共享同一组 inbound port;各 cli 的 native type→Classification 映射表在其接入时确定并应单独记录。




