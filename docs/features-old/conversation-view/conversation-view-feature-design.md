# Feature-Conversation View

Conversation View 是 My-Code-X 主界面的只读对话阅读功能，用来展示当前选中 Codex `Thread` 的 `Conversation` timeline。它让用户在手机或桌面上按顺序阅读用户消息、assistant 消息、`Work trace`、会话内错误，以及空状态、加载状态和恢复结果。

Conversation View 的核心定位是阅读。它不负责输入、发送、重试、取消、approval、`Pending interaction`、手动刷新、搜索、跳转或打开 workspace 文件。它只展示系统确认后的权威 `Conversation` 内容，并把这些内容组织成适合移动端阅读的聊天界面。

## 用户故事

1. 作为正在阅读 Codex 对话的 My-Code-X 用户，我想要在一个界面里看到当前 thread 的完整 conversation timeline，这样我能按真实顺序理解这一轮工作。
2. 作为正在确认消息是否发送成功的 My-Code-X 用户，我想要只看到系统确认接受后的用户消息，这样我不会把未进入系统的本地输入误认为正式对话。
3. 作为正在手机上阅读聊天的 My-Code-X 用户，我想要用户消息靠右、assistant 内容靠左，这样界面符合常见聊天阅读习惯。
4. 作为正在阅读长对话的 My-Code-X 用户，我想要消息按 Markdown 展示，这样列表、表格、代码块和链接更容易阅读。
5. 作为正在查看不可信对话内容的 My-Code-X 用户，我想要 Markdown 中的原始 HTML 不作为页面 HTML 执行，这样对话内容不会破坏页面或触发不可信行为。
6. 作为正在阅读代码回答的 My-Code-X 用户，我想要代码块使用等宽字体，这样代码结构清晰。
7. 作为正在复用代码片段的 My-Code-X 用户，我想要代码块有复制按钮，这样我能快速复制原始代码文本。
8. 作为正在复用对话内容的 My-Code-X 用户，我想要用户消息和 assistant 消息有整条复制按钮，这样我能快速复制原始消息文本。
9. 作为正在查看宽表格的 My-Code-X 用户，我想要 Markdown 表格在窄屏上可以横向滚动，这样表格不会被挤压到不可读。
10. 作为正在打开外部资料的 My-Code-X 用户，我想要普通网页链接在新标签页打开，这样当前对话阅读不会被打断。
11. 作为正在区分本地项目和网页链接的 My-Code-X 用户，我想要 workspace 文件引用与普通网页链接有视觉区分，这样我不会混淆本地文件和外部页面。
12. 作为正在打开空 thread 的 My-Code-X 用户，我想要看到明确空状态，这样我知道当前是没有 conversation，而不是加载失败。
13. 作为正在等待历史 thread 读取的 My-Code-X 用户，我想要看到加载或恢复状态，这样我知道系统正在准备 conversation。
14. 作为正在处理读取失败的 My-Code-X 用户，我想要看到常规错误状态，这样我知道当前 conversation 无法正常展示。
15. 作为正在恢复进行中 thread 的 My-Code-X 用户，我想要恢复后继续看到后续 conversation 更新，这样我能接着观察 Codex 当前进度。
16. 作为正在回看已完成 thread 的 My-Code-X 用户，我想要看到完整历史 conversation，这样我能正常复盘过去的对话。
17. 作为正在等待 Codex 工作的 My-Code-X 用户，我想要看到内容按进度刷新，这样我知道工作仍在继续。
18. 作为正在弱网或多页签场景阅读对话的 My-Code-X 用户，我想要页面保持稳定，这样高频更新不会造成卡顿、乱序或闪烁。
19. 作为正在等待长输出完成的 My-Code-X 用户，我想要最终看到完整内容，这样进度式刷新不会导致信息丢失。
20. 作为正在观察 Codex 工作过程的 My-Code-X 用户，我想要看到 Codex 提供的计划、推理摘要、命令、工具、文件变更、网页搜索等工作痕迹，这样 Codex 的执行过程不是黑盒。
21. 作为正在追踪执行顺序的 My-Code-X 用户，我想要工作痕迹按 conversation 顺序出现在 timeline 中，这样我能理解每件事发生的先后关系。
22. 作为正在区分消息来源的 My-Code-X 用户，我想要工作痕迹作为 Codex 侧内容靠左展示，这样我能把它们理解为 assistant 工作流的一部分。
23. 作为正在手机上阅读长输出的 My-Code-X 用户，我想要工作痕迹默认折叠，这样 stdout、stderr、diff、工具输出和搜索结果不会淹没主要对话。
24. 作为正在展开工作痕迹的 My-Code-X 用户，我想要首次只看到有限行数，这样小屏幕不会被超长内容压垮。
25. 作为正在确认长内容是否还有剩余的 My-Code-X 用户，我想要看到剩余行数提示，这样我知道还可以继续展开多少内容。
26. 作为正在调查细节的 My-Code-X 用户，我想要能够继续展开被截断的工作痕迹，这样必要时仍能看到完整内容。
27. 作为正在检查原始工作数据的 My-Code-X 用户，我想要展开工作痕迹后看到原始字段名和值，这样我不依赖 My-Code-X 重新解释这些数据。
28. 作为正在识别工作痕迹类型的 My-Code-X 用户，我想要工作痕迹卡片标题使用 Codex 原生 item type，这样每个 item 的来源仍然可辨认。
29. 作为正在使用新版 Codex 的 My-Code-X 用户，我想要未知 item type 不被隐藏，这样 Codex 增加新信息时我仍能观察到。
30. 作为正在查看未知 item 的 My-Code-X 用户，我想要未知 item 默认折叠并可展开查看原始字段，这样页面稳定且信息可追踪。
31. 作为正在定位会话错误的 My-Code-X 用户，我想要 conversation 内错误以聊天卡片展示，这样错误不会只藏在日志里。
32. 作为正在排查失败原因的 My-Code-X 用户，我想要错误卡片显示原始错误信息，这样我看到的是实际错误。
33. 作为正在快速扫读 timeline 的 My-Code-X 用户，我想要错误文字使用红色，这样错误容易被识别。
34. 作为正在区分正常回答和失败的 My-Code-X 用户，我想要会话内错误不伪装成普通 assistant message，这样语义清楚。
35. 作为正在阅读完成对话的 My-Code-X 用户，我想要界面不显示额外完成提示，这样 timeline 不出现 Codex 没有表达的状态噪音。
36. 作为正在手机上阅读对话的 My-Code-X 用户，我想要消息、工作痕迹和错误不显示时间戳，这样界面更简洁。
37. 作为正在专注阅读当前对话的 My-Code-X 用户，我想要 Conversation View 不提供搜索、筛选、跳转和手动刷新控件，这样阅读体验保持聚焦。
38. 作为正在处理 `Pending interaction` 或 approval 的 My-Code-X 用户，我想要这些操作可以在视觉上靠近对话，但不混入 `Conversation` timeline，这样阅读和操作职责清楚。
39. 作为正在维护 My-Code-X 的开发者，我想要 Conversation View 展示系统确认的 conversation 权威内容，这样 My-Code-X 不维护另一套对话语义。
40. 作为正在维护 My-Code-X 的开发者，我想要同一个权威 item 的更新仍表现为同一个 timeline item，这样 UI 与 conversation 身份保持一致。

## 功能需求设计

1. Given 用户打开一个当前 thread, when conversation 数据可用, then Conversation View 必须渲染一条有序 timeline。
2. Given timeline 包含系统确认后的用户消息, when Conversation View 渲染消息, then 该用户消息必须作为正式 timeline item 展示。
3. Given 用户刚输入但系统尚未确认消息, when Conversation View 渲染 timeline, then 该本地输入不得作为 conversation item 展示。
4. Given timeline 包含用户消息, when Conversation View 渲染该消息, then 消息必须靠右展示。
5. Given timeline 包含 assistant 消息, when Conversation View 渲染该消息, then 消息必须靠左展示。
6. Given timeline 包含 Codex 工作痕迹, when Conversation View 渲染该 item, then 该 item 必须作为 Codex 侧内容靠左展示。
7. Given 用户消息或 assistant 消息包含 Markdown, when Conversation View 渲染消息内容, then 必须按 Markdown 语义展示。
8. Given Markdown 内容包含原始 HTML, when Conversation View 渲染内容, then 原始 HTML 不得作为可信页面 HTML 执行。
9. Given Markdown 内容包含代码块, when Conversation View 渲染代码块, then 代码块必须使用等宽字体。
10. Given Markdown 内容包含代码块, when 用户点击代码块复制按钮, then 系统必须复制代码块原始文本。
11. Given 用户消息或 assistant 消息展示完成, when 用户点击整条消息复制按钮, then 系统必须复制该消息原始文本。
12. Given Markdown 内容包含宽表格, when 页面宽度不足, then 表格必须可以横向滚动。
13. Given Markdown 内容包含普通外部链接, when 用户打开该链接, then 链接必须在新标签页打开。
14. Given conversation 内容包含系统识别的 workspace 文件引用, when Conversation View 渲染该引用, then 该引用必须与普通外部链接有视觉区分。
15. Given 当前 thread 没有 conversation item, when conversation 数据读取成功, then Conversation View 必须显示明确空状态。
16. Given 当前 conversation 正在读取, when 数据尚未可展示, then Conversation View 必须显示加载状态。
17. Given 当前 thread 正在恢复, when 恢复尚未完成, then Conversation View 必须显示加载或恢复状态。
18. Given conversation 读取或恢复失败, when Conversation View 展示失败结果, then 必须显示 timeline 外的常规错误状态。
19. Given 恢复出的 thread 仍在进行中, when 后续 conversation 更新到达, then Conversation View 必须继续展示这些更新。
20. Given 恢复出的 thread 已完成, when Conversation View 展示恢复结果, then 必须展示完整历史 conversation。
21. Given Codex 正在工作并产生新内容, when Conversation View 接收系统提供的更新, then timeline 必须按进度刷新。
22. Given 更新频率较高, when Conversation View 展示进行中内容, then 页面应保持稳定，不要求逐 token 直播。
23. Given Codex 工作结束并产生最终内容, when Conversation View 收到最终 conversation, then timeline 必须展示完整权威内容。
24. Given 系统把某段内容表示为同一个 item 的更新, when Conversation View 刷新 timeline, then 必须更新同一个 timeline item。
25. Given 系统把内容表示为多个 item, when Conversation View 渲染 timeline, then 必须展示为多个 timeline item。
26. Given timeline 包含计划、推理摘要、命令、工具、文件变更、网页搜索或类似工作痕迹, when Conversation View 渲染这些 item, then 必须把它们作为工作痕迹展示。
27. Given 工作痕迹 item 在 timeline 中出现, when Conversation View 展示 timeline, then 必须保留系统提供的顺序。
28. Given 工作痕迹 item 初次展示, when 用户尚未展开, then 该 item 必须默认折叠。
29. Given 用户展开工作痕迹 item, when 内容超过 30 行, then 首次最多显示 30 行。
30. Given 展开的工作痕迹内容超过 30 行, when Conversation View 截断显示, then 必须提供剩余行数提示。
31. Given 工作痕迹内容被截断, when 用户继续展开, then Conversation View 必须显示更多剩余内容。
32. Given 工作痕迹 item 被展开, when Conversation View 展示详情, then 必须按原始字段名和值展示字段列表。
33. Given 工作痕迹字段值是复杂结构, when Conversation View 展示该值, then 必须使用安全、可读的文本形式展示。
34. Given 工作痕迹 item 有原生 item type, when Conversation View 展示卡片标题, then 必须使用该原生 item type。
35. Given 系统提供 Conversation View 当前不认识的 item type, when Conversation View 渲染 timeline, then 该 item 不得被丢弃。
36. Given 未知 item type 初次展示, when 用户尚未展开, then 该 item 必须默认折叠。
37. Given 用户展开未知 item type, when Conversation View 展示详情, then 必须按原始字段名和值展示字段列表。
38. Given 未知 item 的字段值是复杂结构, when Conversation View 展示该值, then 必须使用安全、可读的文本形式展示。
39. Given timeline 包含 conversation-scoped 错误, when Conversation View 渲染该错误, then 必须作为错误卡片展示。
40. Given 错误卡片展示, when 用户阅读错误, then 卡片必须显示原始错误信息。
41. Given 错误卡片展示, when Conversation View 渲染错误文字, then 错误文字必须使用红色。
42. Given conversation-scoped 错误出现, when Conversation View 渲染 timeline, then 该错误不得伪装成普通 assistant message。
43. Given conversation 数据读取失败或恢复失败, when 错误不属于 conversation timeline, then 该错误不得作为 timeline item 展示。
44. Given conversation 成功完成, when Conversation View 展示最终 timeline, then 不得显示额外完成横幅或 done 提示。
45. Given timeline item 包含时间数据, when Conversation View 渲染消息、工作痕迹或错误, then 不得显示时间戳。
46. Given Conversation View 展示当前 thread, when 用户阅读界面, then 不得提供搜索、筛选或 item 跳转控件。
47. Given Conversation View 展示当前 thread, when 用户阅读界面, then 不得提供手动刷新、重试、取消、approval 或发送控件。
48. Given `Pending interaction` 或 approval 与当前 `Conversation` 相关, when 页面组合展示这些操作, then 它们可以视觉相邻但不得进入 Conversation View timeline。
49. Given 工作痕迹 item 展示, when 用户查看卡片, then Conversation View 不需要提供专门复制按钮。
50. Given assistant 或用户消息很长, when Conversation View 渲染消息, then 不得套用工作痕迹的 30 行截断规则。
51. Given workspace 文件引用被视觉区分, when 用户点击或查看该引用, then Conversation View 不负责打开本地文件。
52. Given 系统没有提供某种 Codex 语义, when Conversation View 渲染 timeline, then Conversation View 不得自行发明该语义。
53. Given 系统提供新的 item type 或新字段, when Conversation View 无专门展示样式, then 必须通过未知 item 或字段列表保持可观察。
54. Given 多页签同时观察同一 thread, when Conversation View 接收更新, then 最终展示必须以系统确认后的 conversation 内容为准。
55. Given conversation 内容为空但读取成功, when Conversation View 展示空状态, then 不得把空状态表现为错误。

## 边界情况和错误处理

1. 空 thread：显示明确空状态，让用户区分没有 conversation 和加载失败。
2. 加载中或恢复中：显示加载或恢复状态，不创建 timeline item。
3. 读取或恢复失败：显示 timeline 外的常规错误状态。
4. 已恢复的进行中 thread：展示历史内容后继续接收和展示后续更新。
5. 已恢复的已完成 thread：展示完整历史 conversation，不额外制造完成提示。
6. 用户消息确认延迟：确认前不进入 timeline。
7. 高频更新：保持进度刷新体验和页面稳定，不要求逐 token 展示。
8. 最终内容到达：展示完整权威内容，不因进度刷新丢失信息。
9. 长工作痕迹：默认折叠，展开后先显示 30 行，并允许继续展开。
10. 长用户消息或 assistant 消息：按 Markdown 正常阅读，不使用工作痕迹截断规则。
11. Markdown 原始 HTML：不作为可信 HTML 执行。
12. 宽 Markdown 表格：横向滚动，不破坏布局。
13. 未知 item type：保留为折叠卡片，展开后展示原始字段。
14. 复杂字段值：以安全、可读文本展示。
15. conversation-scoped 错误：作为 timeline 错误卡片展示原始错误信息。
16. 非 conversation 错误：显示在 timeline 外。
17. 外部链接：在新标签页打开。
18. workspace 文件引用：只做视觉区分，不打开本地文件。
19. 完成状态：不显示额外完成横幅或 done 提示。
20. 时间数据：即使存在也不在 Conversation View 中显示。

## 不在本范围

1. 输入框、消息编辑、发送、重新发送、发送失败 UI 和 optimistic 用户消息。
2. approval 处理、`Pending interaction` 处理、取消、重试和其他操作控件。
3. 手动刷新或手动重新加载当前 thread。
4. conversation 搜索、筛选、item permalink 或跳转。
5. 从 workspace 文件引用打开本地文件。
6. 复杂自动滚动行为，包括底部跟随、用户上滑时不抢滚动和回到底部入口。
7. 虚拟列表、分页、懒加载或大会话性能专项优化。
8. Markdown 代码块语法高亮。
9. 命令输出、diff、工具 payload、未知 item 字段列表或错误卡片的专门复制按钮。
10. 固定空状态文案或 skeleton、shimmer 等加载动画细节。
11. 显示时间戳。
12. 额外完成提示或 done 横幅。
13. 工作痕迹折叠预览，例如命令首行、工具名、变更文件列表或 diff 摘要。
14. Conversation View 自行发明 Codex 没有提供的 conversation 语义。

## 未来计划

1. workspace 文件引用可以点击打开对应本地项目文件，并与外部链接保持不同语义。
2. Conversation View 可以支持更细致的自动滚动体验，包括底部跟随、用户阅读历史时不打断和回到底部入口。
3. 工作痕迹卡片可以显示有用的折叠预览，例如命令首行、工具名、变更文件名或 diff 摘要。
4. Conversation View 可以支持大会话优化，例如虚拟列表、分页或懒渲染。
5. 已完成会话可以使用安全客户端缓存加快首屏展示，同时继续以权威恢复结果修正页面。
6. conversation 搜索、筛选、item 跳转和深链接可以作为独立阅读导航功能设计。
