# Feature-Workspace

Workspace 是 My-Code-X 手机端侧边栏功能，用来管理用户手动添加的本机项目目录，并按目录查看、恢复和整理对应的 Codex threads。

Workspace 不是独立主页。Conversation 仍是主页，Workspace 只作为侧边栏抽屉存在。Workspace 不负责新建 thread，不负责发送消息，不负责 turn 操作，也不为 Codex thread 发明额外状态。Workspace 以 cwd 作为工作区边界，并尊重 Codex 返回的 thread 字段、顺序、分页和操作结果。

## 用户故事

1. 作为正在管理本机项目工作区的 My-Code-X 用户，我想要手动添加一个本机项目目录作为 Workspace，这样我可以让 My-Code-X 把该目录作为 Codex 对话工作区。
2. 作为正在手机端切换项目的 My-Code-X 用户，我想要在侧边栏看到已添加的 Workspace 列表，这样我可以选择要浏览 threads 的项目目录。
3. 作为正在维护清晰 Workspace 列表的 My-Code-X 用户，我想要同一个目录只出现一次，这样重复记录不会干扰我选择工作区。
4. 作为正在识别多个项目目录的 My-Code-X 用户，我想要给 Workspace 设置可选名称，这样我可以按自己的习惯识别项目。
5. 作为正在重命名 Workspace 的 My-Code-X 用户，我想要 Workspace 名称只作为显示字段，这样名称变化不会改变 Workspace 身份。
6. 作为正在快速添加 Workspace 的 My-Code-X 用户，我想要空名称自动使用目录名称作为初始显示名，这样新 Workspace 默认可读。
7. 作为正在自定义 Workspace 显示名的 My-Code-X 用户，我想要后续可以把 Workspace 名称改成空字符串，这样显示名完全由我控制。
8. 作为正在粘贴本机路径的 My-Code-X 用户，我想要 cwd 输入自动去掉首尾空白，这样复制路径时的空白不会导致添加失败。
9. 作为正在添加 Workspace 的 My-Code-X 用户，我想要系统校验 cwd 是存在且可访问的本机目录，这样我不会保存无法使用的工作区。
10. 作为正在添加 Workspace 的 My-Code-X 用户，我想要添加重复目录时被阻止并看到明确提示，这样我知道该目录已经保存过。
11. 作为正在确认添加结果的 My-Code-X 用户，我想要添加 Workspace 成功后仍停留在 Workspace 列表，这样我可以立即看到新增记录。
12. 作为正在浏览 Workspace 列表的 My-Code-X 用户，我想要列表按添加顺序展示，这样列表顺序稳定且容易理解。
13. 作为正在打开侧边栏的 My-Code-X 用户，我想要看到每个 Workspace 当前是否可用，这样我能发现目录已经移动、删除或不可访问。
14. 作为正在处理失效项目目录的 My-Code-X 用户，我想要不可用 Workspace 仍显示在列表中，这样我知道曾经添加过这个目录。
15. 作为正在处理不可用 Workspace 的 My-Code-X 用户，我想要不可用 Workspace 只能移除，这样坏路径不会继续进入 thread 列表。
16. 作为正在清理 Workspace 列表的 My-Code-X 用户，我想要移除 Workspace 只删除 My-Code-X 记录，这样本地目录和 Codex threads 不会被误删。
17. 作为正在快速清理 Workspace 列表的 My-Code-X 用户，我想要移除 Workspace 不需要确认，这样轻量管理不会被打断。
18. 作为正在当前侧边栏会话中查看 Workspace 的 My-Code-X 用户，我想要当前选中的 Workspace 不能被移除，这样当前上下文不会被自己删除。
19. 作为正在当前侧边栏会话中切换页面的 My-Code-X 用户，我想要当前选中的 Workspace 在列表中高亮，这样我知道本次侧边栏正在查看或最近进入哪个工作区。
20. 作为正在修正工作区目录的 My-Code-X 用户，我想要编辑已保存 Workspace 的 cwd，这样我可以把一个工作区切换到另一个本机项目目录。
21. 作为正在编辑 Workspace cwd 的 My-Code-X 用户，我想要编辑 cwd 时使用和添加 Workspace 相同的路径规则，这样 Workspace 身份仍然清楚。
22. 作为正在改变 Workspace 目录的 My-Code-X 用户，我想要 cwd 编辑只改变该 Workspace 后续使用的新目录，这样路径变化不会产生隐藏迁移语义。
23. 作为正在继续项目对话的 My-Code-X 用户，我想要从 Workspace 列表进入某个 Workspace 后看到该 cwd 下的 active threads，这样我能继续已有对话。
24. 作为正在核对 Codex 历史的 My-Code-X 用户，我想要 active thread 列表完全来自 Codex，这样 My-Code-X 不会展示和 Codex 不一致的 thread。
25. 作为正在识别历史对话的 My-Code-X 用户，我想要 thread 列表展示 Codex 返回的名称、预览和更新时间，这样我能判断要打开哪个对话。
26. 作为正在查看 thread 列表的 My-Code-X 用户，我想要 thread 字段为空时保持为空，这样 My-Code-X 不会用自造文案误导我。
27. 作为正在手机端阅读 thread 时间的 My-Code-X 用户，我想要 thread 更新时间显示成本地绝对时间，这样我能读懂更新时间。
28. 作为正在查找最近对话的 My-Code-X 用户，我想要 thread 列表优先显示最近更新的对话，这样我能快速找到最近使用的历史。
29. 作为正在手机端浏览大量 threads 的 My-Code-X 用户，我想要 thread 列表一次加载少量内容并支持加载更多，这样列表保持轻量且仍能查看更多历史。
30. 作为正在加载更多 threads 的 My-Code-X 用户，我想要加载更多失败时保留已有列表，这样已加载内容不会丢失。
31. 作为正在查看空工作区历史的 My-Code-X 用户，我想要没有 active threads 时只看到空状态，这样 Workspace 不会暗示它能新建 thread。
32. 作为正在继续已有对话的 My-Code-X 用户，我想要点击 active thread 时恢复该 thread 并切换主 Conversation，这样我能继续阅读或使用该对话。
33. 作为正在手机端恢复对话的 My-Code-X 用户，我想要恢复 thread 成功后侧边栏自动关闭，这样主界面回到 Conversation。
34. 作为正在恢复对话的 My-Code-X 用户，我想要恢复 thread 失败时侧边栏保持打开并显示卡片错误，这样我知道哪个操作失败。
35. 作为正在对照当前主对话和列表的 My-Code-X 用户，我想要当前主 Conversation 正在显示的 active thread 在列表中高亮，这样我知道当前对话来自哪个 thread。
36. 作为正在避免重复操作的 My-Code-X 用户，我想要点击当前正在显示的 active thread 不响应，这样不会重复恢复当前 thread。
37. 作为正在整理 active threads 的 My-Code-X 用户，我想要在 active thread 的更多菜单中重命名 thread，这样我能整理已有对话。
38. 作为正在重命名 thread 的 My-Code-X 用户，我想要 thread 重命名允许空字符串，这样 My-Code-X 不额外限制 Codex 的命名行为。
39. 作为正在重命名 active thread 的 My-Code-X 用户，我想要重命名成功后当前卡片立即显示新名称但列表不重排，这样反馈及时且顺序稳定。
40. 作为正在重命名当前主 Conversation thread 的 My-Code-X 用户，我想要 Conversation 自己刷新相关显示，这样侧边栏不直接修改主界面内部状态。
41. 作为正在整理 active 列表的 My-Code-X 用户，我想要在 active thread 的更多菜单中归档 thread，这样我可以把不需要继续显示的对话移出 active 列表。
42. 作为正在快速归档 thread 的 My-Code-X 用户，我想要归档 active thread 不需要确认，这样轻量整理不会被打断。
43. 作为正在确认归档结果的 My-Code-X 用户，我想要归档成功后当前列表保留该卡片并标记“已归档”，这样当前操作结果不会突然消失。
44. 作为正在理解归档反馈的 My-Code-X 用户，我想要“已归档”标记只在当前侧边栏会话中有效，这样 My-Code-X 不会暗示存在额外持久 thread 状态。
45. 作为正在归档当前主 Conversation thread 的 My-Code-X 用户，我想要主 Conversation 进入空选择状态，这样主界面不会继续显示已归档的当前对话。
46. 作为正在管理已归档对话的 My-Code-X 用户，我想要打开当前 Workspace 的 archived thread 页面，这样 archived threads 和 active threads 分开管理。
47. 作为正在核对已归档历史的 My-Code-X 用户，我想要 archived thread 列表完全来自 Codex，这样 archived 列表也尊重 Codex。
48. 作为正在管理 archived threads 的 My-Code-X 用户，我想要 archived thread 只允许恢复，这样 archived 页面语义单一。
49. 作为正在查看空 archived 页面的 My-Code-X 用户，我想要没有 archived threads 时只看到空状态，这样页面不会提供无意义操作。
50. 作为正在查看 archived 页面和当前对话关系的 My-Code-X 用户，我想要 archived 页面不高亮当前 Conversation thread，这样页面不会暗示 archived thread 可直接打开。
51. 作为正在恢复 archived thread 的 My-Code-X 用户，我想要恢复成功后仍留在 archived 页面并看到“已恢复”标记，这样操作结果清楚且不自动跳转。
52. 作为正在从 archived 返回 active 的 My-Code-X 用户，我想要返回 active 时重新拉 active thread list，这样我能看到最新 active 结果。
53. 作为正在使用 Workspace 侧边栏的 My-Code-X 用户，我想要 Workspace 相关加载和操作失败都在侧边栏内就地展示，这样主 Conversation 不会被打断。
54. 作为正在关闭手机端抽屉的 My-Code-X 用户，我想要侧边栏外 overlay 可以在没有提交中弹窗时关闭侧边栏，这样抽屉行为自然。
55. 作为正在提交弹窗操作的 My-Code-X 用户，我想要存在提交中弹窗时 overlay 点击不关闭侧边栏或弹窗，这样提交中的操作不会被中断。
56. 作为正在 thread 列表中切换工作区的 My-Code-X 用户，我想要 thread 列表顶部有返回或切换 Workspace 的按钮，这样我能回到 Workspace 列表。
57. 作为正在当前 Conversation 上下文中打开侧边栏的 My-Code-X 用户，我想要优先展示当前 Conversation scope 对应的已保存可用 Workspace，这样当前上下文优先。
58. 作为正在未保存 cwd 的 Conversation 中打开侧边栏的 My-Code-X 用户，我想要侧边栏显示 Workspace 列表，这样未保存 cwd 不会被临时当作 Workspace。
59. 作为正在管理 Workspace 持久数据的 My-Code-X 用户，我想要配置不可读、不可写或损坏时得到明确提示，这样我知道工作区管理是否能持久保存。
60. 作为正在遇到 Workspace 持久化问题的 My-Code-X 用户，我想要仍能临时使用 Workspace，这样当前运行不被完全阻塞。
61. 作为正在临时模式下修改 Workspace 的 My-Code-X 用户，我想要看到本次变更不会持久保存的明确提示，这样我不会误以为修改已保存。

## 功能需求设计

1. Given 用户打开 My-Code-X, when 用户未打开 Workspace 侧边栏, then Conversation 必须仍是主页。
2. Given 用户点击主 Conversation 顶部的 Workspace 入口, when 侧边栏打开, then Workspace 必须以手机端抽屉形式展示。
3. Given 当前 Conversation scope 对应一个已保存且可用的 Workspace, when 用户打开侧边栏, then 侧边栏默认展示该 Workspace 的 active thread 列表。
4. Given 当前 Conversation scope 不存在、未保存或不可用, when 用户打开侧边栏, then 侧边栏默认展示 Workspace 列表。
5. Given 用户关闭侧边栏, when 用户下次再次打开侧边栏, then 默认页面必须重新按当前 Conversation scope 判断。
6. Given 用户打开侧边栏, when Workspace 列表加载中, then 侧边栏必须显示加载状态。
7. Given Workspace 列表加载成功, when 展示列表, then Workspace 必须按添加顺序展示。
8. Given Workspace 列表展示, when 用户查看列表, then 侧边栏必须提供固定的添加 Workspace 入口。
9. Given Workspace 列表为空, when 展示列表, then 侧边栏必须显示空状态和添加 Workspace 入口。
10. Given Workspace 可用, when 展示 Workspace 列表项, then 列表项必须显示 name 和 cwd。
11. Given Workspace name 为空字符串, when 展示 Workspace 列表项, then name 区域必须保持空白，不得回退到 cwd 名称。
12. Given Workspace 不可用, when 展示 Workspace 列表项, then 列表项必须显示 name、cwd、不可用标记和可理解的不可用原因。
13. Given Workspace 不可用, when 用户尝试操作该列表项, then 只能执行 remove。
14. Given Workspace 可用, when 用户点击进入, then 侧边栏必须展示该 Workspace 的 active thread 列表。
15. Given Workspace 可用, when 用户打开更多操作, then 必须支持 rename 和编辑 cwd。
16. Given Workspace 不是当前侧边栏会话选中的 Workspace, when 用户打开更多操作, then 必须支持 remove。
17. Given Workspace 是当前侧边栏会话选中的 Workspace, when 用户打开更多操作, then 不得提供 remove。
18. Given 用户进入某个 Workspace 的 thread 列表, when 用户返回 Workspace 列表, then 该 Workspace 必须继续在本次侧边栏会话中高亮。
19. Given 用户关闭侧边栏, when 侧边栏关闭完成, then 本次侧边栏会话选中的 Workspace 必须清除。
20. Given 用户点击侧边栏外 overlay, when 没有提交中的弹窗, then 侧边栏必须关闭。
21. Given 用户点击侧边栏外 overlay, when 存在提交中的 Workspace rename、cwd 编辑或 thread rename 弹窗, then 侧边栏和弹窗必须保持打开。
22. Given 用户提交添加 Workspace 表单, when cwd 为空或 trim 后为空, then 添加必须失败并提示 cwd 必填。
23. Given 用户提交添加 Workspace 表单, when cwd 不是绝对路径, then 添加必须失败并提示路径必须是绝对路径。
24. Given 用户提交添加 Workspace 表单, when cwd 不存在, then 添加必须失败并提示路径不存在。
25. Given 用户提交添加 Workspace 表单, when cwd 不是目录, then 添加必须失败并提示路径不是目录。
26. Given 用户提交添加 Workspace 表单, when 当前进程不能访问 cwd, then 添加必须失败并提示路径不可访问。
27. Given 用户提交添加 Workspace 表单, when cwd 可以解析为已保存 Workspace 的同一目录, then 添加必须失败并提示已存在。
28. Given 用户提交添加 Workspace 表单, when name 是完全空字符串, then 添加成功后的初始 name 必须使用目录名称。
29. Given 用户提交添加 Workspace 表单, when name 不是完全空字符串, then 添加成功后的 name 必须保持用户输入。
30. Given 用户添加 Workspace 成功, when 返回操作结果, then 侧边栏必须仍停留在 Workspace 列表。
31. Given 用户添加 Workspace 成功, when 操作完成, then 不得自动进入该 Workspace 的 thread 列表。
32. Given 用户 rename Workspace, when 输入任意 name 包括空字符串, then 保存后的 name 必须等于用户输入。
33. Given 用户 rename Workspace 成功, when 操作完成, then 当前列表项必须立即显示新 name。
34. Given 用户 rename Workspace 失败, when 操作完成, then 侧边栏必须就地显示错误。
35. Given 用户编辑 Workspace cwd, when 新 cwd 为空、不是绝对路径、不存在、不是目录或不可访问, then 保存必须失败并显示对应路径错误。
36. Given 用户编辑 Workspace cwd, when 新 cwd 与其他 Workspace 重复, then 保存必须失败并提示已存在。
37. Given 用户编辑 Workspace cwd 成功, when 操作完成, then 该 Workspace 必须使用新 cwd 作为后续工作区身份。
38. Given 用户编辑 Workspace cwd 成功, when 操作完成, then Workspace name 必须保持不变。
39. Given 用户编辑 Workspace cwd 成功, when 当前侧边栏正在查看该 Workspace 的 active thread 列表, then 侧边栏必须用新 cwd 重新加载 active thread 列表。
40. Given 用户编辑 Workspace cwd 成功, when 主 Conversation 仍引用旧 cwd, then Workspace 不得直接修改主 Conversation。
41. Given 用户 remove Workspace, when 操作成功, then 该 Workspace 必须从 Workspace 列表移除。
42. Given 用户 remove Workspace, when 操作成功, then 本地项目目录不得被删除。
43. Given 用户 remove Workspace, when 操作成功, then Codex threads 不得被删除。
44. Given 用户 remove Workspace 失败, when 操作完成, then 侧边栏必须就地显示错误。
45. Given 用户进入 active thread 列表, when 页面加载, then 必须请求当前 Workspace 的 active threads。
46. Given 用户进入 active thread 列表, when 请求 Codex thread/list, then 请求必须使用当前 Workspace cwd、archived=false、limit=10、sortKey=updated_at、sortDirection=desc，并且不得使用 searchTerm。
47. Given active thread 列表请求成功, when 展示列表, then 必须使用 Codex 返回的顺序。
48. Given active thread 列表请求成功, when 展示 thread 卡片, then 卡片必须展示 Codex 返回的 name、preview 和 updatedAt。
49. Given thread name 为空, when 展示卡片, then 不得用 preview 或自造标题兜底。
50. Given thread preview 为空, when 展示卡片, then 不得用其他文案兜底。
51. Given thread updatedAt 缺失或不可展示, when 展示卡片, then 不得发明时间。
52. Given active thread 首屏加载失败, when 展示页面, then 必须显示错误状态和返回 Workspace 列表入口。
53. Given active thread 首屏加载成功且无 items, when 展示页面, then 必须显示空状态且不得提供新建 thread 入口。
54. Given active thread 列表还有更多结果, when 用户点击加载更多, then 必须用 Codex nextCursor 加载下一页。
55. Given 加载更多成功, when 操作完成, then 新 items 必须追加到已有列表后面。
56. Given 加载更多失败, when 操作完成, then 已有列表必须保留，并在加载更多区域显示错误。
57. Given 加载更多失败, when 用户再次点击加载更多, then 必须重试同一次分页请求。
58. Given active thread 是当前主 Conversation thread, when 展示卡片, then 卡片必须高亮并禁用 resume。
59. Given 用户点击当前主 Conversation thread 卡片, when 点击发生, then 侧边栏必须保持打开且不得重复 resume。
60. Given 用户点击非当前 active thread, when resume 成功, then 主 Conversation 必须切换到该 thread。
61. Given 用户点击非当前 active thread, when resume 成功, then 侧边栏必须关闭。
62. Given 用户点击非当前 active thread, when resume 失败, then 侧边栏必须保持打开并在对应卡片显示错误。
63. Given 用户在 active thread 更多菜单中 rename, when rename 成功, then 当前卡片必须显示新 name。
64. Given 用户在 active thread 更多菜单中 rename, when rename 成功, then active thread 列表不得重排。
65. Given 用户在 active thread 更多菜单中 rename, when rename 成功, then 不得重新拉取 active thread 列表。
66. Given 用户 rename 当前主 Conversation thread, when rename 成功, then 主 Conversation 必须通过自己的刷新流程更新相关显示。
67. Given 用户 rename active thread 失败, when 操作完成, then rename 弹窗必须保持可见并显示错误。
68. Given 用户 archive active thread, when archive 成功, then 当前列表必须保留该卡片。
69. Given 用户 archive active thread, when archive 成功, then 该卡片必须显示“已归档”标记并禁用交互。
70. Given 用户 archive active thread, when archive 成功, then 侧边栏必须保持打开。
71. Given 用户 archive 当前主 Conversation thread, when archive 成功, then 主 Conversation 必须进入空选择状态。
72. Given 用户 archive active thread 失败, when 操作完成, then 对应卡片或操作区域必须显示错误。
73. Given 用户进入 archived thread 页面, when 页面加载, then 必须请求当前 Workspace 的 archived threads。
74. Given 用户进入 archived thread 页面, when 请求 Codex thread/list, then 请求必须使用当前 Workspace cwd、archived=true、limit=10、sortKey=updated_at、sortDirection=desc，并且不得使用 searchTerm。
75. Given archived thread 列表请求成功, when 展示列表, then 必须使用 Codex 返回的顺序。
76. Given archived thread 首屏加载失败, when 展示页面, then 必须显示错误状态和返回当前 Workspace 的入口。
77. Given archived thread 列表为空, when 展示页面, then 必须显示空状态且不得提供操作。
78. Given archived thread 卡片展示, when 用户查看操作, then 只能提供 unarchive。
79. Given archived thread 卡片展示, when 用户点击卡片, then 不得 resume。
80. Given archived thread 卡片展示, when 用户打开更多操作, then 不得提供 rename 或 archive。
81. Given 用户 unarchive archived thread, when unarchive 成功, then 当前页面必须保留该卡片。
82. Given 用户 unarchive archived thread, when unarchive 成功, then 该卡片必须显示“已恢复”标记并禁用交互。
83. Given 用户 unarchive archived thread, when unarchive 成功, then 不得自动跳转 active 页面。
84. Given 用户从 archived 页面返回 active 页面, when 返回发生, then 必须重新加载 active thread 列表。
85. Given Workspace 配置不可读、损坏、不可写或写入失败, when 用户打开或操作 Workspace, then 必须显示明确错误。
86. Given Workspace 进入临时模式, when 用户继续 add、rename、编辑 cwd 或 remove, then 操作必须作用于本次运行内的临时状态。
87. Given Workspace 处于临时模式, when 展示侧边栏, then 必须提示本次变更不会持久保存。

## 边界情况和错误处理

1. cwd 输入为空或 trim 后为空时，阻止添加或保存，并提示 cwd 必填。
2. cwd 不是绝对路径时，阻止添加或保存，并提示路径必须是绝对路径。
3. cwd 不存在时，阻止添加或保存，并提示路径不存在。
4. cwd 不是目录时，阻止添加或保存，并提示路径不是目录。
5. cwd 当前进程不可访问时，阻止添加或保存，并提示无权限或不可访问。
6. cwd 解析失败时，阻止添加或保存，并提示路径不可解析。
7. 同一目录使用不同文本形式输入时，必须识别为重复 Workspace。
8. 已保存 Workspace 后来变为不可用时，列表仍显示该 Workspace，但只允许 remove。
9. 用户点击不可用 Workspace 时，不得进入 thread 列表。
10. 当前侧边栏会话选中的 Workspace 即使已经返回 Workspace 列表，也不得显示 remove 操作。
11. remove Workspace 失败时，侧边栏内显示错误，列表保持可理解状态。
12. rename Workspace 失败时，rename 弹窗或列表项就地显示错误。
13. 编辑 Workspace cwd 失败时，cwd 编辑弹窗或列表项就地显示错误。
14. 编辑当前正在查看 active thread 列表的 Workspace cwd 成功时，侧边栏使用新 cwd 重新拉取 active thread list。
15. 当前 Conversation scope 的 cwd 未保存时，侧边栏默认显示 Workspace 列表。
16. URL 或 client scope 中的 cwd 未保存时，Workspace 功能不承认该 cwd。
17. Workspace 添加成功后，如果之后进入 thread 列表失败，添加结果仍保留，thread 错误只显示在 thread 页面。
18. active thread 首屏加载失败时，显示错误状态，不伪装成空列表。
19. active thread 为空时，显示空状态，不显示新建 thread 入口。
20. active thread 加载更多失败时，保留已有列表，并允许重试同一分页。
21. active thread 字段为空时，对应展示为空，不显示兜底标题、兜底预览或兜底时间。
22. 点击当前正在显示的 thread 时，不响应并保持侧边栏打开。
23. resume 非当前 thread 失败时，对应卡片显示错误，侧边栏保持打开。
24. resume 非当前 thread 成功时，主 Conversation 切换 thread，侧边栏关闭。
25. rename thread 失败时，rename 弹窗保持可见并显示错误。
26. archive 当前主 thread 成功时，Conversation 进入空选择状态。
27. archive 失败时，对应卡片或操作区域显示错误。
28. archived 页面加载失败时，显示错误状态和返回当前 Workspace 的入口。
29. archived 页面为空时，显示空状态，不提供操作。
30. archived 页面加载更多失败时，保留已有列表，并允许重试同一分页。
31. archived thread 字段为空时，对应展示为空，不显示兜底标题、兜底预览或兜底时间。
32. archived thread 点击卡片时，不得 resume。
33. archived thread 不得提供 rename 或 archive 入口。
34. unarchive 成功时，当前卡片显示“已恢复”，禁用交互，侧边栏保持打开。
35. unarchive 失败时，对应卡片或操作区域显示错误。
36. 操作进行中重复点击同一操作时，必须被禁用。
37. 提交中的弹窗被用户尝试关闭时，必须阻止关闭。
38. overlay 点击在没有提交中弹窗时关闭侧边栏，但不得取消已经提交且不可取消的后端请求。
39. overlay 点击在存在提交中弹窗时，必须阻止关闭侧边栏和弹窗。
40. Workspace 无法持久保存时，必须提示用户当前变更只在本次运行内有效。

## 不在范围

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
17. 实时监听 cwd 是否消失。
18. 手动刷新 Workspace 列表。
19. Thread 搜索。
20. Thread 自定义排序。
21. Thread source 或 model 过滤。
22. Thread 自定义状态标签。
23. 删除 Codex threads。
24. 删除本地项目目录。
25. 打开系统文件管理器。
26. 自动修复 Workspace cwd、自动重新定位路径、路径迁移、候选路径推荐或旧 cwd 别名映射。
27. 自动备份或自动修复损坏的 Workspace 配置。
28. 临时模式下手动恢复持久化按钮。
29. 多页面实时同步。
30. 多页面冲突提示。
31. 文件锁级并发控制。
32. Desktop layout。
33. “上次打开 Workspace”的 slot 持久化实现。
34. 将不可用 Workspace 自动移除。
35. 将 URL 或 client scope 中未保存 cwd 自动添加为 Workspace。
36. 允许 archived thread resume。
37. 允许 archived thread rename。
38. 允许 archived thread archive。

## 未来计划

1. Slot feature 可以保存上次打开的 Workspace，并在侧边栏打开时恢复该 Workspace 的 thread 列表。
2. Workspace 可以支持手动排序、置顶或搜索。
3. Workspace 可以支持专门的 cwd 修复或重新定位向导。
4. Workspace 可以支持从 Codex 历史中导入候选 cwd，但需要用户确认。
5. Thread 列表可以使用 Codex searchTerm 提供搜索。
6. Thread 列表可以暴露 Codex 已有的 source 或 model 过滤。
7. 临时模式可以提供手动重试持久化。
8. 多页面并发可以增加版本检测或冲突提示。
9. 如果未来支持桌面端，可以另行设计常驻侧边栏布局。
