# Feature-Workspace Thread Browser

`Workspace Thread Browser` 让用户在一个 Workspace-first 的手机端 panel 中查看、切换、整理和恢复当前 Workspace 下的 Codex `Thread`。当前设计不引入独立的 Active work 对象；`Recent` 只是 `Thread list` 中仍有状态或近期活跃的 `Thread`。

## Feature specification

### Workspace identity

Description:

`My-Code-X Workspace` 是用户保存的本机项目目录。Workspace 的产品身份是 canonical cwd；Workspace 名称只用于手机端识别，不改变 Workspace identity。

Acceptance Criteria:

- Workspace 必须由用户手动添加。
- Workspace identity 必须使用 canonical cwd。
- 同一个 canonical cwd 最多只能存在一个 Workspace。
- Workspace 名称只作为显示字段。
- 修改 Workspace 名称不得改变 Workspace identity。
- 添加 Workspace 时，空名称默认使用目录名称。
- 后续编辑 Workspace 时，名称可以保存为空字符串。
- Workspace 列表必须保持稳定顺序展示。
- Workspace 不保存 `Thread` 列表。
- Workspace 不保存 `Thread` 的 UI 状态。

### Workspace path handling

Description:

添加或编辑 Workspace cwd 时，My-Code-X 只接受可作为 Codex 工作目录使用的本机目录，并阻止重复 Workspace。

Acceptance Criteria:

- 添加 Workspace 时，cwd 必须去掉首尾空白。
- cwd 为空或去掉首尾空白后为空时，必须显示错误。
- cwd 不是绝对路径时，必须显示错误。
- cwd 不存在时，必须显示错误。
- cwd 不是目录时，必须显示错误。
- cwd 不可访问时，必须显示错误。
- cwd 与已有 Workspace 指向同一目录时，必须显示重复错误。
- 编辑当前 Workspace cwd 时，必须使用与添加 Workspace 相同的路径规则。
- 编辑 Workspace cwd 成功后，Workspace 名称必须保持不变。
- 编辑 Workspace cwd 不表示迁移旧 cwd 下的 Codex `Thread`。

### Workspace availability

Description:

Workspace availability 表达已保存 Workspace 当前是否还能作为 Codex 工作目录使用。不可用 Workspace 仍保留在列表中，让用户知道这个 Workspace 曾经存在过。

Acceptance Criteria:

- 不可用 Workspace 必须仍展示在 Workspace 列表中。
- 不可用 Workspace 必须展示不可用状态。
- 不可用 Workspace 必须提供可理解的不可用原因。
- 不可用 Workspace 不得进入 `Thread` 列表。
- 不可用 Workspace 只能被移除。
- 移除 Workspace 必须要求用户确认。
- 移除 Workspace 确认必须在 Edit workspace modal 中完成。
- 移除 Workspace 只删除 My-Code-X 的 Workspace 记录。
- 移除 Workspace 不得删除本机项目目录。
- 移除 Workspace 不得删除 Codex `Thread`。

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
- Workspace pill 状态点的具体状态映射和优先级待设计。
- 当前 Workspace header 必须展示 Workspace 名称和 canonical cwd。
- Panel 底部 action bar 必须提供编辑当前 Workspace 的入口。
- 当前 Workspace header 必须提供新增 `Thread` 的入口。

### Workspace management UI

Description:

Workspace 管理入口保持轻量。新增 Workspace 和编辑当前 Workspace 都从 Workspace panel 的底部 action bar 进入；编辑当前 Workspace 使用 app-level modal，不替换当前 Workspace thread browser。

Acceptance Criteria:

- Panel 底部 action bar 的新增入口必须明确表达 Add workspace。
- Panel 底部 action bar 的编辑入口必须明确表达 Edit workspace。
- Edit workspace 必须以 app-level modal 形式打开。
- Edit workspace modal 必须覆盖整个 app，而不是嵌在 Workspace panel 内。
- Edit workspace modal 必须展示当前 Workspace name 和 cwd。
- Edit workspace modal 必须提供保存入口。
- Edit workspace modal 必须提供移除当前 Workspace 的入口。
- 移除 Workspace 的入口文案不得暗示会删除本机目录或 Codex `Thread`。
- 移除 Workspace 确认必须说明本机文件和 Codex `Thread` 会保留。
- 点击 Edit workspace modal 外部区域可以关闭 modal，除非存在提交中的操作。

### New thread

Description:

用户可以从当前 Workspace 快速开始一个新的 `Thread`，让新增工作明确归属于当前 Workspace cwd。

Acceptance Criteria:

- 当前 Workspace header 必须提供新增 `Thread` 的入口。
- 新增 `Thread` 必须使用当前 Workspace 的 canonical cwd。
- 新增 `Thread` 不得改变其他 Workspace 的 `Thread` 列表。
- 新增 `Thread` 成功后，主 `Conversation` 必须切换到新 `Thread`。
- 新增 `Thread` 失败后，Panel 必须保持打开并展示错误。

### Workspace panel initial route

Description:

打开 Workspace panel 时，My-Code-X 根据当前 `Conversation` 的 Workspace scope 决定默认展示位置，让用户从当前上下文自然进入相关 Workspace。

Acceptance Criteria:

- 当前 `Conversation` scope 对应已保存且可用 Workspace 时，Panel 默认展示该 Workspace 的 `Thread` 列表。
- 当前 `Conversation` scope 不存在、未保存或不可用时，Panel 默认展示 Workspace 列表。
- 未保存的 cwd 不得被临时当作 Workspace。
- 关闭 Panel 后，本次 Panel 会话选中的 Workspace 必须清除。
- 下次打开 Panel 时，必须重新按当前 `Conversation` scope 判断默认展示位置。

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
- `Recent` 必须直接展示全部 items，不提供分页。
- `History` 必须支持分页。
- `Recent` 在滚动顺序和视觉优先级上必须高于 `History`。
- `History` 不需要保证首屏可见。
- `History` 必须在用户滚动接近 section 底部时自动加载下一页。
- `History` 自动加载时不得显示常态 load-more 按钮。
- `History` 自动加载中可以在 section 底部显示轻量 loading 状态。
- `History` 加载失败时，必须在 section 底部显示 retry row。
- `History` 加载失败后不得反复自动重试。
- `History` 加载失败不得影响 `Recent`。
- `History` 没有更多 items 时，可以不显示结束提示。
- `History` 分页 UI 不使用页码。
- `History` 分页 UI 不使用全局 load more。
- 已归档 `Thread` 不出现在 `Recent` 或 `History`。
- `Recent` 和 `History` 不提供状态分组。
- `Recent` 和 `History` 不提供常驻搜索框或 filter。

Design Notes:

- `History` 首屏数量建议为 10 条。
- `History` 首屏数量和每页数量最终在实现时根据 Codex API、性能和交互约束确认。

### Thread source and fields

Description:

Workspace thread browser 只展示 Codex app-server 返回的 `Thread`。My-Code-X 不从 Workspace registry 推断 `Thread`，也不为缺失字段编造展示内容。

Acceptance Criteria:

- `Thread` 列表必须来自 Codex app-server。
- `Thread` 列表必须使用当前 Workspace 的 canonical cwd 查询。
- `Thread` 列表必须保留 Codex 返回的 `Thread` identity。
- `Thread` 标题必须来自 Codex 返回的 name。
- `Thread` preview 必须来自 Codex 返回的 preview。
- `Thread` 最近活动时间必须来自 Codex 返回的时间字段或其产品化投影。
- `Thread` name 为空时，标题区域必须保持为空。
- `Thread` preview 为空时，preview 区域必须保持为空。
- `Thread` 时间缺失或不可展示时，不得发明时间。
- 已归档 `Thread` 不得出现在 Workspace thread browser 中。

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
- 当前 `Conversation` 正在显示的 `Thread` 必须在列表中高亮。
- 点击当前 `Conversation` 正在显示的 `Thread` 不得重复恢复该 `Thread`。
- 点击其他 `Thread` 后，主 `Conversation` 必须切换到目标 `Thread`。
- `Thread` 切换成功后，Panel 必须关闭。
- `Thread` 切换失败后，Panel 必须保持打开，并在对应 Thread row 展示错误。
- running `Turn` 完成后，对应 `Thread` 进入 completed unread 状态。
- completed unread `Thread` 必须保留在 `Recent`。
- 用户打开 completed unread `Thread` 后，completed unread 状态清除。
- 当前版本不恢复每个 `Thread` 的阅读位置。
- 当前版本不保存每个 `Thread` 的输入草稿。

### Thread actions

Description:

用户可以在 Workspace thread browser 中整理 `Thread`。Thread row 使用轻量操作菜单承载 rename 和 archive。

Acceptance Criteria:

- Workspace thread browser 必须支持 rename `Thread`。
- rename `Thread` 必须允许空名称。
- rename `Thread` 必须通过轻量 rename popover 编辑。
- rename `Thread` 成功后，对应 Thread row 必须显示新名称。
- rename `Thread` 失败后，Panel 必须保持打开并展示错误。
- Workspace thread browser 必须支持 archive `Thread`。
- archive `Thread` 不需要确认。
- archive `Thread` 成功后，该 `Thread` 不得继续出现在 `Recent` 或 `History`。
- archive `Thread` 不得删除 Codex `Thread`。
- archive 当前 `Conversation` 正在显示的 `Thread` 后，主 `Conversation` 必须进入无 `Thread` 选中状态。
- archive `Thread` 失败后，Panel 必须保持打开并展示错误。
- rename 和 archive 必须从 Thread row 的轻量操作菜单进入。
- Thread row 操作菜单不得使用整屏弹窗或 bottom sheet。

### Panel state and errors

Description:

Workspace panel 的加载、空状态和错误都在 panel 内表达，避免打断当前 `Conversation`。

Acceptance Criteria:

- Workspace 列表加载中必须展示 loading 状态。
- Workspace 列表为空时必须展示 empty 状态和新增 Workspace 入口。
- Workspace 列表加载失败时必须展示 failed 状态。
- Workspace `Thread` 列表加载中必须展示 loading 状态。
- Workspace `Thread` 列表为空时必须展示 empty 状态。
- Workspace `Thread` 列表加载失败时必须展示 failed 状态和返回 Workspace 列表的入口。
- 空列表不得伪装成加载失败。
- 单个 Thread row 的操作错误必须展示在对应 row 上。
- Panel 内错误不得清空当前 `Conversation`。
- 存在提交中的表单或 modal 时，Panel 不得被外部点击关闭。

### Archive handling

Description:

用户可以在当前 Workspace 内查看已归档的 `Thread`，并恢复需要重新关注的 `Thread`。

Acceptance Criteria:

- 已归档 `Thread` 不出现在 Workspace thread browser 的 `Recent` 中。
- 已归档 `Thread` 不出现在 Workspace thread browser 的 `History` 中。
- 当前 Workspace 必须提供查看 archived `Thread` 的能力。
- archived `Thread` 必须作为当前 Workspace browser 的 archived mode 展示。
- archived mode 必须复用当前 Workspace header、canonical cwd 和 header actions。
- archived mode 通过 header 中的 archived 入口切换，不需要返回按钮。
- archived `Thread` 列表必须只展示当前 Workspace 下的已归档 `Thread`。
- archived `Thread` 列表必须支持分页。
- archived `Thread` 不得直接切换主 `Conversation`。
- archived `Thread` 必须支持恢复。
- restore 操作必须直接展示在 archived Thread row 右侧。
- restore 操作不需要确认。
- 恢复成功后，该 `Thread` 可以重新出现在当前 Workspace 的未归档 `Thread` 浏览范围中。
- 当前 feature 不新增独立的 Later、Dismiss、Mark done 或 Hide from Recent 操作。

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

Mock file: [workspace-thread-browser-UImock.html](./workspace-thread-browser-UImock.html)

当前 mock 展示手机端 Workspace panel overlay：当前 `Conversation` 作为弱化背景铺底，Workspace panel 从左侧覆盖在上层。Workspace 列表只展示 Workspace；当前 Workspace header 提供 archived mode toggle 和新增 `Thread` 入口；底部 action bar 提供 Add workspace 和 Edit workspace 入口；`Thread` 列表在 active mode 下展示 `Recent` 和 `History`，在 archived mode 下展示 `Archived`，每个 row 用状态点、标题、右对齐时间和 preview 表达。Thread row 操作使用轻量 row menu；rename 使用轻量 popover；Edit workspace 使用覆盖整个 app 的 modal；背景 `Conversation` 内容只是占位，不表达产品决策。

待设计 UI：Workspace pill 状态点映射。
