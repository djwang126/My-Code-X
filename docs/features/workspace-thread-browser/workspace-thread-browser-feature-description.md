# Feature-Workspace Thread Browser

`Workspace Thread Browser` 让用户在手机端按 `My-Code-X Workspace` 查看、切换、整理和恢复 Codex `Thread`。它以 Workspace 为一级入口，在不引入独立 Active work 对象的前提下，帮助用户在 long-running `Turn` 等待期间继续处理其他工作，并快速找回需要关注的 `Thread`。

## Feature Capabilities

### Workspace registry and identity

`My-Code-X Workspace` 是用户保存的本机项目目录。Workspace 的产品身份是 canonical cwd；Workspace name 只用于手机端识别，不改变 Workspace identity。

Functional Requirements:

- Workspace 由用户手动添加。
- Workspace identity 使用 canonical cwd。
- 同一个 canonical cwd 只对应一个 Workspace。
- Workspace name 只作为显示字段，修改 name 不改变 Workspace identity。
- 添加 Workspace 时，空 name 默认使用目录名称；后续编辑时 name 可以保存为空字符串。
- Workspace 列表保持稳定顺序展示。
- Workspace registry 不保存 `Thread` 列表，也不保存 `Thread` 的 UI 状态。
- 添加或编辑 Workspace cwd 时，校验路径是否为空、是否为绝对路径、是否存在、是否为可访问目录，以及是否重复。
- 编辑 Workspace cwd 成功后保留原 Workspace name。
- 编辑 Workspace cwd 不迁移旧 cwd 下的 Codex `Thread`。

UX Decisions:

- Workspace pill 展示 Workspace name。
- Workspace header 展示 Workspace name 和 canonical cwd。
- canonical cwd 在手机端使用单行省略，避免路径撑破布局。
- UI 以目录路径解释 Workspace identity，不暗示 name 是唯一标识。

### Workspace availability

Workspace availability 表达已保存 Workspace 当前是否还能作为 Codex 工作目录使用。不可用 Workspace 仍保留在列表中，让用户知道这个 Workspace 曾经存在过。

Functional Requirements:

- 不可用 Workspace 仍展示在 Workspace 列表中，并带有不可用状态和可理解原因。
- 不可用 Workspace 不进入 `Thread` 列表。
- 不可用 Workspace 可以从 My-Code-X registry 中移除。
- 移除 Workspace 只删除 My-Code-X 的 Workspace 记录，不删除本机项目目录或 Codex `Thread`。

UX Decisions:

- 移除 Workspace 需要用户确认。
- 移除确认在 Edit workspace modal 中完成。
- 移除入口文案避免暗示会删除本机目录或 Codex `Thread`。
- 移除确认说明 local files 和 Codex threads 会保留。

### Workspace panel overlay

Workspace panel overlay 是 Workspace-first 的工作浏览入口。它从当前 `Conversation` 上方临时打开，以 `My-Code-X Workspace` 为一级组织方式，进入某个 Workspace 后展示该 Workspace 下的 `Thread` 列表。

Functional Requirements:

- Panel 覆盖在当前 `Conversation` 上方，而不是把页面改成左右两栏。
- Panel 打开时，当前 `Conversation` 作为弱化背景保留。
- Panel 提供关闭入口。
- Panel 顶部展示 Workspace 列表。
- 当前 Workspace header 展示 Workspace name 和 canonical cwd。
- 当前 Workspace header 提供 archived mode toggle 和 New thread 入口。
- Panel 底部 action bar 提供 Add workspace 和 Edit workspace 入口。

UX Decisions:

- 手机端 panel 从左侧覆盖，宽度接近手机主视口；窄屏下可以占满宽度。
- 背景 `Conversation` 只作为弱化上下文，不表达 Workspace browser 的产品决策。
- Workspace 列表使用横向 workspace strip 和 pill 形式。
- 当前选中的 Workspace pill 使用 selected 状态。
- Workspace pill 使用轻量状态点提示该 Workspace 内存在需关注的 `Thread`。
- Workspace pill 状态点的具体状态映射和优先级待设计。
- 底部 action bar 固定展示 Add workspace 和 Edit workspace，减少管理入口查找成本。

### Workspace management UI

用户可以从 Workspace panel 轻量管理 Workspace。新增 Workspace 和编辑当前 Workspace 都从底部 action bar 进入；编辑当前 Workspace 使用 app-level modal，不替换当前 Workspace thread browser。

Functional Requirements:

- Add workspace 入口用于新增 Workspace。
- Edit workspace 入口用于编辑当前 Workspace。
- Edit workspace modal 展示当前 Workspace name 和 cwd。
- Edit workspace modal 支持保存当前 Workspace 设置。
- Edit workspace modal 支持移除当前 Workspace。
- 点击 Edit workspace modal 外部区域可以关闭 modal；提交中的操作除外。

UX Decisions:

- Edit workspace 使用 app-level modal 覆盖整个 app，而不是嵌在 Workspace panel 内。
- modal 中字段使用 `Name` 和 `Path`。
- 保存入口文案为 `Save changes`。
- 移除区域以 `Remove from My-Code-X` 表达只移除 My-Code-X 记录。
- 移除确认提供 Keep 和 Remove 两个操作。

### New thread

用户可以从当前 Workspace 快速开始一个新的 `Thread`，让新增工作明确归属于当前 Workspace cwd。

Functional Requirements:

- New thread 使用当前 Workspace 的 canonical cwd。
- New thread 不改变其他 Workspace 的 `Thread` 列表。
- New thread 成功后，主 `Conversation` 切换到新 `Thread`。
- New thread 失败后，Panel 保持打开并展示错误。

UX Decisions:

- New thread 入口放在当前 Workspace header 的右侧 action 区。
- New thread 是当前 Workspace 作用域内的操作，不放在全局底部 action bar。

### Workspace panel initial route

打开 Workspace panel 时，My-Code-X 根据当前 `Conversation` 的 Workspace scope 决定默认展示位置，让用户从当前上下文自然进入相关 Workspace。

Functional Requirements:

- 当前 `Conversation` scope 对应已保存且可用 Workspace 时，Panel 默认展示该 Workspace 的 `Thread` 列表。
- 当前 `Conversation` scope 不存在、未保存或不可用时，Panel 默认展示 Workspace 列表。
- 未保存的 cwd 不临时当作 Workspace。
- 关闭 Panel 后清除本次 Panel 会话选中的 Workspace。
- 下次打开 Panel 时，重新按当前 `Conversation` scope 判断默认展示位置。

UX Decisions:

- Panel 不保存上一次临时选择，避免用户误以为当前 `Conversation` 已切换 Workspace。
- 默认 route 优先服务当前上下文，而不是最近打开过的 Workspace。

### Workspace thread lists

Workspace thread browser 在当前 Workspace 内展示 `Recent` 和 `History` 两段未归档 `Thread` 列表。两段都使用简单时间倒序，避免额外状态分组和筛选心智。

Functional Requirements:

- 当前 Workspace 下的未归档 `Thread` 被分入 `Recent` 或 `History`。
- `Recent` 包含所有有状态的 `Thread`，以及最近 24 小时内活跃过的 `Thread`。
- 有状态的 `Thread` 包括 running、waiting、failed、interrupted 和 completed unread。
- completed unread 保持有状态，直到用户打开对应 `Thread`。
- `History` 包含当前 Workspace 下未归档、且不属于 `Recent` 的 `Thread`。
- `Recent` 和 `History` 都按 `lastActivityAt` 倒序排序。
- `Recent` 直接展示全部 items，不提供分页。
- `History` 支持分页，并在用户滚动接近 section 底部时自动加载下一页。
- `History` 加载失败时，在 section 底部显示 retry row；失败后不反复自动重试。
- `History` 加载失败不影响 `Recent`。
- 已归档 `Thread` 不出现在 `Recent` 或 `History`。
- `Recent` 和 `History` 不提供状态分组、常驻搜索框或 filter。

UX Decisions:

- `Recent` 在滚动顺序和视觉优先级上高于 `History`。
- `History` 不需要保证首屏可见。
- `History` 自动加载时不显示常态 load-more 按钮。
- `History` 自动加载中可以在 section 底部显示轻量 loading 状态。
- `History` 没有更多 items 时，可以不显示结束提示。
- `History` 分页 UI 不使用页码。
- `History` 首屏数量建议为 10 条，最终数量在实现时根据 Codex API、性能和交互约束确认。
- Section title 使用 `Recent` 和 `History`。

### Thread source and row display

Workspace thread browser 只展示 Codex app-server 返回的 `Thread`。My-Code-X 不从 Workspace registry 推断 `Thread`，也不为缺失字段编造展示内容。

Functional Requirements:

- `Thread` 列表来自 Codex app-server。
- `Thread` 列表使用当前 Workspace 的 canonical cwd 查询。
- `Thread` 列表保留 Codex 返回的 `Thread` identity。
- `Thread` title 来自 Codex 返回的 name。
- `Thread` preview 来自 Codex 返回的 preview。
- `Thread` 最近活动时间来自 Codex 返回的时间字段或其产品化投影。
- `Thread` name 为空时，title 区域保持为空。
- `Thread` preview 为空时，preview 区域保持为空。
- `Thread` 时间缺失或不可展示时，不发明时间。
- 已归档 `Thread` 不出现在 active thread lists 中。

UX Decisions:

- 每个 Thread row 展示状态点、title、右对齐最近活动时间和 preview。
- Thread row 主体保持两行：title 行和 preview 行。
- preview 超出可用宽度时单行省略。
- 状态文字不在 row 中显示。
- 状态通过左侧彩色点表达。
- running、waiting、failed、completed unread 和普通 history 可以用不同状态点表达。
- 当前 `Conversation` 正在显示的 `Thread` 使用 row selected 状态高亮。
- Thread row 的主点击区域和更多操作按钮分离。

### Thread switching behavior

用户可以在多个 `Thread` 之间切换，以便在 long-running `Turn` 等待期间继续处理其他工作。

Functional Requirements:

- 点击 Thread row 切换到对应 `Thread` 的 `Conversation`。
- 点击 Thread row 不 interrupt 正在运行的 `Turn`。
- 用户切换到其他 `Thread` 时，当前 running `Turn` 继续运行。
- 切换 `Thread` 不触发 interrupt。
- 点击当前 `Conversation` 正在显示的 `Thread` 时，不重复恢复该 `Thread`。
- 点击其他 `Thread` 后，主 `Conversation` 切换到目标 `Thread`。
- `Thread` 切换成功后，Panel 关闭。
- `Thread` 切换失败后，Panel 保持打开，并在对应 Thread row 展示错误。
- running `Turn` 完成后，对应 `Thread` 进入 completed unread 状态。
- 用户打开 completed unread `Thread` 后，completed unread 状态清除。
- 当前版本不恢复每个 `Thread` 的阅读位置。
- 当前版本不保存每个 `Thread` 的输入草稿。

UX Decisions:

- Thread switching 是轻量导航，不弹出确认。
- completed unread 继续留在 `Recent`，直到用户打开该 `Thread`。
- 切换失败的错误贴近对应 row 展示，避免清空整个 panel。

### Thread actions

用户可以在 Workspace thread browser 中整理 `Thread`。Thread row 使用轻量操作菜单承载 rename 和 archive。

Functional Requirements:

- Workspace thread browser 支持 rename `Thread`。
- rename `Thread` 允许空名称。
- rename `Thread` 成功后，对应 Thread row 显示新名称。
- rename `Thread` 失败后，Panel 保持打开并展示错误。
- Workspace thread browser 支持 archive `Thread`。
- archive `Thread` 不需要确认。
- archive `Thread` 成功后，该 `Thread` 从 `Recent` 和 `History` 中移除。
- archive `Thread` 不删除 Codex `Thread`。
- archive 当前 `Conversation` 正在显示的 `Thread` 后，主 `Conversation` 进入无 `Thread` 选中状态。
- archive `Thread` 失败后，Panel 保持打开并展示错误。
- rename 和 archive 从 Thread row 的轻量操作菜单进入。

UX Decisions:

- Thread row 右侧使用 more button 打开 row menu。
- row menu 提供 `Rename` 和 `Archive`。
- rename 使用轻量 rename popover 编辑，不使用整屏 modal。
- rename popover 包含 `Thread name` input 和 `Save` action。
- archive action 在 row menu 中使用 danger 视觉。
- Thread row 操作菜单不使用整屏弹窗或 bottom sheet。

### Archived mode and restore

用户可以在当前 Workspace 内查看已归档的 `Thread`，并恢复需要重新关注的 `Thread`。

Functional Requirements:

- 当前 Workspace 提供查看 archived `Thread` 的能力。
- archived `Thread` 作为当前 Workspace browser 的 archived mode 展示。
- archived mode 复用当前 Workspace header、canonical cwd 和 header actions。
- archived mode 通过 header 中的 archived 入口切换，不需要返回按钮。
- archived `Thread` 列表只展示当前 Workspace 下的已归档 `Thread`。
- archived `Thread` 列表支持分页。
- archived `Thread` 不直接切换主 `Conversation`。
- archived `Thread` 支持 restore。
- restore 操作不需要确认。
- restore 成功后，该 `Thread` 可以重新出现在当前 Workspace 的未归档 `Thread` 浏览范围中。
- 当前 feature 不新增独立的 Later、Dismiss、Mark done 或 Hide from Recent 操作。

UX Decisions:

- archived mode 的 section title 使用 `Archived`。
- archived Thread row 复用 title、time、preview 的基础布局。
- restore 操作直接展示在 archived Thread row 右侧。
- archived toggle 位于 Workspace header action 区，和 New thread 并列。

### Panel state and errors

Workspace panel 的 loading、empty 和 error 都在 panel 内表达，避免打断当前 `Conversation`。

Functional Requirements:

- Workspace 列表加载中展示 loading 状态。
- Workspace 列表为空时展示 empty 状态和新增 Workspace 入口。
- Workspace 列表加载失败时展示 failed 状态。
- Workspace `Thread` 列表加载中展示 loading 状态。
- Workspace `Thread` 列表为空时展示 empty 状态。
- Workspace `Thread` 列表加载失败时展示 failed 状态和返回 Workspace 列表的入口。
- 空列表不伪装成加载失败。
- 单个 Thread row 的操作错误展示在对应 row 上。
- Panel 内错误不清空当前 `Conversation`。
- 存在提交中的表单或 modal 时，Panel 不被外部点击关闭。

UX Decisions:

- 错误优先在发生位置附近展示。
- Panel 内状态变化不影响背景 `Conversation`。
- modal 或提交中状态存在时，外部点击关闭行为被禁用，避免丢失用户操作。

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
- 背景 `Conversation` preview 的具体内容设计。

## Future Plans

- background thread 的提醒方案等主页方案确定后再设计；暂定方向是主页提示、toast 和非活跃态浏览器通知。
- `Turn` 状态相关接入完成后，再设计 turn 状态的更精确展示。
- 输入模块完成后，再评估是否需要 per-thread input draft。
- Workspace pill 状态点映射和优先级后续单独确认。

## Reference

[workspace-thread-browser-UImock.html](./workspace-thread-browser-UImock.html) UImock只体现界面样式与布局，不代表任何代码设计，领域定义，以及实现细节。
