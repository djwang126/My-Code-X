# Conversation View — Slicing Plan

## Approach

- Tracer-bullet 垂直切片：每切片穿透 domain → ACL → HTTP/SSE → web UI → 测试，独立可演示。
- 全栈 greenfield：先 walking skeleton + 高风险假设 spike，产出可能包含文档修订。
- 横切关注点不作为独立切片，自 Phase 1 起作为每切片验收基线。

## 高风险假设

Phase 0 探查目标，按"如果错了，重做范围"排序：

| ID | 假设 | 风险 |
|---|---|---|
| A | AgentCliACL 6-port 划分与 codex / claude code 实际 API 形态匹配 | 端口形态错误 → 所有入站路径重做；两个 agent cli 形态差异是否能被同一组 port 干净容纳 |
| B | Cursor 可单调递增跨 entry/turn/interaction/content-restore 四类事件源 | 契约不成立 → snapshot+SSE 衔接方案重设计 |
| C | EntrySequence 与 InteractionSequence 不同空间，UI 按"发生顺序"交错展示的 merge 依据可信 | 依据不存在 → domain model 或 API contract 需补字段 |
| D | 前端 freshness（弱网重连）与 ContentRestore（agent cli 历史装载）两条入站通道可用同一套 banner 区分呈现 | 混淆 → banner 系统或 domain 边界需调整 |

## Slices

### Phase 0 — 地基（HITL，可能改文档）

| # | Title | Blocked by | 目标 |
|---|---|---|---|
| 0.1 | Walking skeleton | — | web→server→web 空线打通；构建、测试框架、SSE 传输固定；无业务无 ACL |
| 0.2a | Codex ACL spike | 0.1 | 对 `../codex/codex-rs` 写最小 adapter，触 InformationClassificationPort + TurnSignalPort + ContentRestorePort；验假设 A（codex 侧）；产出：adapter 雏形 + 文档修订（如有） |
| 0.2b | Claude Code ACL spike | 0.1 | 对 claude code 写最小 adapter，触 InformationClassificationPort + TurnSignalPort + ContentRestorePort；验假设 A（claude code 侧）；产出：adapter 雏形 + 文档修订（如有） |

实习生结论：【
0.2a 执行发现：Codex app-server protocol 的 `turn/started` / `turn/completed` 通知本身不携带完整 entry 引用；Codex adapter 需要在 TurnSignalPort 内部关联 turn 通知与 `item/*` 通知后，再产出 `TurnStarted` / `TurnCompleted` 语义。Codex `turn/completed` 可能是 `failed` 或 `interrupted` 且没有最后一条 agent reply，因此 `TurnCompleted` 需要携带 outcome，并允许 `lastAgentReplyRef` 缺失。Codex `error` notification 无 item id，adapter 需要为同一 turn 内多条 failure 生成不碰撞的 entry id。

0.2a smoke 验证：使用 `codex app-server --listen stdio://` 捕获真实 JSON-RPC 输出，成功验证 `thread/resume` 默认返回 `thread.turns`，可作为 ContentRestorePort 的真实恢复来源；`turn/started` → `item/started` / `item/completed` → `turn/completed` 可由同一 Codex adapter 翻译为 Conversation View 需要的分类与 turn 语义。真实 app-server 事件里的 `AgentReply` 流式状态应由 `item/started` / `item/completed` 生命周期提供，而不是只看 `agentMessage.phase`。

0.2b 执行发现：Claude Code TypeScript Agent SDK 的 live `query()` 输出不会回放本次 prompt 的 `user` message；实测 smoke 只收到 `system`、assistant thinking/text 与 `result`。因此 `TurnStarted` 不能只从 SDK live stream 推导，My-Code-X 需要在提交输入时把本地 user entry 与 Claude `session_id` 关联，或在送入 TurnSignalPort 时携带本地 user event。SDK `result` 可作为 active turn 的完成信号，`getSessionMessages()` 可按 session id 恢复历史 user/assistant/system messages；assistant thinking-only message 归入 `WorkProgress`，含 text 的 assistant message 归入 completed `AgentReply`。】

### Phase 1 — Tracer（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 1 | End-to-end echo skeleton | 0.x | Conversation View Shell（无选中 / 首屏定位底部 / Composer 显示）、Conversation Information Rendering（普通对话内容直接展示）、Composer（空闲发送 / 发送被接受清空 draft） | 用户输入→fake adapter echo Completed AgentReply→列表底部可见。建立 4 个 BC 最小骨架、AgentCliACL 雏形、snapshot + SSE entry-added + POST /inputs。横切基线自此切片起强制 |

### Phase 2 — 历史阅读路径（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 2 | Restored snapshot read path | 1 | Conversation View Shell（恢复中 / 恢复成功无内容 / 恢复失败 / 已有内容首屏到底部）、Turn Toolbar（进行中 / 已完成 / 进行中不展示 agent 侧工具栏） | ContentRestore 聚合 + ContentRestorePort + content-restore.status-changed；GET snapshot 贯通历史 entry / turns；空≠失败语义贯通；打开已有对话可稳定阅读；前端由 snapshot turns 派生 busy/idle 并展示静态 toolbar |
| 3 | Static transcript entry rendering | 2 | Conversation Information Rendering（四类信息、顺序、工作过程、失败、未识别）、Message Reading（Markdown / 代码块 / 表格 / 外链 / 非外链不处理） | InformationClassificationPolicy 接入；静态快照中混合 UserInput / AgentReply / WorkProgress / Failure / Unrecognized；默认折叠、展开状态、Failure 兜底、Markdown 富渲染、代码块复制、宽表格横滚、外链打开 |

### Phase 3 — Live reading（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 4 | Streaming reply without scroll disruption | 2, 3 | Message Reading（正在输出的回复持续更新）、Live Update（新信息进入 / 已有信息更新 / 旧位置稳定 / 底部自然跟随）、Non-Functional（流式增量不整列表重排） | turn.started / turn.completed + ReplyStreamState InProgress→Completed；reply-delta + entry-updated；前端流式拼接、完成态切换；live busy/idle 更新；滚动锚定策略与增量更新性能基线 |

### Phase 4 — Composer（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 5 | Composer draft + normal send hardening | 2 | Composer（多行输入 / 按对话保存 draft / 未选中不绑 draft / 空文本不能发送 / 空闲发送 / 发送成功清空 / 发送失败保留 / 目标状态不明确禁用）、Non-Functional（发送输入编码保真） | 本地按对话维护 draft；多行随内容增长到最大高度后内部滚动；POST /inputs Accepted / SendFailed；发送禁用准入；重复发送禁用；UTF-8 / CJK / emoji 保真 |
| 6 | Supplementary instruction + interrupt | 4, 5 | Composer（工作中追加指令 / 工作中无输入中断 / 不支持动作降级） | GET /agent/capabilities + POST /supplementary-instructions + POST /interrupt；主操作按钮三态切换；中断确认 modal；不模拟 agent cli 不支持的能力 |

### Phase 5 — Notice 与弱网恢复（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 7 | Page notices + freshness banner | 2, 4, 5 | Conversation View Notice 全部、Conversation View Shell（已有内容时同步状态非阻塞展示）、Composer（发送失败非阻塞提示） | agent-error / My-Code-X 页面级错误 / SendFailed / freshness 共用 banner 表现；一次性 banner 自动消失；持续状态 banner 不自动消失；多 banner 垂直堆叠；不插入 transcript |
| 8 | SSE reconnect + resync | 4, 7 | Live Update（重连恢复内容并继续接收）、Conversation View Shell（已有内容时同步状态非阻塞展示） | Last-Event-ID 衔接；cursor 失效走 resync-required；重新 snapshot + 续订阅；重连后 entry-updated 替代 delta；freshness banner 联动 |

### Phase 6 — 多连接（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 9 | Multi-connection transcript parity | 5, 8 | Multiple Connections（多个前端同时接收 live update / 任一前端发送成功后所有连接可见 / draft 不跨客户端同步 / 重连不继承其他连接操作状态） | 同 conversation SSE fanout；任一端发送后全部连接可见；draft 与展开状态保持本地；重连只恢复对话内容 |

### Phase 7 — Pending Interaction（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 10 | Single pending interaction | 4 | Pending Interaction（展示 / 选项响应 / 文字补充 / 响应被接受 / 超时或取消） | PendingInteraction 聚合 + InteractionSignalPort + interaction.raised + interaction.status-changed + POST response；单条状态机 Pending→Resolved/Expired/Cancelled |
| 11 | Multiple pending interactions + first-write-wins | 9, 10 | Pending Interaction（多条并存 / 切换到有 pending 的对话 / 多连接先到先得 / 重复响应被拒绝） | 同对话多个 interaction 独立排序；跨对话 snapshot 恢复；first-write-wins + 409 重复拒绝；对端 live update 同步 |

### Phase 8 — 移动端阅读收口（AFK）

| # | Title | Blocked by | BDD 覆盖 | 范围 |
|---|---|---|---|---|
| 12 | Long conversation mobile readability pass | 3, 4, 8, 9 | Non-Functional（长对话移动端保持可阅读 / 渲染回复文本编码保真） | 数百条消息混合 reasoning、工具结果、代码块、表格和普通回复；移动端阅读性能、内存、滚动稳定性与 UTF-8 / CJK / emoji 渲染保真验收 |

## 横切基线

自切片 1 起每切片验收时检查，不作为独立切片：

- **多连接广播**：所有 SSE 事件向全部订阅者下发；从第一个 SSE 切片起就建立。
- **滚动锚定**：用户在底部自然跟随，不在底部不打扰；在流式切片中正式验收，之后持续回归。
- **UTF-8 / CJK / emoji 保真**：发送与渲染两端测试基线。
- **列表重排与内存监控**：流式增量不触发整列表重排；长对话移动端阅读在收口切片中专项验收。
