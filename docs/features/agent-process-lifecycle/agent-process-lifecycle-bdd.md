# Feature: Agent Process Lifecycle BDD

`Agent Process Lifecycle` 让 `My-Code-X` 后端作为它所启动的 `agent cli` 进程的所有者,负责按需启动、按各 `agent cli` 原生粒度复用、并在后端自身退出时回收这些进程,不留孤儿进程。

`agent cli` 是 `My-Code-X` 当前对接的 cli 形态 agent 的统称(codex、claude code 等)。相关产品决策默认适用于所有 `agent cli`。

本文档只描述 `Agent Process Lifecycle` 自身的可验收行为。对话内容的阅读、渲染、同步由 `Conversation View` 管理;交互响应由 Interaction Handling 管理。本 feature 只关心**进程**的存在与回收,不关心进程内对话的内容。

## 背景

产品用户的电脑持续运行 `My-Code-X` 后端,后端在同一台电脑上启动并调用 `agent cli`。一个 `agent cli` 进程一旦被后端启动,其存活不应超出后端自身的存活——后端退出时,它启动的所有 `agent cli` 进程都应被回收。

不同 `agent cli` 的「进程 ↔ 会话」基数不同,本 feature **顺应各 cli 的原生粒度**,不强行统一:

- 部分 `agent cli`(如 codex)一个进程可同时服务多个会话(1:N),进程常驻;后端为同一进程登记其服务的多个会话。
- 部分 `agent cli`(如 claude code)一个进程绑定一个会话(1:1),会话结束进程随之结束。

后端为单实例进程。后端只持有内存中的进程句柄;后端自身崩溃或被强杀(无优雅退出机会)后遗留的孤儿进程,不在本 feature 的认领范围。

`agent cli` 自身可能有空闲卸载策略(如空闲一段时间后自行卸载会话或退出)。本 feature **不主动做空闲超时关闭**,顺从各 `agent cli` 自带策略,避免与其冲突。后端主动回收只发生在后端退出时。

## Process Startup

### Scenario: 按需启动 agent cli 进程

Given 某会话需要 `agent cli` 但其进程尚未启动
When 后端需要为该会话准备 `agent cli`
Then 后端启动对应 `agent cli` 进程
And 后端持有该进程的句柄
And 后端登记该会话归属于该进程

### Scenario: 复用已存在的进程(原生支持多会话)

Given 某 `agent cli` 一个进程可服务多个会话
And 该 `agent cli` 已有一个由后端启动的进程

When 后端需要为同一 `agent cli` 的新会话准备进程
Then 后端复用已存在的进程,不重复启动
And 后端把新会话也登记归属于该进程

### Scenario: 一进程一会话的 agent cli 各自独立启动

Given 某 `agent cli` 一个进程只服务一个会话
When 后端需要为该 `agent cli` 的两个不同会话准备进程
Then 后端为每个会话各启动一个独立进程

### Scenario: 并发请求同一进程只启动一次

Given 某 `agent cli` 进程尚未启动
When 两个请求几乎同时要求为该 `agent cli` 准备进程
Then 后端只启动一个进程
And 两个请求最终归属到同一个进程

## Session Attachment

### Scenario: 会话从进程登记中移除

Given 一个进程服务的某个会话不再需要该进程
When 后端登记该会话离开该进程
Then 后端从该进程的会话登记中移除该会话

### Scenario: 多会话进程在仍有会话时不被回收

Given 某进程仍服务至少一个会话
When 该进程的另一个会话离开
Then 后端保持该进程运行,不回收

### Scenario: 进程的会话全部离开后顺从原生卸载

Given 某 `agent cli` 进程的所有会话都已离开
When 后端登记最后一个会话离开
Then 后端不主动关闭该进程
And 后端顺从该 `agent cli` 自带的卸载策略

说明:不主动关闭是刻意决策——避免与 `agent cli` 自带空闲卸载策略冲突。主动回收只在后端退出时发生(见 Process Reclamation)。

## Process Supervision

### Scenario: 进程异常退出被观测到

Given 后端持有某 `agent cli` 进程的句柄
When 该进程异常退出(崩溃或被外部终止)
Then 后端观测到该进程已不再存活
And 后端把该进程标记为已崩溃
And 后端释放该进程的句柄

### Scenario: 进程崩溃通知受影响的会话

Given 某进程服务一个或多个会话
When 该进程崩溃
Then 后端通知受该进程影响的所有会话其 `agent cli` 已不可用

说明:会话侧如何反映(如 `Conversation View` 的协议中断展示、失效该对话的 pending interaction)由各自 feature 决定,本 feature 只负责发出进程已停止/已崩溃的事实。

## Process Reclamation

### Scenario: 后端优雅退出时回收所有自启动进程

Given 后端启动并持有若干 `agent cli` 进程
When 后端优雅退出(正常关闭或收到终止信号)
Then 后端回收它启动的每一个仍存活的进程
And 回收后不留下任何由后端启动的存活进程

### Scenario: 回收不因会话仍有待响应交互而豁免

Given 某进程仍服务含待响应 pending interaction 的会话
When 后端优雅退出
Then 后端仍回收该进程

说明:后端退出优先级最高,回收不被任何会话状态豁免。待响应交互随进程回收而失效,由会话侧 feature 处理。

### Scenario: 优雅退出按可用方式回收进程

Given 后端持有某 `agent cli` 进程
When 后端回收该进程
Then 后端优先以该 `agent cli` 支持的方式请求其退出
And 若该 `agent cli` 无支持的退出方式,后端直接终止该进程

说明:不同 `agent cli` 的退出方式不同(部分提供显式退出请求,部分只能终止进程)。具体方式在各 `agent cli` 接入时确定。

## Out of Scope

- 后端被强杀、断电或崩溃(无优雅退出机会)后遗留的孤儿进程的认领与清理。
- 空闲超时主动关闭进程(顺从各 `agent cli` 自带策略)。
- 进程内对话内容的加载、渲染、同步、交互响应(属其他 feature)。
- `agent cli` 的选择与切换。
- 进程资源限额、优先级、调度。
- 跨机器/远程进程管理(进程与后端同机)。

