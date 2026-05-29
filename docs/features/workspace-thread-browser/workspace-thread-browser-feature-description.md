# Feature-Workspace Thread Browser

`Workspace Thread Browser` 让用户在手机端按 `My-Code-X Workspace` 查看、切换、整理和恢复 agent CLI `Thread`。它以 Workspace 为一级入口，在不引入独立 Active work 对象的前提下，帮助用户在 long-running `Turn` 等待期间继续处理其他工作，并快速找回需要关注的 `Thread`。

## Feature Capabilities

### Workspace registry and identity

用户可以保存、识别、编辑和移除 `My-Code-X Workspace`。`My-Code-X Workspace` 是用户保存的本机项目目录，产品身份是 canonical cwd。

Functional Requirements:

- Workspace 由用户手动添加。
- Workspace identity 使用 canonical cwd。
- 同一个 canonical cwd 只对应一个 Workspace。
- 展示 Workspace name 作为别名，修改 name 不改变 Workspace identity。
- 添加 Workspace 时，空 name 时默认使用目录名称；后续编辑时 name 也不可以保存为空字符串。
- Workspace 列表保持稳定顺序展示。 
- 添加或编辑 Workspace cwd 时，需要校验路径是否为空、是否为绝对路径、是否存在、是否为可访问目录，以及是否重复。
- 编辑 Workspace cwd 成功后保留原 Workspace name。
- 编辑 Workspace cwd 不触碰旧 cwd 下的 Codex `Thread`。
- 不可用 Workspace 仍展示在 Workspace 列表中，并带有不可用状态和可理解原因。
- 不可用 Workspace 无法进入其 `Thread` 列表。
- 不可用 Workspace 可以移除。
- 移除 Workspace 只删除 My-Code-X 的 Workspace 记录，不删除本机项目目录或 Codex `Thread`。

UX Decisions:

- Workspace 列表与当前 Workspace 区域都应帮助用户识别 Workspace name 和 canonical cwd。
- canonical cwd 在手机端展示时不应破坏布局。
- UI 以目录路径解释 Workspace identity。
- Workspace name 和 cwd 的编辑字段应清晰表达显示名和目录路径的区别。
- 移除 Workspace 需要用户确认。

### Workspace-scoped thread browsing

用户可以在某个 `My-Code-X Workspace` 的 Codex cwd scope 中查看 Codex app-server 返回的 `Thread`。Workspace thread browser 不从 Workspace registry 推断 `Thread`，也不为缺失字段编造展示内容。

Functional Requirements:

- 打开 Workspace thread browser 时，当前 `Conversation` scope 对应已保存且可用 Workspace 时，默认打开对应 Workspace 并展示该 Workspace 的 `Thread` 列表。
- 当前 `Conversation` scope 不存在、未保存或不可用时，默认只展示 Workspace 列表。
- `Thread` 列表来自 Codex app-server。
- `Thread` 列表使用当前 Workspace 的 canonical cwd 查询。
- `Thread` 列表保留 Codex 返回的 `Thread` identity。
- 当前 Workspace 下的未归档 `Thread` 才在thread列表中显示
- 未归档 `Thread`被分入 `Recent` 或 `History`。
- `Recent` 包含所有有状态的 `Thread`，以及最近 24 小时内活跃过的 `Thread`。
- 有状态的 `Thread` 包括` 等待交互` 和` 未读` 。
- 未读状态保持到用户打开对应 `Thread`。
- `History` 包含当前 Workspace 下未归档、且不属于 `Recent` 的 `Thread`。
- `Recent` 直接展示全部 items，不提供分页。
- `History` 支持分页。
- 已归档 `Thread` 不出现在 `Recent` 或 `History`。
- `Recent` 和 `History` 不提供状态分组、常驻搜索框或 filter。
- `History` 分页数量由实现根据 Codex API、性能和移动端体验确认。
- `Recent` 和 `History` 都按最近活动时间倒序排序。

UX Decisions:

- 当前选中的 Workspace 需要有明确选中状态。
- Workspace 可以提示内部存在需关注的 `Thread`；具体状态映射和优先级待设计。
- 如果 `Recent` 太长，`History` 不需要保证首屏可见。
- `History` 分页交互应保持轻量，无交互，避免让用户做额外分页管理。
- `History` 自动加载中可以展示非阻塞 loading 状态。
- `History` 加载失败时，自动重试，反复超时后，不再重试，在 section 底部显示 retry row。
- Thread row 应展示 title、preview、最近活动时间和状态提示。
- title，preview和最近活动时间基于 codex 权威数据。
- 空字段不应被 My-Code-X 自创内容填充。
- running、waiting、failed、completed unread 和普通 history 通过状态提示区分。
- 当前 `Conversation` 正在显示的 `Thread` 需要有明确选中状态。
- Thread row 的切换操作和整理操作应避免误触。

### New thread

用户可以从当前 Workspace 快速开始一个新的 `Thread`，让新增工作明确归属于当前 Workspace cwd。

Functional Requirements:

- New thread 使用当前 Workspace 的 canonical cwd。
- New thread 不改变其他 Workspace 的 `Thread` 列表。
- New thread 成功后，主 `Conversation` 切换到新 `Thread`。
- New thread 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。

UX Decisions:

- New thread 是当前 Workspace 作用域内的操作，不应被理解为全局创建入口。

### Thread switching

用户可以在多个 `Thread` 之间切换，以便在 long-running `Turn` 等待期间继续处理其他工作。

Functional Requirements:

- 点击 Thread row 切换到对应 `Thread` 的 `Conversation`。
- 切换 `Thread`  不 interrupt 正在运行的 `Turn`。
- 点击当前 `Conversation` 正在显示的 `Thread` 时，不重复恢复该 `Thread`。
- 用户打开 completed unread `Thread` 后，completed unread 状态清除。
- 恢复每个 `Thread` 的阅读位置。
- 保存每个 `Thread` 的输入草稿。

UX Decisions:

- Thread switching 需要弹出确认。
- `Thread` 切换成功后，Workspace thread browser 自动关闭。
- `Thread` 切换失败后，Workspace thread browser 保持当前浏览上下文，并展示错误。

### Thread organization

用户可以在 Workspace thread browser 中整理 `Thread`。整理操作应保持轻量，不干扰 Thread 浏览和切换。

Functional Requirements:

- Workspace thread browser 支持 rename `Thread`。
- rename `Thread` 成功后，对应 Thread row 显示新名称。
- rename `Thread` 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。
- Workspace thread browser 支持通过 codex 接口对 `Thread` 执行 archive 操作。
- archive `Thread` 需要确认。
- archive `Thread` 成功后，该 `Thread` 从 `Recent` 和 `History` 中移除。
- 不可 archive 当前 `Conversation` 正在显示的 `Thread`。
- archive `Thread` 失败后，Workspace thread browser 保持当前浏览上下文并展示错误。

UX Decisions:

- rename 和 archive 从对应 Thread row 的轻量操作入口进入。

### Archived thread recovery

用户可以在当前 Workspace 内查看已归档的 `Thread`，并恢复需要重新关注的 `Thread`。

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
