# Domain Model — Agent Process Lifecycle

## Related Artifacts

- BDD: [link](./agent-process-lifecycle-bdd.md)
- 上游集成: [Conversation View Domain Model](../conversation-view/conversation-view-domain-model.md)(本 feature 是其 H11 中 AgentLifecycle 的落地)

## Context Overview

```yaml
contexts:
  - name: AgentProcessManagement
    type: core
    responsibility: agent cli 进程的所有权——按需启动、按原生粒度复用(引用计数)、存活监督、后端退出时回收;不留孤儿。
```

外部系统:`AgentCli`(被启动与回收的 cli 进程,经 ProcessControl ACL 集成)、`HostRuntime`(后端进程自身的退出信号源,经边界集成)。

后端为单实例。只持有内存中的进程句柄;不持久化、不认领崩溃遗留的孤儿(BDD Out of Scope)。

下游:`ConversationProjection` / `InteractionHandling`(经 integration event 订阅进程停止/崩溃事实,自行决定如何反映)。

---

## Bounded Context: AgentProcessManagement

### Aggregate: AgentProcess

#### Structure

```yaml
root: AgentProcess
members:
  - { name: AgentProcess,    role: root,   type: Entity }
  - { name: CliKind,         role: vo, type: VO, semantics: "Codex | ClaudeCode;决定会话基数上限" }
  - { name: ProcessState,    role: vo, type: VO, semantics: "生命周期状态机判别联合" }
  - { name: ProcessHandle,   role: vo, type: VO, semantics: "OS 进程句柄(pid/进程树根),infra 细节最小暴露" }
  - { name: SessionRef,      role: vo, type: VO, semantics: "归属会话的引用(conversationId/sessionId)" }
  - { name: AttachedSessions, role: vo, type: VO, semantics: "会话引用集合;其基数充当引用计数" }
```

#### Fields — AgentProcess

```yaml
fields:
  - { name: processId,        type: ProcessId,   constraints: [required, immutable], note: "我方分配的句柄 id; identity" }
  - { name: cliKind,          type: CliKind,     constraints: [required, immutable] }
  - { name: state,            type: ProcessState, constraints: [required], note: "生命周期状态机" }
  - { name: handle,           type: ProcessHandle, constraints: [optional], note: "Running 时持有;Stopped/Crashed 后释放" }
  - { name: attachedSessions, type: AttachedSessions, constraints: [required], note: "会话引用集合;count 即引用计数" }
```

说明:`attachedSessions` 是**会话引用集合**而非裸计数——Supervision 要求崩溃时通知具体哪些会话,故必须持有引用而非仅数量。引用计数语义(归零判断)由集合基数派生,不另存独立计数字段(避免与集合漂移)。

#### State Machine — AgentProcess

```yaml
state_machine:
  discriminant: state
  states:
    - { name: Starting, fields: [] }
    - { name: Running,  fields: [handle, attachedSessions] }
    - { name: Stopping, fields: [handle] }
    - { name: Stopped,  fields: [] }
    - { name: Crashed,  fields: [lastSessions] }   # 崩溃瞬间的会话集,供通知 fan-out
  transitions:
    - { from: "∅",       to: Starting,  on: EnsureProcessForSession }
    - { from: Starting,  to: Running,   on: ConfirmProcessStarted }
    - { from: Starting,  to: Crashed,   on: ObserveProcessExit }
    - { from: Running,   to: Running,   on: "AttachSession | DetachSession (引用计数增减,不迁移状态)" }
    - { from: Running,   to: Stopping,  on: ReclaimProcess }
    - { from: Running,   to: Crashed,   on: ObserveProcessExit }
    - { from: Stopping,  to: Stopped,   on: ConfirmProcessExited }
    - { from: Stopping,  to: Crashed,   on: ObserveProcessExit }   # 回收中提前死亡,仍按崩溃归因
```

说明:`AttachSession`/`DetachSession` 在 `Running` 内自环——引用计数增减不是状态迁移。**零引用不触发任何迁移**(BDD:不主动关,顺从原生卸载)。`ReclaimProcess` 只由后端退出驱动(见下)。`Stopped` 与 `Crashed` 均为终态;区别在于 `Stopped` 是后端主动回收的预期结果、`Crashed` 是观测到的非预期退出,二者下游通知语义不同。

#### Invariants

```yaml
invariants:
  - { id: INV-A, rule: "AgentProcess 任一时刻恰处于一个 ProcessState", enforced_at: "ProcessState 判别联合 + 状态迁移方法" }
  - { id: INV-B, rule: "ClaudeCode 进程 attachedSessions 基数恒 ≤1;Codex 可 ≥1", enforced_at: "attachSession (按 cliKind 校验)" }
  - { id: INV-C, rule: "同一 cliKind+复用键下,至多一个非终态(Starting/Running/Stopping)进程", enforced_at: "EnsureProcessForSession (声明式幂等, 单实例串行)" }
  - { id: INV-D, rule: "进程异常退出必被观测并转 Crashed, handle 释放;不留'以为活着实则已死'的句柄", enforced_at: "ObserveProcessExit" }
  - { id: INV-E, rule: "后端优雅退出时所有非终态 AgentProcess 必被 ReclaimProcess 驱动至 Stopped/Crashed", enforced_at: "退出回收编排 (见 Application Services)" }
  - { id: INV-F, rule: "进程转 Stopped/Crashed 时 handle 必被释放", enforced_at: "状态迁移方法" }
```

#### Boundary Rationale

INV-B/INV-C 把「会话基数」与「复用裁决」绑在 AgentProcess 单一致性边界:为会话准备进程时,「找到可复用进程 OR 新建」与「attach 会话 + 校验基数」必须原子,否则并发会启重(违反 BDD「并发只启一次」)。后端单实例,内存串行裁决,无需分布式锁(同 conversation-view DD-1)。一个进程一个 aggregate 实例(小,符合 Vernon);退出回收跨多个实例、为编排,不进单 aggregate 事务。

#### Domain Events

```yaml
events:
  - { name: AgentProcessStarted,       payload: [processId, cliKind], emitted_when: "进入 Running" }
  - { name: SessionAttachedToProcess,  payload: [processId, sessionRef], emitted_when: "会话 attach 成功" }
  - { name: SessionDetachedFromProcess, payload: [processId, sessionRef], emitted_when: "会话 detach 成功" }
  - { name: AgentProcessStopped,       payload: [processId, lastSessions], emitted_when: "主动回收完成, 进入 Stopped" }
  - { name: AgentProcessCrashed,       payload: [processId, lastSessions, reason], emitted_when: "观测到非预期退出, 进入 Crashed" }
```

`AgentProcessStopped` / `AgentProcessCrashed` 携 `lastSessions` —— 下游(ConversationProjection/InteractionHandling)据此知道哪些会话受影响。这是本 feature 对外的**集成事件**;下游如何反映(协议中断展示、失效 pending)各自决定(M3)。

#### Repository Port

```pseudo
interface AgentProcessRepository {   // domain layer (内存实现; 不持久化)
  find_by_id(processId): AgentProcess              // raises AgentProcessNotFound
  find_reusable(cliKind, reuseKey): AgentProcess?  // 复用裁决: 返回可 attach 的非终态进程, 无则 null
  find_all_live(): List<AgentProcess>              // 退出回收 fan-out: 所有非终态进程
  save(process): void
  remove(processId): void                          // 终态进程出登记
}
```

`reuseKey`:复用粒度键。Codex 按可复用维度(如工作目录,接入时定)聚合多会话到一进程;ClaudeCode 恒不可复用(每会话新建),`find_reusable` 对其恒返回 null(INV-B)。

#### Domain Errors

##### AgentProcessNotFound
- **Condition**: find_by_id 找不到该 processId
- **Business meaning**: 该进程不存在或已出登记
- **Severity**: not-found
- **Raised by**: AgentProcessRepository.find_by_id

##### SessionCapacityExceeded
- **Condition**: 向 ClaudeCode(或已满)进程 attach 超出基数上限,违反 INV-B
- **Business meaning**: 该 agent cli 进程不支持再附加会话
- **Severity**: business-rule
- **Raised by**: AgentProcess.attachSession

##### InvalidProcessStateTransition
- **Condition**: 状态迁移不在 INV-A 允许集内(如对 Stopped 进程 attach)
- **Business meaning**: 在错误的进程状态上执行了操作
- **Severity**: conflict
- **Raised by**: AgentProcess 状态迁移方法

---

## Application Services

### EnsureProcessForSessionService  (上游 conversation-view 经 port 调用 — M8)
**Input**: cliKind, reuseKey, sessionRef
**Output**: processId | raises [SessionCapacityExceeded, InvalidProcessStateTransition]
**Steps**: 1. `find_reusable(cliKind, reuseKey)` 2. 命中 → `process.attachSession(sessionRef)`(INV-B/INV-C);未命中 → 新建 AgentProcess(Starting)、`save`、经 `ProcessControlPort.spawn` 启动、`attachSession` 3. `save` 4. emit AgentProcessStarted / SessionAttachedToProcess
**语义**: 声明式幂等——「确保该会话有可用进程」。并发同 reuseKey 由单实例串行 + INV-C 保证只启一个。
**Transaction boundary**: 单事务 AgentProcess

### DetachSessionService
**Input**: processId, sessionRef
**Output**: void | raises [AgentProcessNotFound]
**Steps**: 1. `find_by_id` 2. `process.detachSession(sessionRef)` 3. `save`(零引用**不**触发回收) 4. emit SessionDetachedFromProcess
**Transaction boundary**: 单事务

### ObserveProcessExitService  (ProcessControl ACL 投递 — 监督)
**Input**: processId, exitInfo
**Output**: void
**Steps**: 1. `find_by_id` 2. `process.markCrashed(reason, snapshot attachedSessions → lastSessions)`(INV-D, handle 释放 INV-F) 3. `save` → `remove` 4. emit AgentProcessCrashed(lastSessions)
**说明**: 若该退出是 ReclaimProcess 预期内的(Stopping→Stopped),则走 ConfirmProcessExited 而非崩溃归因
**Transaction boundary**: 单事务

### ReclaimAllProcessesService  (HostRuntime 退出信号驱动 — INV-E)
**Input**: —(后端优雅退出触发)
**Output**: void
**Steps**: 1. `find_all_live()` 2. for each: `process.startReclaim()`(→ Stopping)、经 `ProcessControlPort.terminate`(优雅退出方式 → 强杀, BDD)、`confirmExited`(→ Stopped, handle 释放)、`save`/`remove`、emit AgentProcessStopped(lastSessions)
**Error propagation**: 单进程回收失败不阻断其他进程;尽力回收所有
**Transaction boundary**: **每个 AgentProcess 各自一事务**(fan-out, 非跨 aggregate);受后端退出窗口时限约束

---

## Adopted Tactics

### ACL — ProcessControl ACL
- **Trigger reason**: agent cli 进程的 spawn/terminate/exit 观测是 OS + 各 cli 异构细节(Codex 无显式 shutdown、ClaudeCode 子进程随 query 流;Windows 进程树清理),会扭曲 domain。
- **Scope**: AgentProcessManagement ↔ AgentCli 进程。
- **Design summary**: `ProcessControlPort`(spawn / terminate / 退出观测回调)在领域层;adapter 在 infra 讲 OS + cli 协议。翻译:cliKind → 启动命令与参数;优雅退出请求 →(Codex 断连/无显式退出则 kill 进程树;ClaudeCode 结束 query 流/杀子进程);OS 进程退出 → ObserveProcessExit。Windows 进程树清理(taskkill /T 或 job object)藏于 adapter。

### ACL — HostRuntime 边界
- **Trigger reason**: 把后端自身的退出信号(正常关闭 / SIGINT / SIGTERM)翻成 ReclaimAllProcesses 触发。
- **Scope**: AgentProcessManagement ← HostRuntime。
- **Design summary**: `HostShutdownPort.onGracefulShutdown()` 触发 ReclaimAllProcessesService。**强杀/断电无此信号**——孤儿不被回收(BDD Out of Scope, 见 Carried-Forward)。

### Policy-driven fan-out — ReclaimAllProcesses (INV-E)
- **Trigger reason**: 退出回收对所有存活进程批量、无步骤依赖、无需补偿——非 Saga。
- **Scope**: 多个 AgentProcess 实例。
- **Design summary**: 退出信号触发的 fan-out service,每进程一事务、尽力而为;受退出窗口时限约束。

---

## Carried-Forward Hotspot

- **强杀遗留孤儿**(显式假设):INV-E 仅在后端**优雅退出**时成立。后端被 SIGKILL / 断电 / 崩溃强杀时,ReclaimAllProcesses 无机会运行,自启进程成孤儿;本 feature 不认领(只管内存句柄)。若未来此漏洞需根治,要引入持久化 pid/工作目录登记 + 重启扫描认领(当前 YAGNI 排除)。
- **H11 回填**:本 feature 落地了 conversation-view 的 AgentLifecycle 集成——M8(EnsureProcessForSession ← AgentCliCommandPort.requestHistoryRecovery 背后)、M3(AgentProcessStopped/Crashed → 下游失效 pending)。M7(有 pending 不关)在本 feature 范围下消解:不做空闲自关,退出回收不被 pending 豁免,故无需「keep-alive 输入」。需回 conversation-view 标注 M7 已消解。



