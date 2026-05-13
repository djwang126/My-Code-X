# Feature-Active Work

`Active Work` 是当前 Codex `Thread` 的手机端工作记录视图。它以 transcript 为主，展示用户与 Codex agent 的连续交互记录。

当前设计未引入独立的 Active Work 对象。`Active Work` 暂时等同于用户正在查看和继续的 Codex `Thread`。

## Feature specification

### Transcript page

Description:

Transcript page 展示当前 `Thread` 的事件流。

Acceptance Criteria:

- 页面主体必须是当前 `Thread` 的 transcript。
- transcript event 必须按发生顺序展示。
- event 必须能区分用户输入、Codex 输出、计划、工具调用、工具结果、错误和授权请求。
- 页面不使用左右聊天气泡布局。
- 页面不提供独立 status bar、current activity panel 或工作控制区。
- 顶部信息内容待设计。

### Transcript event

Description:

Transcript event 是 transcript 中的单条记录。

Acceptance Criteria:

- event 必须有类型标签。
- 普通文本 event 使用文本块展示。
- 计划 event 使用列表展示。
- 工具调用和工具结果 event 使用可扫描的工具块展示。
- 详情展开方式待设计。
- 错误样式待设计。

### Approval event

Description:

Approval event 是需要用户决策的 transcript event。

Acceptance Criteria:

- 授权请求必须在 transcript 内展示。
- 授权请求必须与普通 event 区分。
- 授权请求必须提供确认和拒绝入口。
- 授权内容、风险范围和防误触方式待设计。

### Composer

Description:

Composer 用于继续当前 `Thread`。

Acceptance Criteria:

- Composer 必须位于页面底部。
- Composer 发送内容到当前 `Thread`。
- Composer 不展示额外 meta 行。
- 草稿保存和 pending approval 下的输入行为待设计。

## Out of Scope

- 普通 AI chatbot 页面。
- 跨 Workspace dashboard。
- 独立工作状态面板。
- pause、resume、end 控制区。
- while-you-were-away 摘要。
- 重新设计 Codex agent 能力。

## Future Plans

- 设计完整 event taxonomy。
- 设计 event data contract。
- 设计详情展开、错误展示和授权交互。
- 设计刷新、断网、切后台后的恢复行为。

## UI

Mock file: [active-work-UImock.html](./active-work-UImock.html)

当前 mock 使用蓝白配色，展示手机端 transcript 页面。mock 文案为占位内容。
