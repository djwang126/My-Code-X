# Feature-Conversation View

Conversation View 是 My-Code-X 的核心移动端工作界面。它让用户在手机上阅读当前 Codex 工作现场，理解 Codex 正在做什么，并继续输入、纠偏或处理中断后的状态。

Conversation View 不重新设计 Codex agent 能力。它的目标是把 Codex 的对话内容、工作过程、失败信息和其他可见信息，以适合手机阅读和操作的方式呈现出来。

## Feature Capabilities

### Conversation View shell

Conversation View shell 是承载当前工作现场的主界面。它包含阅读区域、当前上下文提示、页面状态和底部输入区域。

Functional Requirements:

- 页面展示当前选中 Codex `Thread` 的可读内容。
- 页面按发生顺序展示用户和 Codex 之间产生的信息。
- 页面支持没有选中 `Thread` 的状态。
- 页面支持内容恢复中、内容为空、读取失败和内容可能不是最新的状态。
- 页面支持在已有内容上继续接收新信息。
- 页面在阅读区域外展示不适合插入 timeline 的提示或错误。

UX Decisions:

- 页面主体采用单列垂直布局，适合手机阅读。
- 顶部保留轻量上下文区域，让用户知道当前正在看哪个工作现场。
- 顶部区域显示当前选中 Codex `Thread`的标题与所在目录。
- 顶部区域两侧显示两个按钮（不实现实际意义，后续功能需要，UI提前设计）。
- 底部保留输入区域，让用户可以随时继续当前工作。
- 页面状态不应让用户误以为 Codex 已经失败，除非确实需要用户处理失败。
- 已有内容可读时，新的同步、重连或状态提示应非阻塞展示。
- 每轮对话的第一条用户消息和最后一条Codex消息下方都有工具栏，用于放置时间信息，复制按钮以及未来的扩展功能按钮。
- 用户可以复制对应的第一条用户输入原文。
- 用户可以复制对应的的最后一条 Codex 回复原文。
- 正在恢复且没有可读内容时，页面展示恢复中相关提示。
- 恢复成功但没有可展示内容时，页面展示无可展示内容相关提示。
- 恢复失败且没有可读内容时，页面展示恢复失败相关提示。
- 已有内容可读但正在同步、重连或无法确认最新时，页面保留原有内容并展示非阻塞提示。
- 没有选中 Codex `Thread` 时，页面展示无选中相关提示（即app首屏信息）。
- 页面状态帮助用户判断自己能否继续阅读、是否需要等待、是否可以重试。
- my-code-x自身的同步中、重新连接或内容可能过期等提示使用toast或弹窗等形式的轻提示。
- 所有用户输入信息与Codex信息，My-code-x不额外添加自创文案。一切解释性内容，如类型标签，错误message等，全部沿用Codex已有信息。

### Typed conversation information

Conversation View 需要把用户接收到的信息分类型展示。不同信息对用户的意义不同：普通对话内容用于阅读，工作过程用于理解 Codex 正在做什么，失败信息用于排查和决策，未知信息用于保证新类型内容不丢失。

Functional Requirements:

- 页面至少区分以下四类信息：
  - 普通对话内容：用户输入和 Codex 回复。
  - 工作过程信息：计划、工具调用、工具结果、文件变更、网页搜索等 Codex 工作痕迹。
  - 失败信息：当前工作中发生，来自Codex的明确失败。
  - 未识别信息：My-Code-X 暂时不能专门理解，但仍应让用户看到的内容。
- 不同类型的信息有清晰的视觉区分。
- 信息类型不应只依赖文本内容猜测；用户看到的分类稳定、可解释。
- 未识别信息不能被静默丢弃。
- 失败信息比普通信息更醒目。

UX Decisions:

- 普通对话内容是 timeline 的最高阅读优先级。
- 工作过程与未知信息默认紧凑展示，可展开查看细节。
- 未识别信息使用轻微提醒样式，表达“可排查但不一定是错误”。
- 普通对话内容和失败信息直接展开展示，不具备折叠能力。
- 类型样式应帮助用户快速扫读，而不是增加调试噪音。
- 类型标签、边框、颜色、间距和图标由 UI 设计决定，但保持四类信息的可区分性。

### Message reading

Message reading 负责展示用户输入和 Codex 回复，让主对话内容在手机端清晰、可读、可复制。

Functional Requirements:

- 用户的文字输入作为普通对话内容展示。
- Codex 的文字回复作为普通对话内容展示。
- Codex 正在输出时，页面可以更新当前回复内容。
- Codex 最终回复完成后，页面展示最终内容。
- 普通文本内容支持 Markdown阅读。
- 代码块可以正常展示。
- 表格可以正常展示。
- Markdown 链接可以点击打开。
- 用户可以复制单个代码块内容。

UX Decisions:

- 用户输入和 Codex 回复需要视觉上可区分。
- Message 使用文本块布局，优先保证阅读舒适度。
- Message 不展示调试字段。
- 复制入口是次要操作，不应干扰正文阅读。
- 代码块使用适合窄屏阅读的排版，使用横向滚动容器。
- 代码块右上角提供复制按钮。
- 宽表格使用横向滚动容器。

### Work progress reading

Work progress reading 让用户理解 Codex 正在做什么。它覆盖计划、工具调用、工具结果、文件变更、网页搜索等工作过程信息。

Functional Requirements:

- Codex 工作过程中的重要痕迹可以展示。
- 工作过程信息能表达来源或大致类型，例如计划、命令、工具、搜索、文件变更等。
- 工作过程信息可以显示状态，例如进行中、完成、失败或其他上游提供的状态。
- 复杂内容以安全、可读的形式展示。
- 工作过程信息默认不为每种来源设计专门 UI。
- 用户可以展开查看更详细内容。
- 展开细节后，用户的浏览位置不应突然跳动。
- 当前已知类型，并识别为Work progress reading的thread item[hookPrompt, reasoning, commandExecution, fileChange, mcpToolCall, dynamicToolCall, collabAgentToolCall, webSearch, imageView, imageGeneration, enteredReviewMode, exitedReviewMode, contextCompaction]
- 当前已知类型，不作为Work progress reading的thread item[plan]

UX Decisions:

- 摘要优先显示Codex 传递的类型和状态。
- 详情区域使用通用字段或结构化内容展示。

### Unknown information fallback

Unknown information fallback 用于处理 My-Code-X 暂时不能专门理解的信息。目标是不丢内容，并让用户有能力排查。

Functional Requirements:

- My-Code-X 遇到暂时不能专门理解的信息时，仍然展示。
- 未识别信息用通用方法渲染其字段。
- 未识别信息如果有状态，应展示状态。
- 未识别信息不应被当作失败信息展示。
- 未识别信息不应阻断用户继续阅读或继续输入。
- 用户可以展开查看通用字段内容。

UX Decisions:

- 未识别信息使用轻微警示但非错误的视觉样式。
- 未识别信息的设计目标是“不丢信息”和“可排查”。
- 未识别信息默认紧凑展示。

### Failure reading

Failure reading 让用户理解Codex在当前工作中哪里失败了、失败原因是什么。

Functional Requirements:

- Codex 工作过程中归属于Codex Thread的异常信息，展示为失败信息。
- 这类失败信息保留在 timeline 中，以表达它发生在当前工作过程里的具体位置。
- 失败信息展示用户可理解的失败原因。
- 如果同一个失败被上游重复报告，页面不应明显重复干扰用户。
- 失败信息不应伪装成 Codex 普通回复。
- 失败信息不默认折叠。
- 失败信息不需要为每种错误类型设计专门 UI。

UX Decisions:

- 失败信息使用明确错误样式。
- 失败信息优先展示错误 message。
- 失败信息可以使用通用字段展示排查信息。
- 失败信息与普通 Codex 输出明显区分。

### Conversation View notice

Conversation View notice 用于展示不适合放入 timeline 的提示、错误或警告。

Functional Requirements:

- 无法归属到具体Thread的Codex错误，或My-Code-X自身错误，作为页面提示展示。

UX Decisions:

- 页面提示默认使用 banner 轻提示。
-  banner在短时间后自动收起消失。
-  banner内容使用通用样式，不为每种错误类型设计专门视觉。

### Live update

Live update 让用户在 Codex 工作进行中持续看到新内容，并保持手机端阅读稳定。

Functional Requirements:

- Codex 工作期间，页面持续接收并展示新的信息。
- 已有信息可以被后续进展更新。
- 更新过程中，已有信息的顺序应保持稳定。
- 正在生成的内容应能表现为进行中状态。
- 内容完成后，页面展示最终内容。
- 弱网、切后台或重连后，页面应尽量恢复到当前最新内容与状态，并继续接收后续更新。
- Live update 需要保持弱网下的良好性能，保持体验的同时尽可能优化性能。

UX Decisions:

- 新内容进入 timeline 时，应尽量保持用户当前阅读位置稳定。
- 如果用户正在查看旧内容，新内容不应强制把用户拉到底部。
- 如果用户已经在底部阅读，页面可以自然跟随新内容。
- 当前进行中的信息可以使用轻量动态状态。
- live 更新应强调连续性，不应制造过多闪烁或跳动。

### Composer

Composer 是 Conversation View 底部的用户输入区域。它让用户继续当前 Codex 工作、补充上下文、或在需要时中断当前工作。

Functional Requirements:

- Composer 绑定当前选中的 Codex `Thread`。
- Composer 保存当前输入草稿。
- 用户可以输入多行文本。
- 空文本不能发送。
- 当前可以继续输入时，用户可以发送普通输入
- 不对用户原始输入进行任何删改。
- 当前 Codex 正在工作时，用户可以发送补充指令信息。
- 当前 Codex 正在工作时，用户可以中断当前工作。
- 发送请求被接受后，Composer 清空已发送草稿。
- 发送请求失败时，Composer 保持原草稿不变。
- 发送失败、连接异常或输入暂时不可用时，页面展示非阻塞错误提示。
- 当前没有选中 `Thread`、内容正在恢复、连接不可用或目标状态不明确时，Composer 保留草稿但禁用发送。
- Composer 不把未被确认的输入伪装成已经进入 timeline 的正式内容。
- 中断当前工作是高影响动作，需要防误触处理。

UX Decisions:

- Composer 适配移动端 safe area 和软键盘。
- Composer 使用移动端友好的多行输入框。
- 输入框默认低高度，随内容增长到最大高度。
- 超过最大高度后，输入框内部滚动。
- 主操作按钮固定在 Composer 右侧，保持单手可达。
- 根据当前 Codex 空闲或正在工作的状态切换，以及用户的输入内容的，主操作按钮功能与按钮样式切换。
- 具体来说，Codex空闲时，按钮为发送；Codex工作时，若用户无输入内容，则按钮为中断，Codex工作时，若用户有输入内容，则按钮为追加。

## Out of Scope

- Codex agent 能力重设计。
- `Pending interaction` 的完整处理流程。
- 历史恢复的数据权威来源设计。
- 文件引用点击后的完整文件浏览能力。

## Future Plans

- 文件引用链接

## Reference

[conversation-view-UImock.html](./conversation-view-UImock.html)  UImock只体现界面样式与布局，不代表任何代码设计，领域定义，以及实现细节。
