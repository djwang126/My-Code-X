# Feature Overview

本文概览 `apps-new` 当前已经迁移出的主要功能边界。术语以根目录 `CONTEXT.md` 为准；这里不重复定义词汇，只说明当前实现到哪里。

## 前端 Features

### App Shell

App Shell 读取 URL 中的客户端 scope，请求首屏 `Client snapshot`，并把 snapshot 投影成页面状态。它承载主 `Conversation` 阅读区和 Workspace 侧边栏入口。

### Conversation View

Conversation View 是主界面的只读 timeline。它消费 `Client snapshot` 或 `Client event` 中的 `Conversation` 数据，展示 loading、failed、empty 和 timeline 状态，并按 `message`、`work-trace`、`unknown`、`error` 渲染 `Conversation item`。

### Conversation Markdown

Conversation Markdown 是 Conversation View 内部的消息渲染能力。当前支持常见 Markdown、代码块复制、整条消息复制、安全链接处理和窄屏表格横向滚动；原始 HTML 不作为可信页面 HTML 执行。

### Workspace Panel

Workspace Panel 是移动端侧边栏，用来管理 `My-Code-X Workspace` 记录，并进入某个 Workspace 的 active `Thread list`。当前支持打开列表、添加 Workspace、重命名 Workspace、编辑 cwd、移除 Workspace、查看 active threads、加载更多和恢复非当前 Thread。

## 后端 Features

### Client Snapshot

后端通过 application / presenter 生成 `Client snapshot`。当前 snapshot 包含 app、identity、selection、workspace、thread、turn、conversation、pendingInteractions、notices、capabilities 和 stream 字段；其中 pending interaction、notice 和若干 action 能力仍是占位或未迁移完成状态。

### Client Event Stream

Client Event Stream 负责把后端事件推送给 Web client。当前实现只把 `Conversation` domain event 投影成 `conversation-replaced` 和 `conversation-item-upserted` 两类 `Client event`；turn、thread、pending interaction、notice 和 error 的 streaming contract 已存在，但对应后端投影尚未全部接入。

### Workspace Registry

Workspace Registry 管理用户手动保存的 `My-Code-X Workspace`。它负责路径 trim、路径可访问性检查、canonical cwd、重复目录检测、name/cwd 修改、remove，以及配置不可读或不可写时的内存临时模式。

### Workspace Panel Orchestration

Workspace Panel 相关 application flow 组合 Workspace Registry、Codex runtime 查询和 presenter，生成前端侧边栏 view。打开 panel 时会检查当前 `Selection` 对应的 workspaceId；若它指向已保存且可用的 Workspace，则直接加载 active `Thread list`。

### Workspace Active Thread List

后端通过 Codex runtime 请求 Codex `thread/list`，固定使用当前 `workspaceId` 作为 cwd、`archived=false`、`limit=10`、`sortKey=updated_at`、`sortDirection=desc`。返回结果被投影成前端 thread card，保留 Codex 的 name、preview、updatedAt 和分页 cursor。

### Selection State

Selection State 保存当前客户端选择的 workspaceId 和 threadId。实现中由 slot feature 承载，但本文不把 Slot 作为产品术语展开。

### Thread Read Model

Thread Read Model 保存已知 Codex `Thread` 的轻量元数据，包括 threadId、workspace、name 和 updatedAt。它通过 domain event 记住、批量记住或忘记 Thread，不直接执行 Codex 操作。

### Thread Actions

Thread Actions 编排作用于 Codex `Thread` 的操作。当前已迁移 create/open：create 调用 Codex runtime 启动新 Thread；open/resume 调用 Codex runtime 恢复已有 Thread，并返回恢复出的 timeline 和 Turn 数据。

### Turn State

Turn State 保存当前 active `Turn` 的生命周期读模型。Runtime event coordinator 会把 Codex runtime 的 turn started/completed 事件转换成 turn domain event，并记录 inProgress、completed、failed 或 interrupted 状态。

### Conversation Projection

Conversation Projection 管理前端可见的 `Conversation` timeline。它把 Codex runtime item、delta、plan、diff 和 conversation-scoped error 投影成 `message`、`work-trace`、`unknown` 或 `error` item；恢复已有 Thread 时会用恢复出的 runtime conversation 替换当前 timeline。

### Runtime Event Coordination

Runtime Event Coordination 接收 `Codex runtime event`，并分发到 Turn、Thread Read Model 和 Conversation Projection。当前 host request、Codex system notice、archive/unarchive 和 token usage 等事件尚未投影成完整的 client-facing 状态。

### Codex Runtime Adapter

Codex Runtime Adapter 是后端和原始 Codex app-server/protocol 的边界。它负责启动 JSONL transport、bootstrap Codex runtime，并把外部 Codex 协议包装成内部 RuntimePort。

### 未完成迁移

send message、respond interaction、interrupt turn 等 Client action 已经在 application/contracts 中占位，但当前仍会抛出 `SkeletonMigrationPendingError`。Pending interaction UI 语义也尚未完成，因此 snapshot 中暂时返回空数组。

## 共享协议

`apps-new/contracts` 是新版前后端共享的客户端协议层，定义 Client action、action result、Client snapshot、Client event、Conversation view、Workspace panel、Turn view 和 Pending interaction。它使用 Zod schema 保护边界，并避免把 Codex adapter 或原始 runtime protocol 词汇直接泄露给前端。
