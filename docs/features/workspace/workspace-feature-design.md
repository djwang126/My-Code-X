# Feature-Workspace

Workspace 是 My-Code-X 手机端侧边栏功能，用来管理本机项目目录，并按目录查看对应 Codex threads。

Conversation 是主页。Workspace 不是独立主页，不负责新建 thread，不负责发送消息，不负责 turn 操作，也不维护 Codex thread 的自定义语义。Workspace 只包装 cwd，并把 cwd 作为 Codex `thread/list`、`thread/resume`、`thread/archive`、`thread/unarchive`、`thread/name/set` 等接口的工作区边界。

本功能的核心原则是：Workspace 可以管理 My-Code-X 自己保存的 cwd 列表，但 thread 列表的显示字段、顺序、分页和可操作能力必须尊重 Codex app-server 的接口结果，不能在 Codex thread/list 之上发明额外 thread 语义。Workspace 可以显式使用 Codex `thread/list` 已提供的排序能力，但不得在 Codex 返回结果之上自行重排。

## 用户故事

1. 作为 My-Code-X 用户，我想手动添加一个本机项目目录作为 Workspace，这样我可以告诉 My-Code-X 这个目录是 Codex 对话的工作区。
2. 作为 My-Code-X 用户，我想在手机端侧边栏看到已添加的 Workspace 列表，这样我可以从不同项目目录之间切换。
3. 作为 My-Code-X 用户，我想 Workspace 对外以 canonical cwd 作为身份，这样同一个目录不会被重复添加成多个工作区。
4. 作为 My-Code-X 用户，我想给 Workspace 设置一个可选名称，这样侧边栏可以按我的习惯显示项目。
5. 作为 My-Code-X 用户，我想 Workspace 名称只是显示字段，不影响身份，这样我可以把名称改成任何内容，包括空字符串。
6. 作为 My-Code-X 用户，我想添加 Workspace 时如果不填名称，系统使用目录 basename 作为初始名称，这样新记录默认可读。
7. 作为 My-Code-X 用户，我想后续重命名 Workspace 时可以改成空字符串，这样显示名完全由我控制。
8. 作为 My-Code-X 用户，我想 Workspace cwd 输入时自动去掉首尾空白，这样复制路径时的误差不会导致添加失败。
9. 作为 My-Code-X 用户，我想 Workspace name 原样保存，不自动 trim，这样我输入什么显示名就保存什么显示名。
10. 作为 My-Code-X 用户，我想添加 Workspace 时校验 cwd 是存在的绝对目录，并且当前进程可以访问，这样不会添加一个无法使用的工作区。
11. 作为 My-Code-X 用户，我想编辑已保存 Workspace 的 cwd，这样我可以把一个工作区切换到另一个本机项目目录。
12. 作为 My-Code-X 用户，我想编辑 cwd 时使用和添加 Workspace 相同的路径校验、canonicalize 和重复检查，这样 Workspace 身份仍然清楚。
13. 作为 My-Code-X 用户，我想 cwd 编辑只是把该 Workspace 改到新的 canonical cwd，不自动猜测、修复、迁移或保留旧 cwd 身份，这样路径变化不会产生隐藏语义。
14. 作为 My-Code-X 用户，我想如果添加了重复 cwd，系统阻止新增并提示已存在，这样 Workspace 列表不会混乱。
15. 作为 My-Code-X 用户，我想添加 Workspace 成功后仍留在 Workspace 列表，这样我能确认记录已被添加。
16. 作为 My-Code-X 用户，我想 Workspace 列表按添加顺序展示，这样列表稳定且没有隐式排序变化。
17. 作为 My-Code-X 用户，我想打开侧边栏时检查 Workspace cwd 是否仍然可用，这样我能看出哪些目录已经移动、删除或不可访问。
18. 作为 My-Code-X 用户，我想 unavailable Workspace 仍显示在列表中，这样我知道曾经添加过这个目录。
19. 作为 My-Code-X 用户，我想 unavailable Workspace 只能移除，这样坏路径不会继续进入 thread 列表。
20. 作为 My-Code-X 用户，我想 remove Workspace 只移除 My-Code-X 记录，不删除本地目录和 Codex threads，这样误操作不会破坏项目和历史。
21. 作为 My-Code-X 用户，我想 remove Workspace 不需要确认，这样轻量管理不会被打断。
22. 作为 My-Code-X 用户，我想当前侧边栏会话选中的 Workspace 不能 remove，但可以 rename，这样当前侧边栏上下文不会被自己删除。
23. 作为 My-Code-X 用户，我想当前侧边栏会话选中的 Workspace 在 Workspace 列表中高亮，这样我知道本次侧边栏会话正在查看或最近进入哪个工作区。
24. 作为 My-Code-X 用户，我想从 Workspace 列表进入某个 Workspace 后看到该 cwd 下的 active threads，这样我能继续已有对话。
25. 作为 My-Code-X 用户，我想 active thread 列表完全来自 Codex `thread/list`，这样 My-Code-X 不会展示和 Codex 不一致的 thread。
26. 作为 My-Code-X 用户，我想 thread 列表展示 Codex 返回的 `name`、`preview`、`updatedAt`，这样我能识别历史对话。
27. 作为 My-Code-X 用户，我想 thread 字段为空时不要被 My-Code-X 兜底成自造文案，这样看到的内容保持来自 Codex。
28. 作为 My-Code-X 用户，我想 `updatedAt` 显示成手机友好的本地时间，这样我能读懂更新时间。
29. 作为 My-Code-X 用户，我想 thread 列表按 Codex `updated_at desc` 返回顺序展示，这样我优先看到最近更新的对话且 My-Code-X 不会自行重排历史。
30. 作为 My-Code-X 用户，我想 thread 列表一次加载 10 条，并能继续加载更多，这样手机端列表轻量但仍能查看更多历史。
31. 作为 My-Code-X 用户，我想加载更多失败时保留已有列表，并在加载更多位置看到错误，这样已加载内容不会丢失。
32. 作为 My-Code-X 用户，我想没有 active threads 时只看到空状态，不出现新建 thread 入口，这样 Workspace 功能边界保持清楚。
33. 作为 My-Code-X 用户，我想点击 active thread 时恢复这个 thread 并切换主 Conversation，这样我能继续阅读或使用该对话。
34. 作为 My-Code-X 用户，我想 resume 成功后侧边栏自动关闭，这样手机端主界面回到 Conversation。
35. 作为 My-Code-X 用户，我想 resume 失败时侧边栏保持打开，并在对应 thread 卡片显示错误，这样我知道哪个操作失败。
36. 作为 My-Code-X 用户，我想当前主界面正在显示的 active thread 在列表中高亮，这样我知道当前 Conversation 来自哪个 thread。
37. 作为 My-Code-X 用户，我想点击当前正在显示的 active thread 不响应，这样不会重复 resume 当前 thread。
38. 作为 My-Code-X 用户，我想在 active thread 的更多菜单中 rename thread，这样我能整理已有对话。
39. 作为 My-Code-X 用户，我想 thread rename 允许空字符串，并直接交给 Codex `thread/name/set`，这样 My-Code-X 不限制 Codex 的命名行为。
40. 作为 My-Code-X 用户，我想 thread rename 成功后当前卡片立即显示新 name，但列表不重排，这样反馈及时且顺序仍尊重原列表。
41. 作为 My-Code-X 用户，我想如果 rename 的是当前主 Conversation thread，Conversation 自己通过重新 resume 当前 thread 刷新标题或相关信息，这样 Workspace 不直接修改 Conversation 内部状态。
42. 作为 My-Code-X 用户，我想在 active thread 的更多菜单中 archive thread，这样我可以整理 active 列表。
43. 作为 My-Code-X 用户，我想 archive 不需要确认，因为 archived 页面可以 unarchive。
44. 作为 My-Code-X 用户，我想 archive 成功后当前列表保留该卡片、打“已归档”标记并禁用交互，这样当前操作结果不会突然消失。
45. 作为 My-Code-X 用户，我想“已归档”标记只在当前侧边栏会话中有效，不持久化为 thread 状态，这样 My-Code-X 不发明 Codex thread 状态。
46. 作为 My-Code-X 用户，我想 archive 当前主 Conversation thread 后，主 Conversation 进入空选择状态，这样不会继续显示一个已被我归档的当前对话。
47. 作为 My-Code-X 用户，我想通过小按钮打开当前 Workspace 的 archived thread 页面，这样 archived threads 和 active threads 分开管理。
48. 作为 My-Code-X 用户，我想 archived 页面调用 Codex `thread/list` 的 `archived=true`，这样 archived 列表也尊重 Codex。
49. 作为 My-Code-X 用户，我想 archived thread 只允许 unarchive，不允许 resume、rename 或 archive，这样 archived 页面语义单一。
50. 作为 My-Code-X 用户，我想 archived 页面没有数据时看到空状态，不出现其他操作。
51. 作为 My-Code-X 用户，我想 archived 页面不高亮当前 Conversation thread，这样不会暗示 archived thread 可直接打开。
52. 作为 My-Code-X 用户，我想 unarchive 成功后仍留在 archived 页面，卡片打“已恢复”标记并禁用交互，这样操作结果清楚且不自动跳转。
53. 作为 My-Code-X 用户，我想从 archived 返回 active 时重新拉 active thread list，这样能看到上游最新 active 结果。
54. 作为 My-Code-X 用户，我想 Workspace 相关加载和操作失败都在侧边栏内就地展示，这样不会打断主 Conversation。
55. 作为 My-Code-X 用户，我想侧边栏外 overlay 可以在没有提交中弹窗时关闭侧边栏，这样手机端抽屉行为自然且不会中断提交中的操作。
56. 作为 My-Code-X 用户，我想侧边栏 thread 列表顶部有返回或切换 Workspace 按钮，这样我能回到 Workspace 列表。
57. 作为 My-Code-X 用户，我想打开侧边栏时默认显示当前 Conversation scope 对应的已保存可用 Workspace thread 列表，否则显示 Workspace 列表，这样当前上下文优先但不承认未保存 cwd。
58. 作为 My-Code-X 用户，我想当前 Conversation 的 cwd 如果不在 Workspace 列表里，侧边栏仍显示 Workspace 列表，这样未保存 cwd 不会被临时当作 Workspace。
59. 作为 My-Code-X 用户，我想 URL 或 client scope 中的 workspace cwd 必须已经保存，Workspace 功能才承认它，这样 Workspace 管理边界清楚。
60. 作为 My-Code-X 用户，我想 Workspace 配置不可读、不可写或损坏时得到明确提示，这样我知道工作区管理是否能持久保存。
61. 作为 My-Code-X 用户，我想配置不可写或损坏时仍能进入内存模式临时使用 Workspace，这样当前运行不被完全阻塞。
62. 作为 My-Code-X 用户，我想内存模式明确提示本次变更不会持久保存，这样我不会误以为修改已保存。
63. 作为 My-Code-X 开发者，我希望 Workspace 数据存储在 My-Code-X 自己的数据目录 `~/.my-code-x`，这样它不污染仓库源码目录，也不混入 Codex 原生 `~/.codex` 数据。
64. 作为 My-Code-X 开发者，我希望 Workspace 持久化记录有内部稳定 `id`，这样 cwd 编辑和并发合并可以定位同一条记录。
65. 作为 My-Code-X 开发者，我希望内部 `id` 不成为用户可见的 Workspace 身份，也不替代 URL 或 client scope 中的 canonical cwd，这样产品语义仍然简单。
66. 作为 My-Code-X 开发者，我希望 Workspace 写入前读取最新文件，并优先按内部 `id` 修改目标记录，再完整写回，这样不同 Workspace 的并发修改尽量不互相覆盖。
67. 作为 My-Code-X 开发者，我希望同一 Workspace 并发修改时最后写入胜出，这样第一版并发规则简单。
68. 作为 My-Code-X 开发者，我希望 Workspace 不监听目录变化、不提供手动刷新、不做自动扫描，这样第一版边界保持简单。
69. 作为 My-Code-X 开发者，我希望“上次打开 Workspace”由未来 slot feature 处理，而不是本功能临时发明持久 UI 状态。

## 功能需求

### Workspace 身份与持久化

1. Workspace 的对外身份和业务身份必须是 canonical cwd。
2. 同一个 canonical cwd 只能存在一条 Workspace 记录。
3. Workspace 持久化记录必须包含 `id`、`cwd`、`name` 和 `createdAt`。
4. `id` 是 My-Code-X 内部稳定记录 id，只用于编辑、rename、remove 和并发合并定位，不得成为用户可见 Workspace 身份。
5. URL 或 client scope 中的 `workspaceId` 必须继续使用 canonical cwd，不得使用内部 `id`。
6. `cwd` 必须保存为当前系统下的 canonical absolute path。
7. `name` 只是显示字段，不能参与 Workspace 身份判断。
8. `createdAt` 只用于保留添加顺序或并发合并时的稳定顺序，不得用于最近打开排序。
9. Workspace cwd 可以编辑；编辑 cwd 成功后，该 Workspace 记录的对外身份必须变为新的 canonical cwd，内部 `id` 必须保持不变。
10. 编辑 cwd 不得保留旧 cwd 身份，不得维护旧 cwd 到新 cwd 的映射，也不得迁移 Codex threads。
11. Workspace 列表必须按添加顺序展示。
12. Workspace 功能不得保存 `lastOpenedAt` 或基于最近打开时间排序。
13. Workspace 数据必须存储在用户 home 下的 `.my-code-x` 数据目录。
14. Windows 下 `.my-code-x` 位于用户 home，例如 `C:\Users\<user>\.my-code-x`。
15. macOS 和 Linux 下 `.my-code-x` 位于 `~/.my-code-x`。
16. Workspace 数据不得存储在项目仓库目录中。
17. Workspace 数据不得写入 Codex 原生 `~/.codex`。
18. 如果 `.my-code-x` 目录不存在，服务端应在启动或首次写入时创建。
19. URL 或 client scope 中的 `workspaceId` 使用 canonical cwd，并进行 URL encode。
20. URL 或 client scope 暴露 cwd 是本地个人工具的可接受行为。
21. URL 或 client scope 不承诺可跨设备分享。
22. URL 或 client scope 中的 cwd 必须存在于已保存 Workspace 列表中，Workspace 功能才承认它。

### 添加 Workspace

1. 添加 Workspace 必须通过手动输入 cwd。
2. 添加表单必须支持可选输入 name。
3. cwd 输入必须先 trim 首尾空白，再进行校验和 canonicalize。
4. cwd 必须是绝对路径。
5. cwd 必须存在。
6. cwd 必须是目录。
7. 当前 My-Code-X 进程必须能访问 cwd。
8. cwd 校验失败时必须阻止添加，并展示具体失败原因。
9. cwd 校验和 canonicalize 必须考虑多平台路径差异。
10. Windows 必须支持盘符路径和 UNC 路径。
11. Windows 下重复判断必须处理路径大小写不敏感问题。
12. Linux 和 macOS 下重复判断必须基于当前文件系统 canonical path。
13. name 必须原样保存，不 trim。
14. 添加成功的 Workspace 必须生成新的内部稳定 `id`。
15. 添加成功的 Workspace 必须记录 `createdAt`，用于保留添加顺序。
16. 添加时如果 name 是完全空字符串，必须保存 cwd basename 作为初始 name。
17. 添加后用户 rename 成空字符串时，必须保存空字符串，不再 fallback basename。
18. 添加重复 canonical cwd 时不得新增记录，必须提示已存在。
19. 添加成功后侧边栏必须仍停留在 Workspace 列表。
20. 添加成功后不得立即调用 Codex `thread/list`。

### 编辑 Workspace cwd

1. Workspace cwd 编辑必须通过手动输入新的 cwd。
2. 新 cwd 输入必须先 trim 首尾空白，再进行校验和 canonicalize。
3. 新 cwd 必须满足添加 Workspace 的同一组路径规则：绝对路径、存在、是目录、当前进程可访问，并符合多平台 canonical path 处理规则。
4. 新 cwd canonicalize 后如果与其他已保存 Workspace 重复，必须阻止保存并提示已存在。
5. 编辑 cwd 成功后，必须用新的 canonical cwd 替换该 Workspace 记录的旧 cwd。
6. 编辑 cwd 成功后必须保留该 Workspace 的内部 `id` 和现有 name，不自动改成新 cwd basename。
7. 编辑 cwd 成功后不得立即调用 Codex `thread/list`，除非侧边栏当前正在查看该 Workspace 的 active thread 列表。
8. 如果侧边栏当前正在查看该 Workspace 的 active thread 列表，cwd 编辑成功后必须用新 cwd 重新调用 active `thread/list`。
9. Workspace cwd 编辑不得直接通知或修改主 Conversation；如果主 Conversation 仍引用旧 cwd，它只是不再被 Workspace 功能承认为已保存 Workspace scope。
10. Workspace cwd 编辑是普通记录编辑，不是修复流程；本版不提供自动修复、自动重新定位、旧路径迁移、候选路径推荐或旧 cwd 到新 cwd 的别名映射。

### Workspace 列表

1. Workspace 列表必须在侧边栏中展示。
2. 持久化模式下，侧边栏打开时必须重新读取 Workspace 持久化数据。
3. 侧边栏打开时必须检查每个 Workspace cwd 当前是否可用。
4. 内存模式下，侧边栏打开时必须使用当前内存 Workspace 状态，不得重新读取或写回损坏、不可读或不可写的持久化文件。
5. Workspace 列表不得实时监听 cwd 是否消失。
6. Workspace 列表不得提供手动刷新按钮。
7. Workspace 列表必须有加载状态。
8. Workspace 列表必须提供固定的“添加 Workspace”入口。
9. 可用 Workspace 必须显示 name 和 cwd。
10. name 为空字符串时，Workspace 列表必须显示空白 name，不得 fallback 到 cwd basename。
11. 可用 Workspace 必须支持进入。
12. 可用 Workspace 必须支持 rename。
13. 可用 Workspace 必须支持编辑 cwd。
14. 非当前侧边栏会话选中的可用 Workspace 必须支持 remove。
15. 当前侧边栏会话选中的 Workspace 必须支持 rename。
16. 当前侧边栏会话选中的 Workspace 必须支持编辑 cwd。
17. 当前侧边栏会话选中的 Workspace 不得支持 remove。
18. 当前侧边栏会话选中的 Workspace 必须在 Workspace 列表中高亮，即使用户已经从该 Workspace thread 列表返回 Workspace 列表。
19. unavailable Workspace 必须显示 name、cwd 和“不可用”标记。
20. unavailable Workspace 只能 remove。
21. unavailable Workspace 不得进入 thread 列表。
22. remove Workspace 不需要确认。
23. remove Workspace 只删除 My-Code-X Workspace 记录，不删除本地目录。
24. remove Workspace 不删除 Codex threads。
25. Workspace add、rename、编辑 cwd、remove 不得通知或影响主 Conversation。
26. Workspace rename 成功后必须立即更新当前列表项 name。
27. Workspace rename 弹窗提交中不得关闭。
28. Workspace cwd 编辑弹窗提交中不得关闭。

### 手机端侧边栏导航

1. Conversation 必须是主页。
2. Workspace 必须作为手机端侧边栏抽屉功能存在。
3. 主 Conversation 顶部必须提供 Workspace 按钮，用于打开侧边栏。
4. 点击侧边栏外 overlay 必须关闭侧边栏。
5. 如果存在提交中的 rename、cwd 编辑或 thread rename 弹窗，overlay 点击不得关闭侧边栏或弹窗。
6. 侧边栏默认展示规则必须是：如果当前 Conversation scope 的 cwd 是已保存且可用的 Workspace，则展示该 Workspace 的 active thread 列表。
7. 如果当前 Conversation scope 的 cwd 不在已保存 Workspace 列表中，侧边栏必须默认展示 Workspace 列表。
8. 如果没有当前 Conversation scope，侧边栏必须默认展示 Workspace 列表。
9. “上次打开 Workspace”必须作为未来 slot feature 的职责，本版不得实现持久化上次打开 Workspace。
10. Workspace thread 列表顶部必须提供返回或切换 Workspace 的按钮。
11. 进入 Workspace thread 列表时，该 Workspace 成为当前侧边栏会话选中的 Workspace。
12. 当前侧边栏会话选中的 Workspace 定义为本次侧边栏打开期间用户正在查看或最近进入的 Workspace。
13. 从 Workspace thread 列表返回 Workspace 列表时，当前侧边栏会话选中的 Workspace 必须保留，用于列表高亮和 remove 禁用。
14. 关闭侧边栏时，当前侧边栏会话选中的 Workspace 必须清除；下次打开仍按当前 Conversation scope 重新决定默认页面。

### Active Thread 列表

1. 进入 Workspace active thread 列表时，必须调用 Codex `thread/list`。
2. 每次进入 Workspace active thread 列表都必须重新调用 Codex `thread/list`。
3. `thread/list` 参数必须包含当前 Workspace 的 canonical cwd。
4. active thread 列表必须使用 `archived = false`。
5. active thread 列表必须传 `sortKey = "updated_at"`。
6. active thread 列表必须传 `sortDirection = "desc"`。
7. active thread 列表每页 `limit` 必须为 10。
8. active thread 列表必须支持通过 Codex `nextCursor` 加载更多。
9. active thread 列表必须完全使用 Codex 返回顺序。
10. My-Code-X 不得在前端或后端重排 active thread 列表。
11. active thread 列表不得使用 Codex `searchTerm`。
12. active thread 列表不得自行添加 Codex 未返回的 thread。
13. active thread 列表必须展示 Codex 返回的 `name`、`preview`、`updatedAt`。
14. Codex 原始 `updatedAt` 是 Unix 秒数时，server 或 presenter 必须先规范化为 ISO string 或 null。
15. 前端只负责把规范化后的 ISO string 格式化为手机友好的本地时间，不得猜测 number 单位。
16. `name` 为空时不得用 `preview` 或“未命名对话”兜底。
17. `preview` 为空时不得用其他文案兜底。
18. `updatedAt` 缺失时不得用其他时间兜底。
19. `updatedAt` 不得显示为相对时间。
20. active thread 列表必须有加载状态。
21. active thread 首屏加载失败必须显示错误状态。
22. active thread 首屏加载失败不得伪装成空列表。
23. active thread 空列表必须显示空状态。
24. active thread 空状态不得提供新建 thread 入口。
25. 加载更多失败时必须保留已有列表。
26. 加载更多失败时必须在加载更多区域显示错误。
27. 加载更多失败后再次点击加载更多按钮必须重试同一次分页请求。
28. 当前主 Conversation 的 thread 如果出现在 active 列表中，必须高亮。
29. 点击当前主 Conversation 正在显示的 active thread 时不得响应，并且侧边栏保持打开。

### Active Thread 操作

1. 点击非当前 active thread 卡片必须调用 Codex `thread/resume`。
2. `thread/resume` 成功后，主 Conversation 必须切换到该 thread。
3. `thread/resume` 成功后，侧边栏必须关闭。
4. `thread/resume` 失败时，侧边栏必须保持打开。
5. `thread/resume` 失败时，必须在对应 thread 卡片上显示错误。
6. active thread 更多菜单必须支持 Codex `thread/name/set`。
7. active thread 更多菜单必须支持 Codex `thread/archive`。
8. active thread rename 必须允许空字符串。
9. active thread rename 必须把用户输入原样传给 Codex `thread/name/set`。
10. active thread rename 成功后必须更新当前卡片的 `name`。
11. active thread rename 成功后不得重排列表。
12. active thread rename 成功后不得重新拉取列表。
13. 如果 rename 的 thread 是当前主 Conversation thread，必须触发 Conversation 自己通过 `thread/resume` 刷新当前 thread。
14. Workspace 不得直接修改 Conversation 内部标题或 conversation state。
15. active thread archive 不需要确认。
16. active thread archive 成功后，当前 active 列表中必须保留该卡片。
17. active thread archive 成功后，该卡片必须显示“已归档”标记。
18. active thread archive 成功后，该卡片必须禁用交互。
19. “已归档”标记只在当前侧边栏页面会话中有效。
20. “已归档”标记不得持久化到 Workspace 数据。
21. “已归档”标记不得作为 Codex thread 状态存储。
22. 如果 archive 的 thread 是当前主 Conversation thread，应用层必须取消当前 thread 选择。
23. 当前 thread 选择取消后，Conversation 必须进入空选择状态。
24. Workspace 不得直接修改 Conversation 内部状态来清空 conversation。
25. active thread 操作进行中必须禁用当前操作项。
26. active thread 操作进行中不得禁用整个侧边栏。
27. archive、rename 操作失败必须在侧边栏内就地显示。
28. archive、rename 操作成功后侧边栏不得关闭。
29. rename 弹窗提交中不得关闭，直到成功或失败。

### Archived Thread 页面

1. Archived threads 必须是侧边栏内的单独页面或面板。
2. 当前 Workspace thread 列表必须提供一个小按钮进入 Archived 页面。
3. Archived 页面必须调用 Codex `thread/list`。
4. Archived 页面 `thread/list` 参数必须包含当前 Workspace 的 canonical cwd。
5. Archived 页面必须使用 `archived = true`。
6. Archived 页面必须传 `sortKey = "updated_at"`。
7. Archived 页面必须传 `sortDirection = "desc"`。
8. Archived 页面每页 `limit` 必须为 10。
9. Archived 页面必须支持通过 Codex `nextCursor` 加载更多。
10. Archived 页面必须展示 Codex 返回的 `name`、`preview`、`updatedAt`。
11. Codex 原始 `updatedAt` 是 Unix 秒数时，server 或 presenter 必须先规范化为 ISO string 或 null。
12. Archived 页面字段为空时不得兜底。
13. Archived 页面 `updatedAt` 必须由前端从规范化后的 ISO string 格式化为手机友好的本地时间。
14. Archived 页面 thread 顺序必须完全使用 Codex 返回顺序。
15. Archived 页面不得自行重排。
16. Archived 页面不得使用 Codex `searchTerm`。
17. Archived 页面必须有加载状态。
18. Archived 页面首屏加载失败必须显示错误状态，并提供返回当前 Workspace 的入口。
19. Archived 页面加载更多失败时必须保留已有列表，并在加载更多区域显示错误。
20. Archived 页面空列表必须显示空状态。
21. Archived 页面空状态不得提供操作。
22. Archived thread 只能执行 Codex `thread/unarchive`。
23. Archived thread 不得 resume。
24. Archived thread 不得 rename。
25. Archived thread 不得 archive。
26. Archived 页面不得高亮当前 Conversation thread。
27. unarchive 成功后必须留在 Archived 页面。
28. unarchive 成功后，当前卡片必须显示“已恢复”标记。
29. unarchive 成功后，当前卡片必须禁用交互。
30. “已恢复”标记只在当前侧边栏页面会话中有效。
31. “已恢复”标记不得持久化为 Workspace 或 thread 状态。
32. unarchive 成功后不得触发 active 列表预取。
33. 从 Archived 页面返回 active thread 列表时，必须重新调用 active `thread/list`。
34. unarchive 操作失败必须在侧边栏内就地显示。
35. unarchive 操作成功后侧边栏不得关闭。

### 持久化错误和内存模式

1. `.my-code-x` 或 Workspace 配置不可读时，必须显示错误。
2. `.my-code-x` 或 Workspace 配置不可读时，必须进入内存空列表。
3. 不可读进入内存空列表后，必须允许用户临时添加 Workspace。
4. Workspace 配置文件损坏时，必须显示错误。
5. Workspace 配置文件损坏时，允许进入内存模式。
6. Workspace 配置文件损坏时，不得写回损坏文件。
7. Workspace 配置文件损坏时，不得自动覆盖。
8. Workspace 配置文件损坏时，不得自动修复。
9. Workspace 配置文件损坏时，不得自动备份。
10. `.my-code-x` 或 Workspace 配置不可写时，必须显示错误。
11. 写入失败时，必须显示错误。
12. 写入失败后，内存状态必须更新为用户刚刚执行的变更结果。
13. 写入失败后，Workspace 功能必须切换到内存模式。
14. 内存模式下必须提示“当前 Workspace 变更不会持久保存”或等价信息。
15. 内存模式下允许继续 add、rename、编辑 cwd、remove。
16. 内存模式下后续变更不得尝试写回损坏或不可写文件。
17. 内存模式第一版不提供手动恢复持久化按钮。
18. 服务重启后可以重新尝试读取和写入持久化数据。
19. 持久化模式下，add、rename、编辑 cwd、remove 写入前必须读取最新 Workspace 文件。
20. add 必须根据 canonical cwd 做重复检查，并为新记录生成内部稳定 `id`。
21. rename、编辑 cwd、remove 必须优先根据内部 `id` 修改目标记录；如果调用方只有 canonical cwd，则可以用 canonical cwd 定位目标记录。
22. 编辑 cwd 必须以目标记录的内部 `id` 定位原记录，并以新 canonical cwd 做重复检查和保存。
23. add、rename、编辑 cwd、remove 必须把合并后的完整列表写回文件。
24. 不同 Workspace 的并发修改应尽量保留。
25. 同一个 Workspace 被并发修改时，按内部 `id` 定位并最后写入胜出。
26. 如果并发 cwd 编辑导致旧 canonical cwd 已无法定位，且调用方没有内部 `id`，本次操作必须失败并提示记录已变更或不存在，不得自动猜测。
27. 写文件应使用临时文件和原子替换。

## 边界情况和错误处理

1. cwd 输入为空：添加失败，显示 cwd 必填或等价错误。
2. cwd 输入 trim 后不是绝对路径：添加失败，显示路径必须是绝对路径。
3. cwd 不存在：添加失败，显示路径不存在。
4. cwd 不是目录：添加失败，显示路径不是目录。
5. cwd 当前进程不可访问：添加失败，显示无权限或不可访问。
6. cwd canonicalize 失败：添加失败，显示路径不可解析。
7. Windows 下同一路径大小写不同：必须识别为重复 Workspace。
8. 重复 canonical cwd：不新增，提示已存在。
9. 已保存 Workspace cwd 后来不存在：列表显示 unavailable，只允许 remove。
10. 已保存 Workspace cwd 后来无权限：列表显示 unavailable，只允许 remove。
11. unavailable Workspace 被点击进入：不得进入 thread 列表。
12. 当前侧边栏会话选中的 Workspace 不显示 remove 操作，即使用户已经返回 Workspace 列表。
13. remove 非当前侧边栏会话选中的 Workspace 后：只更新 Workspace 列表，不影响主 Conversation。
14. remove Workspace 失败：侧边栏内显示错误。
15. rename Workspace 失败：rename 弹窗或列表项就地显示错误。
16. 编辑 Workspace cwd 失败：cwd 编辑弹窗或列表项就地显示错误。
17. 编辑 Workspace cwd 时新 cwd 无效：阻止保存，并显示与添加 Workspace 相同类型的路径错误。
18. 编辑 Workspace cwd 时新 canonical cwd 与其他 Workspace 重复：阻止保存，并提示已存在。
19. 编辑当前侧边栏会话正在查看 active thread 列表的 Workspace cwd 成功：该侧边栏 Workspace 使用新 cwd，并重新拉取 active thread list。
20. 编辑 Workspace cwd 成功：不自动修改 Workspace name，不迁移 Codex threads，不保留旧 cwd 身份。
21. `.my-code-x` 不存在：应创建目录或在失败时进入错误/内存模式。
22. `.my-code-x` 不可读：提示错误，进入内存空列表。
23. Workspace 配置损坏：提示错误，进入内存模式，不写回损坏文件。
24. `.my-code-x` 不可写：提示错误，进入内存模式。
25. 写入中途失败：更新内存状态，提示未保存，切换内存模式。
26. 多页面修改不同 Workspace：持久化模式下写入前读取最新文件并合并目标记录，尽量保留其他修改。
27. 多页面修改同一 Workspace：最后写入胜出。
28. 当前 Conversation scope 的 cwd 未保存：侧边栏默认显示 Workspace 列表。
29. URL 中 workspace cwd 未保存：Workspace 功能不承认该 cwd。
30. Workspace 添加成功后 thread/list 失败：添加结果保留；只有进入 thread 列表时显示 thread/list 错误。
31. active thread 首屏 `thread/list` 失败：显示错误状态和返回 Workspace 列表入口。
32. active thread 为空：显示空状态，不显示新建 thread。
33. active thread 加载更多失败：保留已有列表，在加载更多区域显示错误；再次点击加载更多重试。
34. active thread 字段为空：对应展示为空，不显示兜底标题或兜底 preview。
35. active thread `updatedAt` 规范化或格式化失败：显示为空或原字段不可用状态，但不得发明时间。
36. 点击当前正在显示的 thread：不响应，保持侧边栏打开。
37. resume 非当前 thread 失败：对应卡片显示错误，侧边栏保持打开。
38. resume 非当前 thread 成功：主 Conversation 切换 thread，侧边栏关闭。
39. rename thread 失败：rename 弹窗保持可见并显示错误。
40. rename 当前主 thread 成功：Workspace 更新卡片 name，并触发 Conversation 自己 resume 当前 thread 进行刷新。
41. archive 非当前 thread 成功：当前卡片显示“已归档”，禁用交互，侧边栏保持打开。
42. archive 当前主 thread 成功：应用层取消当前 thread 选择，Conversation 进入空选择状态。
43. archive 失败：对应卡片或操作区域显示错误。
44. Archived 页面 `thread/list` 失败：显示错误状态和返回当前 Workspace 的入口。
45. Archived 页面为空：显示空状态，不提供操作。
46. Archived 页面加载更多失败：保留已有列表，在加载更多区域显示错误；再次点击加载更多重试。
47. Archived thread 字段为空：对应展示为空，不显示兜底标题或兜底 preview。
48. Archived thread 点击卡片：不得 resume。
49. Archived thread rename：不得提供入口。
50. Archived thread unarchive 成功：当前卡片显示“已恢复”，禁用交互，侧边栏保持打开。
51. Archived thread unarchive 失败：对应卡片或操作区域显示错误。
52. 从 Archived 返回 active：重新拉取 active thread list。
53. 操作进行中重复点击同一操作：必须被禁用。
54. rename 弹窗提交中用户尝试关闭：必须阻止关闭。
55. 侧边栏外 overlay 点击：没有提交中弹窗时关闭侧边栏，但不得取消已经提交且不可取消的后端请求；存在提交中的 rename、cwd 编辑或 thread rename 弹窗时必须阻止关闭。

## 不在本范围

1. Workspace 页面或侧边栏中新建 thread。
2. Conversation 输入框、消息发送、重新发送、发送失败 UI。
3. turn/start、turn/steer、turn/interrupt 等 turn 操作。
4. 每个 Workspace 独立 model 配置。
5. 每个 Workspace 独立 approval policy 配置。
6. 每个 Workspace 独立 sandbox 配置。
7. 每个 Workspace 独立 base instructions 或 developer instructions。
8. 目录选择器。
9. 服务端目录浏览器。
10. 系统原生目录选择器。
11. 自动扫描本机项目目录。
12. 从 Codex sessions 或历史 threads 自动导入 Workspace。
13. Workspace 搜索。
14. Workspace 手动排序。
15. Workspace 置顶。
16. Workspace 最近打开排序。
17. Workspace `lastOpenedAt`。
18. 实时监听 cwd 是否消失。
19. 手动刷新 Workspace 列表。
20. Thread 搜索。
21. Thread 自定义排序。
22. Thread source/model 过滤。
23. Thread 自定义状态标签。
24. 删除 Codex threads。
25. 删除本地项目目录。
26. 打开系统文件管理器。
27. 自动修复 Workspace cwd、自动重新定位路径、路径迁移、候选路径推荐或旧 cwd 别名映射。
28. 自动备份损坏 Workspace 配置。
29. 自动修复损坏 Workspace 配置。
30. 内存模式下手动恢复持久化按钮。
31. 多页面实时同步。
32. 多页面冲突提示。
33. 文件锁级并发控制。
34. Desktop layout。
35. “上次打开 Workspace”的 slot 持久化实现。
36. 将 unavailable Workspace 自动移除。
37. 将 URL 中未保存 cwd 自动添加为 Workspace。
38. 允许 archived thread resume。
39. 允许 archived thread rename。
40. 允许 archived thread archive。

## 未来计划

1. slot feature 可以保存上次打开的 Workspace，并在侧边栏打开时恢复该 Workspace 的 thread 列表。
2. Workspace 可以支持手动排序、置顶或搜索。
3. Workspace 可以支持专门的 cwd 修复或重新定位向导，但这不同于本版已支持的普通 cwd 编辑。
4. Workspace 可以支持从 Codex 历史中导入候选 cwd，但需要用户确认。
5. Thread 列表可以使用 Codex `searchTerm` 提供搜索。
6. Thread 列表可以暴露 Codex 已有的 source/model 过滤，但不得发明 Codex 没有的过滤语义。
7. 内存模式可以提供手动重试持久化。
8. 多页面并发可以增加版本检测或冲突提示。
9. 如果未来支持桌面端，可以另行设计常驻侧边栏布局。

## 进一步说明

1. Workspace 管理的是 My-Code-X 自己保存的 cwd 列表。
2. Codex threads 仍然由 Codex app-server 管理。
3. My-Code-X 不读取 `~/.codex/sessions` 作为 Workspace 功能的数据来源。
4. My-Code-X 调用 `thread/list` 时只传递当前 Workspace cwd、本功能确定的分页、archived 参数，以及 Codex 已有的 `sortKey = "updated_at"`、`sortDirection = "desc"`。
5. Thread 列表字段和可操作项必须来自 Codex app-server 已有接口。
6. “已归档”和“已恢复”是当前 UI 会话中的 action 结果标记，不是持久 thread 状态。
7. Workspace feature 不直接修改 Conversation 内部状态；需要影响主 Conversation 时，通过应用层选择变更或让 Conversation 自己恢复刷新。
8. Workspace cwd 编辑是普通 Workspace 记录编辑；它只改变该记录后续使用的 canonical cwd，不表示 Codex threads 迁移，也不表示旧 cwd 与新 cwd 有持续关系。
9. Workspace 持久化记录的内部 `id` 只解决 My-Code-X 自己的编辑定位和并发合并问题；它不是 Workspace 的产品身份，也不得替代 URL、client scope 或 Codex `thread/list` 使用的 canonical cwd。
10. Thread `updatedAt` 在进入客户端展示协议前必须规范化为 ISO string 或 null；前端不得猜测 Codex 原始时间字段的单位。
