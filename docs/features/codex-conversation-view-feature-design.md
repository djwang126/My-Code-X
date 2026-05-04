# Feature-Codex Conversation View

Codex Conversation View 是用户在手机或桌面上阅读当前 Codex thread 的核心界面。它负责让用户看见后端确认过的用户消息、assistant message、Codex 原生工作痕迹、会话内错误，以及加载、空状态和恢复状态。

本功能的核心定位是“看”，不是“操作”。Conversation View 不负责输入、发送、重试、approval、pending request、取消任务、手动刷新或打开 workspace 文件。它只忠实呈现后端提供的、来源于 Codex app-server 的权威 conversation 信息，并把这些信息组织成移动端友好的聊天阅读体验。

Conversation View 不发明 Codex 语义。Codex 原生有什么 item、状态、字段、生命周期、结构化标题或更新方式，My-Code-X 就展示什么；Codex 原生没有的语义，My-Code-X 不自行推断、不补全、不拼装。

## 用户故事

1. 作为 My-Code-X 用户，我想在一个界面中看到当前 thread 的用户消息和 assistant message，这样我能按对话顺序理解这一轮工作。
2. 作为 My-Code-X 用户，我希望只有 My-Code-X 后端确认接受后的用户消息才显示在对话中，这样我能区分消息是否真的进入了系统。
3. 作为 My-Code-X 用户，我希望自己的消息显示在右侧，assistant message 显示在左侧，这样界面符合聊天工具的阅读习惯。
4. 作为 My-Code-X 用户，我希望用户消息和 assistant message 都按 Markdown 渲染，这样列表、表格、代码块和链接更容易阅读。
5. 作为 My-Code-X 用户，我希望 Markdown 渲染只支持 Markdown 语义而不执行原始 HTML，这样对话内容不会破坏页面或带来不可信行为。
6. 作为 My-Code-X 用户，我希望 Markdown 代码块用等宽字体展示，这样代码内容容易阅读。
7. 作为 My-Code-X 用户，我希望 Markdown 代码块提供单独复制按钮，这样我可以快速复制代码。
8. 作为 My-Code-X 用户，我希望用户消息和 assistant message 提供整条消息复制按钮，这样我可以快速复用对话内容。
9. 作为 My-Code-X 用户，我希望复制消息和代码块时复制原始文本，而不是复制渲染后的页面样式，这样复制结果可直接使用。
10. 作为 My-Code-X 用户，我希望 Markdown 表格在窄屏上可以横向滚动，这样宽表格不会被挤压到难以阅读。
11. 作为 My-Code-X 用户，我希望普通网页链接在新标签页打开，这样不会打断当前对话阅读。
12. 作为 My-Code-X 用户，我希望 workspace 文件引用与普通网页链接有视觉区分，这样我不会把本地项目文件和外部网页混淆。
13. 作为 My-Code-X 用户，我希望进入一个没有消息的 thread 时看到明确空状态，这样我知道当前不是加载失败。
14. 作为 My-Code-X 用户，我希望打开已有 thread 时看到加载或恢复状态，这样我知道系统正在读取历史 conversation。
15. 作为 My-Code-X 用户，我希望加载或恢复 conversation 失败时看到常规错误信息，这样我知道当前页面无法正常读取会话。
16. 作为 My-Code-X 用户，我希望恢复出的进行中 thread 能继续接收后续 conversation updates，这样我可以从历史恢复后继续看到 Codex 当前进度。
17. 作为 My-Code-X 用户，我希望已完成 thread 恢复后展示完整历史 conversation，这样我可以正常回看过去的对话。
18. 作为 My-Code-X 用户，我希望 Codex 正在工作时能看到内容按进度刷新，这样我知道系统仍在运行，而不需要逐 token 直播式输出。
19. 作为 My-Code-X 用户，我希望弱网、多页签、长输出场景下页面优先保持稳定，这样对话不会因为高频流式更新而卡顿、乱序或闪烁。
20. 作为 My-Code-X 用户，我希望 Codex 完成后能看到完整权威内容，这样低频聚合刷新不会造成信息丢失。
21. 作为 My-Code-X 用户，我希望看到 Codex 原生提供的 hook prompt、计划、推理摘要、命令执行、工具调用、文件变更、网页搜索等工作痕迹，这样 Codex 不像黑盒。
22. 作为 My-Code-X 用户，我希望工作痕迹按 Codex 原生 item 顺序逐条出现在 timeline 中，这样我可以按真实发生顺序理解 Codex 的工作过程。
23. 作为 My-Code-X 用户，我希望工作痕迹作为 Codex 侧内容靠左展示，这样我能把它们理解为 assistant 工作流的一部分，而不是用户消息。
24. 作为 My-Code-X 用户，我希望工作痕迹默认折叠，这样长 stdout、stderr、diff、工具输出和搜索结果不会淹没主要对话。
25. 作为 My-Code-X 用户，我希望展开长工作痕迹时先看到最多 30 行，这样小屏幕阅读不会被超长内容压垮。
26. 作为 My-Code-X 用户，我希望超过 30 行的工作痕迹能提示“展开剩余 xxx 行”，这样我知道还有多少内容可以继续查看。
27. 作为 My-Code-X 用户，我希望能够继续展开被截断的工作痕迹，这样必要时仍能看到完整内容。
28. 作为 My-Code-X 用户，我希望 plan、reasoning、命令、工具、文件变更、网页搜索等工作痕迹展开后按 Codex 原始字段名和值展示，这样我能看到真实数据而不依赖 My-Code-X 理解每个字段。
29. 作为 My-Code-X 用户，我希望工作痕迹卡片标题使用 Codex 原生 item type，这样每个 item 仍然可识别，且不会引入 My-Code-X 自行发明的标题。
30. 作为 My-Code-X 用户，我希望 My-Code-X 不认识的 Codex item type 不会被静默忽略，这样 Codex 升级后新信息仍然可观察。
31. 作为 My-Code-X 用户，我希望未知 item 默认折叠，展开后按 Codex 原始字段名和值展示，并在需要时能看到格式化的复杂 JSON 值，这样我可以看到原始信息而不依赖 My-Code-X 已知类型支持。
32. 作为 My-Code-X 用户，我希望 Codex 聊天过程中产生的错误以聊天卡片形式展示，这样错误不会被隐藏在日志里。
33. 作为 My-Code-X 用户，我希望错误卡片展示原始错误信息，这样我看到的是实际错误而不是 My-Code-X 改写后的解释。
34. 作为 My-Code-X 用户，我希望错误卡片中的错误文字使用红色，这样我能快速识别错误。
35. 作为 My-Code-X 用户，我希望 conversation 内的错误 item 不被伪装成普通 assistant message，这样我能区分正常回答和错误。
36. 作为 My-Code-X 用户，我希望不显示额外的完成提示，这样对话界面保持简洁，不出现 Codex 没有明确表达的状态噪音。
37. 作为 My-Code-X 用户，我希望 Conversation View 不显示每条消息或 item 的时间，这样界面在手机上更简洁。
38. 作为 My-Code-X 用户，我希望 Conversation View 不提供搜索、筛选、跳转、手动刷新等额外控件，这样本轮阅读体验保持聚焦。
39. 作为 My-Code-X 开发者，我希望 Conversation View 的权威信息全部来自 Codex app-server，这样 My-Code-X 不需要维护另一套 conversation 语义。
40. 作为 My-Code-X 开发者，我希望 Codex 原生是同一个 item 更新时，My-Code-X 也更新同一个 item；Codex 原生是多个 item 时，My-Code-X 也展示多个 item，这样数据模型与 Codex 保持一致。
41. 作为 My-Code-X 开发者，我希望后端负责聚合 Codex app-server 的高频原始事件，前端只消费聚合后的 conversation events，这样前端不会被高频流式输出拖垮。
42. 作为 My-Code-X 开发者，我希望后端聚合不改变 Codex 原生语义、不丢失内容、不打乱顺序，这样 Conversation View 展示仍然可信。
43. 作为 My-Code-X 开发者，我希望 pending request 和 approval 可以在视觉上与对话关联，但不由 Conversation View 处理业务逻辑，这样职责边界清晰。


## 功能需求

1. Conversation View 必须把当前 thread 渲染为一条有序的 conversation timeline。
2. Conversation View 必须把后端确认过的用户消息作为正式 timeline item 展示。
3. Conversation View 禁止渲染前端本地 optimistic 用户消息。
4. Conversation View 必须让用户消息靠右展示，assistant message 靠左展示。
5. 工作痕迹 item 必须作为 Codex/assistant 侧内容展示，不能使用用户消息样式。
6. Conversation View 必须把用户消息和 assistant message 渲染为 Markdown。
7. Markdown 渲染禁止把原始 HTML 当作可信页面 HTML 执行或渲染。
8. Markdown 代码块必须使用等宽字体展示，并提供代码块复制按钮。
9. 用户消息和 assistant message 必须提供整条消息复制按钮。
10. 复制消息和代码块时，必须复制原始文本。
11. Markdown 代码块不需要语法高亮。
12. Markdown 表格在窄屏下必须放在可横向滚动的容器中。
13. 普通外部链接必须在浏览器新标签页打开。
14. workspace 文件引用可以与普通外部链接做视觉区分，但本功能不负责打开 workspace 文件。
15. Conversation View 必须提供明确的空状态、加载状态和恢复状态。
16. conversation 恢复失败必须显示为常规的非 conversation 错误状态，不能伪造成 conversation item。
17. 恢复出的进行中 thread 必须继续接收并展示后端提供的后续 conversation updates。
18. 恢复出的已完成 thread 必须展示完整历史 conversation。
19. Conversation View 必须支持后端提供的聚合 conversation events。
20. 前端渲染不要求支持高频 token 级流式输出。
21. 实时更新体验应该像进度刷新，而不是逐 token 直播。
22. 后端聚合必须保留 Codex app-server 的权威性、顺序、item identity 和内容完整性。
23. 如果 Codex/app-server 把更新表示为同一个 item，Conversation View 必须更新同一个 item。
24. 如果 Codex/app-server 把更新表示为多个 item，Conversation View 必须按多个 timeline item 展示。
25. Conversation View 禁止发明 Codex/app-server 没有提供的 item 生命周期、turn 状态、标题、摘要、字段或关系。
26. Conversation View 必须渲染 Codex 提供的工作痕迹 item，包括 hook prompt、计划、推理摘要、命令、工具、文件变更、网页搜索，或包含 stdout、stderr、diff、工具 payload 等内容的其他 app-server 结构。
27. 工作痕迹 item 必须按后端提供的权威顺序逐条展示。
28. 工作痕迹 item 默认必须折叠。
29. 展开后的长工作痕迹内容首次最多显示 30 行。
30. 如果展开后的工作痕迹内容超过 30 行，界面必须显示等价于“展开剩余 xxx 行”的入口。
31. 用户必须能够继续展开被截断的工作痕迹，以查看剩余内容。
32. 工作痕迹 item 不需要专门的复制按钮。
33. 对 Codex 结构化工作痕迹 item，Conversation View 必须使用 Codex 原生 item type 作为卡片标题。
34. 展开工作痕迹 item 后，Conversation View 必须按 Codex 原始 payload 的字段名和值展示字段列表；复杂字段值必须以格式化 JSON 或等价安全文本展示。
35. 未知 item type 禁止被丢弃。
36. 未知 item type 默认必须折叠。
37. 展开未知 item type 后，必须按 Codex 原始 payload 的字段名和值展示字段列表；复杂字段值必须以格式化 JSON 或等价安全文本展示。
38. Codex/app-server 表示为 conversation item 的聊天过程错误，必须作为 timeline 中的错误卡片展示。
39. 错误卡片必须展示原始错误信息。
40. 错误卡片中的错误文字必须使用红色。
41. Conversation View 禁止改写、重新解释或推断原始错误的其他原因。
42. Conversation View 禁止显示额外的完成横幅或“done”提示。
43. Conversation View 本功能中禁止显示消息、工作痕迹、错误或 turn 的时间戳。
44. Conversation View 本功能中禁止提供搜索、筛选、item 跳转、手动刷新、重试、approval、取消或发送控件。
45. pending request 和 approval 的 UI 可以在 Conversation View 外部做视觉相邻或关联，但业务逻辑不属于 Conversation View。


## 边界情况和错误处理

1. 空 thread：显示明确空状态，让用户能区分真正没有 conversation 和加载失败。
2. 加载或恢复 thread：读取权威 conversation 时显示明确的加载或恢复状态。
3. 恢复失败：在 conversation timeline 外显示普通页面或区域错误状态；不要伪造 Codex 错误 item。
4. 恢复出的进行中 thread：继续消费后端后续 conversation updates，并按 Codex 原生 item/update 方式展示。
5. 恢复出的已完成 thread：展示恢复出的完整历史 conversation，不额外制造完成提示。
6. 后端确认用户消息延迟：后端确认前，不把用户消息显示进 timeline。
7. Codex 高频输出：前端消费后端聚合后的 events，不要求 token 级渲染。
8. 弱网或多页签：优先保证稳定的进度刷新体验和完整最终内容，而不是高频实时渲染。
9. 长 stdout、stderr、diff、工具输出、搜索输出或类似工作痕迹：默认折叠；展开后先显示 30 行；通过“展开剩余 xxx 行”查看剩余内容。
10. 长 assistant/user Markdown 消息：正常按 Markdown 阅读，不套用 30 行工作痕迹截断规则。
11. Markdown 中的原始 HTML：不执行、不信任为 HTML；只安全处理 Markdown 语义。
12. 宽 Markdown 表格：提供横向滚动，不强行换行到不可读，也不破坏布局。
13. 未知 Codex item type：保留为折叠卡片；展开后按原始字段名和值展示，复杂值使用格式化 JSON。
14. 工作痕迹和未知 item 的卡片标题使用 Codex 原生 item type，不自行生成语义标题。
15. Codex/app-server 错误 item：渲染为错误卡片，显示原始错误信息，错误文字为红色。
16. 非 conversation 基础设施错误：显示为 timeline 外的常规 UI 错误状态。
17. 外部链接：在新标签页打开。
18. workspace 文件引用：尽可能视觉区分，但本功能不打开本地文件。
19. 工作痕迹复制：不需要专门复制按钮；浏览器自然文本选择可以保留。
20. 完成状态：即使 turn 成功结束，也不增加额外完成提示或横幅。
21. 后端存在时间戳数据：本功能不显示。
22. Codex schema 演进：未知新 item type 通过通用字段列表和复杂字段的格式化 JSON 保持可观察，不隐藏。


## 不在本范围

1. 输入框、消息编辑、发送行为、重新发送、发送失败 UI 和 optimistic 用户消息。
2. approval 处理、pending request 处理、取消、重试和其他操作控件。
3. 手动刷新或手动重新加载当前 thread。
4. conversation 搜索、筛选、item permalink 或跳转到指定 turn/message/item。
5. 从文件引用打开 workspace 文件。
6. 复杂自动滚动行为，包括“在底部时跟随滚动”“用户上滑时不抢滚动”和“回到底部”按钮。
7. 虚拟列表、分页、懒加载或大会话性能专项优化。
8. Markdown 代码块语法高亮。
9. 命令输出、stdout、stderr、diff、工具 payload、未知 item 字段列表或错误卡片等内容的专门复制按钮。
10. 固定空状态文案或 skeleton/shimmer 加载动画细节。
11. 显示时间戳。
12. 额外完成提示或 done 横幅。
13. 工作痕迹折叠预览，例如命令首行、工具名、变更文件列表或 diff 摘要。
14. 任何 Codex/app-server 没有提供、由 My-Code-X 自行发明的 conversation 语义。

## 未来计划

1. workspace 文件引用可以点击打开对应本地项目文件，并与外部链接保持不同语义。
2. Conversation View 可以支持更细致的自动滚动体验，包括底部跟随、用户阅读历史时不打断、回到底部入口。
3. 工作痕迹卡片可以显示有用的折叠预览，例如从原始字段中挑选命令首行、工具名、变更文件名或 diff 摘要；该预览必须作为独立设计处理。
4. Conversation View 可以支持大会话优化，例如虚拟列表、分页或懒渲染。
5. 已完成会话可以使用安全客户端缓存加快首屏展示，同时后台继续做权威恢复。
6. 多页签和弱网行为可以在后端事件聚合之外继续专项优化。
7. conversation 搜索、筛选、item 跳转和深链接可以作为独立阅读导航功能设计。
