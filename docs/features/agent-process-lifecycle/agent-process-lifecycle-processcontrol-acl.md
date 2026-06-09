# ProcessControl ACL Contract — Agent Process Lifecycle

> driven 侧契约。定义 `AgentProcessManagement` 如何经 `ProcessControlPort` 启动/终止 agent cli 进程、并接收进程退出观测。
> 源:[Domain Model](./agent-process-lifecycle-domain-model.md) 的 ProcessControl ACL + Application Services。
> 与 conversation-view 的 [inbound-acl](../conversation-view/domain-artifacts/conversation-view-agentcli-inbound-acl.md) 同为 driven 侧,但本契约核心不是**语义翻译**,而是**两个 cli 的进程操作差异规格 + 跨平台进程树清理**。

## 定位

```
AgentProcessManagement (domain)
   │  spawn / terminate(领域意图)
   ▼
┌──────────────────────────────────┐
│ ProcessControl adapter (infra)    │  ← 唯一讲 OS + cli 进程协议处;每个 cli 一套
│  · cliKind → 启动命令/参数         │
│  · 优雅退出 → kill 策略            │
│  · 进程树清理(Windows/POSIX)      │
│  · OS 退出观测 → ObserveProcessExit│
└──────────────────────────────────┘
   │  spawn/kill OS 进程; 监听退出
   ▼
agent cli 进程 (Codex app-server / Claude 子进程)
```

**契约边界**:本文件定义 (1) `ProcessControlPort` 方法签名、(2) 每个 cli 的进程操作适配规格(本轮留占位,接入时确定)、(3) adapter 必须满足的跨平台约束。**无前端 API 契约**——本 feature 无前端 consumer,进程管理是 conversation-view 加载/后端退出的副作用。

## ProcessControlPort

```pseudo
interface ProcessControlPort {   // domain layer

  // 启动一个 agent cli 进程。cliKind + spawnSpec(接入时定)决定命令/参数/工作目录。
  // 返回 ProcessHandle(pid / 进程树根标识)。启动失败 → 抛 ProcessSpawnFailed。
  spawn(cliKind, spawnSpec): ProcessHandle
    raises [ProcessSpawnFailed]

  // 终止一个进程。优先以该 cli 支持的优雅方式请求退出, 超时/不支持 → 强制终止整个进程树。
  // 幂等:对已退出进程为 no-op。须保证返回后无遗留子进程。
  terminate(handle, mode: Graceful | Force): void

  // 注册进程退出观测回调。进程因任何原因退出(主动 kill / 崩溃 / 外部终止)时触发,
  // 携 exitInfo(退出码 / 信号 / 是否本方发起)。驱动 ObserveProcessExitService。
  onProcessExit(handle, callback: (exitInfo) => void): void
}
```

说明:`terminate` 是声明式且幂等——回收编排可能对正在退出的进程重复调用。`onProcessExit` 是观测入口;adapter 负责区分「本方 terminate 发起的预期退出」与「非预期崩溃」,经 exitInfo 透传给领域层据以走 ConfirmProcessExited(→Stopped)或崩溃归因(→Crashed)。

## 每个 cli 的进程操作适配规格

> 本轮**留占位**:具体命令/参数/优雅退出能力在各 cli 接入时确定并回填。下表是已知形状与待核实项。

### Codex(1:N,进程常驻)

| 操作 | 已知 / 待核实 |
|---|---|
| spawn | 启动 app-server 进程(stdio / unix-socket / ws 之一)。**待核实**:精确命令行与传输选择。 |
| 优雅退出 | **待核实**:调研未发现显式 shutdown API。若确无 → Graceful 退化为「断开连接后强杀进程树」。 |
| 退出观测 | 监听 OS 进程退出 + 传输连接断开。**待核实**:崩溃与正常退出的区分信号。 |
| 复用 | 同 `reuseKey`(如工作目录,**待核实**聚合维度)复用同一进程,attach 多 thread。 |

### ClaudeCode(1:1,会话绑进程)

| 操作 | 已知 / 待核实 |
|---|---|
| spawn | SDK `query()` 内部 spawn `claude` 子进程,经 stdio 通信。**待核实**:我方是直接 spawn 还是经 SDK 托管句柄。 |
| 优雅退出 | 结束 `query()` 流 / SDK `disconnect()`,子进程随之退出。**待核实**:超时未退的兜底。 |
| 退出观测 | SDK 捕获子进程 exit code + ResultMessage.subtype。**待核实**:崩溃事件透出形式。 |
| 复用 | 不复用,恒每会话一进程(INV-B);`find_reusable` 恒返回 null。 |

## adapter 必须满足的跨平台约束

无论各 cli 细节如何,以下是 adapter 实现的硬约束(直接服务 INV-C/D/E/F):

1. **无遗留子进程**:`terminate` 返回后,目标进程**及其子进程树**必须全部终止。这是本 feature 存在的理由——「产品关了 codex 还开着」即此约束失败。
   - Windows(主战场):用 `taskkill /T /F` 或 Job Object 杀整树;单杀 pid 会留子进程。
   - POSIX:进程组(`kill -- -pgid`)或 process group 信号。
2. **退出可观测**:进程以**任何**方式消失都必须触发 `onProcessExit`(INV-D:不留「以为活着实则已死」的句柄)。
3. **spawn 幂等性由领域层保证**:adapter 的 `spawn` 每次真起新进程;「不重复启动」由 `EnsureProcessForSessionService` + INV-C 在领域层裁决,adapter 不自行去重。
4. **回收窗口时限**:退出回收(ReclaimAllProcesses)在后端退出窗口内尽力完成;Graceful 超时须有上限并退化为 Force,不可无限等待。

## Domain Errors(本契约相关)

##### ProcessSpawnFailed
- **Condition**: spawn 无法启动进程(可执行文件缺失、权限、端口占用等)
- **Business meaning**: agent cli 进程无法启动
- **Severity**: infrastructure
- **Raised by**: ProcessControlPort.spawn → EnsureProcessForSessionService 向上传播

注:`terminate` 不抛错——幂等且尽力而为;失败经 `onProcessExit` 是否最终触发来体现,回收编排不因单次 terminate 异常阻断其他进程(domain model ReclaimAllProcessesService)。

## Carried-Forward

- **cli 进程操作细节待核实**(本契约最大留白):Codex 是否有优雅 shutdown、ClaudeCode 子进程的干净终止与崩溃透出、各自 spawn 命令行、Codex 复用维度。需一轮针对**进程控制层**的调研(调研已覆盖「1:N/1:1」基数,未覆盖「怎么启怎么杀」)。回填前 adapter 按本契约约束以「断连/超时 → 强杀进程树」为安全默认。
- **强杀遗留孤儿**:同 domain model——后端非优雅退出时本契约的 terminate 无机会调用,孤儿不被回收(YAGNI 排除认领)。

