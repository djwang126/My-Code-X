# Feature-Workspace Thread Browser

`Workspace Thread Browser` 让产品用户在手机端按 `My-Code-X Workspace` 查看、切换、整理和恢复 agent CLI `Thread`。它以 Workspace 为一级入口，帮助产品用户在 long-running `Turn` 等待期间继续处理其他工作，并快速找回需要关注的 `Thread`。

## Feature Capabilities

### Workspace registry and identity

产品用户可以保存、识别、编辑和移除 `My-Code-X Workspace`。`My-Code-X Workspace` 是产品用户保存的本机项目目录。

Functional Requirements:

- Workspace 由产品用户手动添加。
- Workspace identity 使用 canonical cwd。
- 展示 Workspace name 作为别名，修改 name 不改变 Workspace identity。
- 添加 Workspace 时，空 name 时默认使用当前文件夹名称；后续编辑时 name 不可以保存为空字符串。
- 添加或编辑 Workspace cwd 时，需要校验路径是否为空、是否为绝对路径、是否存在、是否为可访问目录，以及是否重复。
- 编辑 Workspace cwd 成功后保留原 Workspace name。
- 编辑 Workspace cwd 不触碰旧 cwd 下的 agent CLI `Thread`。
- 不可用 Workspace 仍展示在 Workspace 列表中，并带有不可用状态和可理解原因。
- 不可用 Workspace 无法进入其 `Thread` 列表。
- 不可用 Workspace 可以移除。
- 移除 Workspace 只删除 My-Code-X 的 Workspace 记录，不删除本机项目目录或 agent CLI `Thread`。

UX Decisions:

- canonical cwd 在手机端展示时不破坏布局。
- Workspace 列表按name首字母顺序展示。 
- 移除 Workspace 需要产品用户确认。

### Workspace-scoped thread browsing

产品用户可以在某个 `My-Code-X Workspace` 的 agent CLI cwd scope 中查看 agent CLI 返回的 `Thread`。Workspace thread browser 不从 Workspace registry 推断 `Thread`，也不为缺失字段编造展示内容。

Functional Requirements:

- 打开 Workspace thread browser 时，当前 `Conversation` 对应可用 Workspace 时，默认打开对应 Workspace 及其 `Thread` 列表。
- `Thread` 列表来自 agent CLI。
- `Thread` 列表使用当前 Workspace 的 canonical cwd 查询。
- `Thread` 列表保留 agent CLI 返回的 `Thread` identity。
- 当前 Workspace 下的未归档 `Thread` 才在thread列表中显示
- thread列表中，所有有状态的 `Thread`排序在最前，便于产品用户查看。
- thread列表中，有状态的 `Thread` 内部和其他 `Thread` 都按最近活动时间倒序排序。
- 有状态的 `Thread` 包括` 等待交互` 和` 未读` 。
- 未读状态保持到产品用户打开对应 `Thread`。
- thread列表支持分页。
- thread列表不提供状态分组、常驻搜索框或 filter。
- thread列表分页数量由实现根据 agent CLI API、性能和移动端体验确认。

UX Decisions:

- 当前选中的 Workspace 需要有明确选中状态。
- Workspace 可以提示内部存在需关注的 `Thread`；具体状态映射和优先级待设计。
- thread列表分页交互应保持轻量，无交互，避免让产品用户做额外分页管理。
- thread列表自动加载中可以展示非阻塞 loading 状态。
- thread列表加载失败时，自动重试，反复超时后，不再重试，在 section 底部显示 retry row。
- Thread row 应展示 title、preview、最近活动时间和状态提示。
- title，preview和最近活动时间基于 agent CLI 权威数据。
- 空字段不应被 My-Code-X 自创内容填充。
- running、waiting、failed、completed unread 和普通 history 通过状态提示区分。
- 当前 `Conversation` 正在显示的 `Thread` 需要有明确选中状态。
- Thread row 的切换操作和整理操作应避免误触。

### New thread

产品用户可以从当前 Workspace 快速开始一个新的 `Thread`，让新增工作明确归属于当前 Workspace cwd。

Functional Requirements:

- New thread 使用当前 Workspace 的 canonical cwd。
- New thread 不改变其他 Workspace 的 `Thread` 列表。
- New thread 成功后，主 `Conversation` 切换到新 `Thread`。
- New thread 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。

UX Decisions:

- New thread 是当前 Workspace 作用域内的操作，不应被理解为全局创建入口。

### Thread switching

产品用户可以在多个 `Thread` 之间切换，以便在 long-running `Turn` 等待期间继续处理其他工作。

Functional Requirements:

- 点击 Thread row 切换到对应 `Thread` 的 `Conversation`。
- 切换 `Thread`  不 interrupt 正在运行的 `Turn`。
- 点击当前 `Conversation` 正在显示的 `Thread` 时，不重复恢复该 `Thread`。
- 产品用户打开 completed unread `Thread` 后，completed unread 状态清除。
- 恢复每个 `Thread` 的阅读位置。
- 保存每个 `Thread` 的输入草稿。

UX Decisions:

- Thread switching 需要弹出确认。
- `Thread` 切换成功后，Workspace thread browser 自动关闭。
- `Thread` 切换失败后，Workspace thread browser 保持当前浏览上下文，并展示错误。

### Thread organization

产品用户可以在 Workspace thread browser 中整理 `Thread`。整理操作应保持轻量，不干扰 Thread 浏览和切换。

Functional Requirements:

- Workspace thread browser 支持 rename `Thread`。
- rename `Thread` 成功后，对应 Thread row 显示新名称。
- rename `Thread` 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。
- Workspace thread browser 支持通过 agent CLI 接口对 `Thread` 执行 archive 操作。
- archive `Thread` 需要确认。
- archive `Thread` 成功后，该 `Thread` 从 `Recent` 和 `History` 中移除。
- 不可 archive 当前 `Conversation` 正在显示的 `Thread`。
- archive `Thread` 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。

UX Decisions:

- rename 和 archive 从对应 Thread row 的轻量操作入口进入。

### Archived thread recovery

产品用户可以在当前 Workspace 内查看已归档的 `Thread`，并恢复需要重新关注的 `Thread`。如果对应agent Cli无此功能，则不降级，不显示相关交互。

Functional Requirements:

- 当前 Workspace 提供查看 archived `Thread` 的能力。
- archived `Thread` 列表复用当前 Workspace 的 identity 展示。
- archived `Thread` 列表只展示当前 Workspace 下的已归档 `Thread`。
- archived `Thread` 列表支持分页，规则同history。
- archived `Thread` 不直接切换主 `Conversation`。
- archived `Thread` 支持 restore。
- restore 操作不需要确认。

UX Decisions:

- archived Thread row 复用未归档 Thread 的基础阅读信息。

## Out of Scope

- Workspace 聚合摘要，例如每个 Workspace 的 running、failed、waiting 数量。
- 常驻搜索框和 filter。
- 按状态分组的列表，例如 Needs Attention、Running。

## Future Plans

- background thread 有交互需要时的提醒方案等主页方案确定后再设计；暂定方向是主页提示、toast 和非活跃态浏览器通知。
- `Turn` 状态相关接入完成后，再设计 turn 状态的更精确展示。
- 输入模块完成后，再评估是否需要 per-thread input draft。
- Workspace 状态提示的映射和优先级后续单独确认。

## Reference

[workspace-thread-browser-UImock.html](./workspace-thread-browser-UImock.html) UImock只体现界面样式与布局，不代表任何代码设计，领域定义，以及实现细节。
