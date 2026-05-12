# Feature-Multi Active Work

`Multi Active Work` 让用户在一个 Workspace-first 的手机端 panel 中查看、切换和恢复当前 Workspace 下的 `Thread` 工作。当前设计不引入独立的 Active work 对象；Active work 只是 `Thread history` 中仍有状态或近期活跃的 `Thread`。

## Feature specification

### Workspace panel overlay

Description:

Workspace panel overlay 是 My-Code-X 的 Workspace-first 工作浏览入口。它从当前 `Conversation` 上方临时打开，以 `My-Code-X Workspace` 为一级组织方式，进入某个 Workspace 后展示该 Workspace 下的 `Thread` 列表。

Acceptance Criteria:

- Panel 覆盖在当前 `Conversation` 上方，而不是把页面改成左右两栏。
- Panel 打开时，当前 `Conversation` 作为弱化背景保留。
- Panel 必须提供关闭入口。
- Panel 以 `My-Code-X Workspace` 为一级入口。
- Panel 顶部展示 Workspace 列表。
- Panel 底部 action bar 提供新增 Workspace 的入口。
- 每个 Workspace pill 展示 Workspace 名称。
- 当前选中的 Workspace pill 必须有明显 selected 状态。
- Workspace pill 使用轻量状态点提示该 Workspace 内存在需关注的 `Thread`。
- 当前 Workspace header 必须展示 Workspace 名称和 canonical cwd。
- Panel 底部 action bar 必须提供编辑当前 Workspace 的入口。
- 当前 Workspace header 必须提供新增 `Thread` 的入口。

### Workspace thread browser

Description:

Workspace thread browser 在当前 Workspace 内展示 `Recent` 和 `History` 两段 `Thread` 列表。两段都使用简单时间倒序，避免额外状态分组和筛选心智。

Acceptance Criteria:

- 当前 Workspace 下的未归档 `Thread` 必须被分入 `Recent` 或 `History`。
- `Recent` 包含所有有状态的 `Thread`。
- 有状态的 `Thread` 包括 running、waiting、failed、interrupted 和 completed unread。
- completed unread 必须保持有状态，直到用户打开对应 `Thread`。
- `Recent` 还包含最近 24 小时内活跃过的 `Thread`。
- `History` 包含当前 Workspace 下未归档、且不属于 `Recent` 的 `Thread`。
- `Recent` 必须按 `lastActivityAt` 倒序排序。
- `History` 必须按 `lastActivityAt` 倒序排序。
- 已归档 `Thread` 不出现在 `Recent` 或 `History`。
- `Recent` 和 `History` 不提供状态分组。
- `Recent` 和 `History` 不提供常驻搜索框或 filter。

### Thread row

Description:

Thread row 是 `Thread` 在 Workspace panel 内的轻量展示。它用于快速识别任务内容、最近活动时间和基础状态，不承载复杂操作。

Acceptance Criteria:

- 每个 Thread row 必须展示状态点、`Thread` 标题、最近活动时间和 preview。
- Thread row 主体必须保持两行：标题行和 preview 行。
- 最近活动时间必须在 row 右侧右对齐。
- 状态文字不在 row 中显示。
- 状态通过左侧彩色点表达。
- 有状态的turn（比如unread）和普通 history 必须可以使用不同状态点表达。
- preview 超出可用宽度时必须单行省略。
- 点击 Thread row 必须切换到对应 `Thread` 的 `Conversation`。
- 点击 Thread row 不得 interrupt 正在运行的 `Turn`。

### Thread switching behavior

Description:

用户可以在多个 `Thread` 之间切换，以便在 long-running `Turn` 等待期间继续处理其他工作。

Acceptance Criteria:

- 用户切换到其他 `Thread` 时，当前 running `Turn` 必须继续运行。
- 切换 `Thread` 不触发 interrupt。
- running `Turn` 完成后，对应 `Thread` 进入 completed unread 状态。
- completed unread `Thread` 必须保留在 `Recent`。
- 用户打开 completed unread `Thread` 后，completed unread 状态清除。
- 当前版本不恢复每个 `Thread` 的阅读位置。
- 当前版本不保存每个 `Thread` 的输入草稿。

### Archive handling

Description:

当前版本不提供新的收束操作，复用已有 `thread archive` 能力让用户把不再关注的 `Thread` 从 `Recent` 和 `History` 中移除。

Acceptance Criteria:

- 已归档 `Thread` 不出现在 Workspace thread browser 的 `Recent` 中。
- 已归档 `Thread` 不出现在 Workspace thread browser 的 `History` 中。
- 当前 feature 不新增独立的 Later、Dismiss、Mark done 或 Hide from Recent 操作。
- 如需恢复归档 `Thread`，走已有 archive 相关入口，不在当前 feature 中新增恢复 UI。

## Out of Scope

- 跨 Workspace 的 Active Work dashboard。
- Workspace 聚合摘要，例如每个 Workspace 的 running、failed、waiting 数量。
- 常驻搜索框和 filter。
- 按状态分组的列表，例如 Needs Attention、Running。
- workflow tag，例如 planning、testing。
- 显式比较模式或 sibling thread 关系。
- 高优先级打断模式。
- `Turn` 级状态细节展示。
- 每个 `Thread` 的阅读位置恢复。
- 每个 `Thread` 的输入草稿保存。
- 新增 Later、Dismiss、Mark read、Mark done 或 Hide from Recent 操作。
- 针对 bug、review、PR、客户项目或协作进度的专门定位功能。

## Future Plans

- background thread的提醒方案等主页方案确定后再设计；暂定方向是主页提示、toast 和非活跃态浏览器通知。
- `Turn` 状态相关接入完成后，再设计turn状态的更精确展示。
- 输入模块完成后，再评估是否需要 per-thread input draft。

## UI

Mock file: [multi-active-work-UImock.html](./multi-active-work-UImock.html)

当前 mock 展示手机端 Workspace panel overlay：当前 `Conversation` 作为弱化背景铺底，Workspace panel 从左侧覆盖在上层。Workspace 列表只展示 Workspace；当前 Workspace header 提供新增 `Thread` 入口；底部 action bar 提供新增 Workspace 和编辑当前 Workspace 入口；`Thread` 列表只保留 `Recent` 和 `History`，每个 row 用状态点、标题、右对齐时间和 preview 表达。
