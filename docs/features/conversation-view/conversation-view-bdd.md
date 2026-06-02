# Feature: Conversation View BDD

`Conversation View` 让产品用户通过移动端友好的界面阅读当前 `agent cli` 对话、理解工作过程、继续输入、追加指令或中断当前工作。

本文档描述 `Conversation View` 自身的可验收行为。选中对话、取消选中对话、`agent cli` 切换、具体 `agent cli` 原生事件解析规则由其他功能或 adapter 提供。

## 背景

产品用户的电脑持续运行 `My-Code-X` 后端。后端调用同一台电脑上的 `agent cli`，产品用户可以通过手机、其他电脑或同一电脑上的前端连接后端，并与 `agent cli` 对话。

`Conversation View` 消费当前选中对话状态、对话内容、连接状态、恢复状态、发送结果和当前 `agent cli` 能力信息。它不负责创建、选择或取消选择对话。

`Conversation View` 使用四类产品内部信息分类决定渲染方式：

- 普通对话内容
- 工作过程信息
- 失败信息
- 未识别信息

四类信息分类不是用户可见文案。用户可见的 type、status、message 和错误内容默认沿用 `agent cli` 原生内容。只有当失败信息没有可展示 message 时，最终兜底文案可以使用 `Unknown error`。

`turn` 边界由当前 `agent cli` 提供的 turn 相关信息决定。`Conversation View` 不自行推断 turn 边界。

## Conversation View Shell

### Scenario: 没有选中对话时展示首屏状态

Given 当前没有选中对话
When 产品用户打开 `Conversation View`
Then 页面展示无选中对话提示
And 消息阅读区域不展示任何对话消息
And Composer 仍然显示
And Composer 发送能力被禁用
And Composer 不绑定任何对话 draft

### Scenario: 展示当前选中对话的上下文

Given 当前选中对话存在标题和所在目录
When 产品用户打开 `Conversation View`
Then 顶部上下文区域展示当前对话标题
And 顶部上下文区域展示当前对话所在目录
And 顶部区域两侧展示占位按钮

### Scenario: 对话标题缺失时不展示占位文案

Given 当前选中对话缺少标题
And 当前选中对话存在所在目录
When 产品用户打开 `Conversation View`
Then 顶部上下文区域不展示标题字段
And 顶部上下文区域展示所在目录
And 页面不使用占位标题文案

### Scenario: 对话目录缺失时不展示占位文案

Given 当前选中对话存在标题
And 当前选中对话缺少所在目录
When 产品用户打开 `Conversation View`
Then 顶部上下文区域展示标题
And 顶部上下文区域不展示所在目录字段
And 页面不使用占位目录文案

### Scenario: 初次打开有内容的对话时定位到底部

Given 当前选中对话已有可读内容
When 产品用户首次打开该对话
Then 页面定位到消息列表底部
And 产品用户可以看到最新内容

### Scenario: 正在恢复且没有可读内容

Given 当前选中对话正在恢复内容
And 页面还没有任何可读内容
When 产品用户打开 `Conversation View`
Then 页面展示恢复中提示

### Scenario: 恢复成功但没有可展示内容

Given 当前选中对话内容恢复成功
And 恢复结果没有任何可展示内容
When 产品用户打开 `Conversation View`
Then 页面展示无可展示内容提示
And 页面不把空内容展示为失败

### Scenario: 恢复失败且没有可读内容

Given 当前选中对话恢复失败
And 页面没有任何可读内容
When 产品用户打开 `Conversation View`
Then 页面展示恢复失败提示
And 页面帮助产品用户判断是否需要等待或重试

### Scenario: 已有内容可读时同步状态非阻塞展示

Given 当前选中对话已有可读内容
And 当前内容正在同步、重连或无法确认最新
When 产品用户查看 `Conversation View`
Then 页面保留已有可读内容
And 页面使用 banner 展示同步、重连或内容可能过期提示
And banner 不阻断产品用户继续阅读

## Conversation Information Rendering

### Scenario: 按发生顺序展示对话信息

Given 当前选中对话收到多条信息
And 这些信息分别属于普通对话内容、工作过程信息、失败信息或未识别信息
When 页面渲染消息列表
Then 页面按这些信息的发生顺序展示
And 页面使用不同视觉样式区分不同产品内部分类

### Scenario: 普通对话内容直接展示

Given 当前选中对话收到产品用户输入
And 当前选中对话收到 `agent cli` 回复
When 页面渲染消息列表
Then 产品用户输入作为普通对话内容展示
And `agent cli` 回复作为普通对话内容展示
And 普通对话内容不默认折叠
And 普通对话内容不展示调试字段

### Scenario: 工作过程信息默认折叠

Given 当前选中对话收到被 adapter 映射为工作过程的信息
And 该信息包含 `agent cli` 原生 type
And 该信息包含 `agent cli` 原生 status
When 页面渲染消息列表
Then 页面展示一条工作过程信息摘要
And 摘要优先展示原生 type 和原生 status
And 该信息默认折叠
And 产品用户可以展开查看详细内容

### Scenario: 展开工作过程详情时阅读位置稳定

Given 产品用户正在查看消息列表中的一条工作过程信息
When 产品用户展开该工作过程信息详情
Then 页面展示该信息的通用字段或结构化内容
And 产品用户的浏览位置不应突然跳动到其他消息

### Scenario: 工作过程展开状态在对话打开期间保持

Given 产品用户已展开一条工作过程信息
When 页面收到 live update
Then 该工作过程信息保持展开

When 产品用户滚动消息列表后回到该工作过程信息
Then 该工作过程信息仍保持展开

### Scenario: 未识别信息不丢失

Given 当前选中对话收到 adapter 暂时不能专门理解的信息
When 页面渲染消息列表
Then 页面展示该未识别信息
And 该信息不被当作失败信息展示
And 该信息不阻断产品用户继续阅读
And 该信息不阻断产品用户继续输入

### Scenario: 未识别信息可展开排查

Given 当前选中对话收到未识别信息
And 该信息包含通用字段
When 页面渲染消息列表
Then 该信息默认紧凑展示
And 产品用户可以展开查看通用字段内容
And 如果该信息有原生 status，页面展示该原生 status

### Scenario: 失败信息按发生位置展示

Given 当前选中对话收到来自 `agent cli` 的失败信息
When 页面渲染消息列表
Then 页面在该失败发生的位置展示失败信息
And 失败信息不伪装成 `agent cli` 普通回复
And 失败信息不默认折叠
And 失败信息比普通信息更醒目

### Scenario: 失败信息展示原生 message

Given 当前选中对话收到来自 `agent cli` 的失败信息
And 该失败信息包含原生 message
When 页面渲染该失败信息
Then 页面优先展示原生 message
And 页面可以使用通用字段展示排查信息

### Scenario: 失败信息缺少 message 时使用兜底文案

Given 当前选中对话收到来自 `agent cli` 的失败信息
And 该失败信息没有可展示 message
When 页面渲染该失败信息
Then 页面展示 `Unknown error`
And 页面仍然可以使用通用字段展示排查信息

### Scenario: 多条失败信息都应展示

Given 当前选中对话连续收到多条失败信息
When 页面渲染消息列表
Then 页面展示收到的每条失败信息
And 页面不应用通用产品规则把多条失败信息合并为一条

## Message Reading

### Scenario: Markdown 内容可读

Given 当前选中对话包含普通文本内容
And 普通文本内容包含 Markdown
When 页面渲染该消息
Then 产品用户可以按 Markdown 格式阅读该内容

### Scenario: 代码块支持窄屏阅读和复制

Given 当前选中对话的一条普通消息包含代码块
When 页面渲染该消息
Then 代码块展示在横向滚动容器中
And 代码块右上角展示复制按钮

When 产品用户点击代码块复制按钮
Then 页面复制该代码块内容

### Scenario: 表格支持窄屏阅读

Given 当前选中对话的一条普通消息包含 Markdown 表格
When 页面渲染该消息
Then 表格正常展示
And 宽表格展示在横向滚动容器中

### Scenario: Markdown 外链可以打开

Given 当前选中对话的一条普通消息包含 Markdown 外链
When 页面渲染该消息
And 产品用户点击该外链
Then 页面打开该外链

### Scenario: 非外链不作为本功能处理

Given 当前选中对话的一条普通消息包含相对链接或本地文件引用
When 页面渲染该消息
Then 页面不提供完整文件浏览能力
And 页面不把相对链接或本地文件引用当作本功能必须打开的外链处理

### Scenario: 正在输出的回复持续更新

Given 当前选中对话中 `agent cli` 正在输出一条回复
When 页面收到该回复的增量内容
Then 页面更新当前回复内容
And 页面表现该回复仍处于进行中状态

When 页面收到该回复完成状态
Then 页面展示最终回复内容
And 页面不再把该回复表现为进行中

## Turn Toolbar

### Scenario: 已完成 turn 展示工具栏

Given 当前 `agent cli` 提供一个已完成 turn
And 该 turn 包含至少一条产品用户输入
And 该 turn 包含至少一条 `agent cli` 回复
When 页面渲染该 turn
Then 页面在该 turn 第一条产品用户消息下方展示工具栏
And 页面在该 turn 最后一条 `agent cli` 消息下方展示工具栏
And 工具栏展示绝对时间

### Scenario: 进行中的 turn 展示工具栏

Given 当前 `agent cli` 提供一个进行中的 turn
And 该 turn 包含至少一条产品用户输入
When 页面渲染该 turn
Then 页面在该 turn 第一条产品用户消息下方展示工具栏

### Scenario: 用户消息工具栏复制该 turn 首条用户输入原文

Given 当前 `agent cli` 提供一个已完成 turn
And 该 turn 的第一条产品用户输入包含 Markdown 原文
When 产品用户点击该用户消息工具栏中的复制按钮
Then 页面复制该 turn 第一条产品用户输入的 Markdown 原文

### Scenario: Agent 消息工具栏复制该 turn 最后一条回复原文

Given 当前 `agent cli` 提供一个已完成 turn
And 该 turn 的最后一条 `agent cli` 回复包含 Markdown 原文
When 产品用户点击该 `agent cli` 消息工具栏中的复制按钮
Then 页面复制该 turn 最后一条 `agent cli` 回复的 Markdown 原文

### Scenario: 进行中的 turn 不展示工具栏

Given 当前 `agent cli` 提供一个进行中的 turn
When 页面渲染该 turn
Then 页面不展示该 turn 的 turn 工具栏

## Live Update

### Scenario: 新信息进入消息列表

Given 当前选中对话正在工作
When 页面收到新的对话信息
Then 页面把新信息展示到消息列表中
And 已有信息顺序保持稳定

### Scenario: 已有信息被后续进展更新

Given 页面已经展示一条进行中的信息
When 页面收到该信息的后续进展
Then 页面更新原有信息

### Scenario: 用户查看旧内容时不强制滚动到底部

Given 产品用户正在查看消息列表中的旧内容
And 当前滚动位置不在底部
When 页面收到新信息
Then 页面不强制把产品用户拉到底部
And 产品用户当前阅读位置保持稳定

### Scenario: 用户在底部时自然跟随新内容

Given 产品用户当前正在消息列表底部阅读
When 页面收到新信息
Then 页面可以自然跟随新内容
And 产品用户可以看到最新内容

### Scenario: 重连后恢复内容并继续接收更新

Given 当前选中对话正在工作
And app 因弱网、切后台或连接中断失去 live update
When app 重新连接后
Then 页面尽量恢复到当前最新内容与状态
And 页面继续接收后续更新
And 如果无法确认内容最新，页面展示非阻塞提示

## Conversation View Notice

### Scenario: 无法归属到具体对话的错误展示为页面提示

Given `My-Code-X` 收到无法归属到具体对话的 `agent cli` 错误
When 产品用户查看 `Conversation View`
Then 页面使用 banner 展示该错误
And 该错误不插入消息列表

### Scenario: My-Code-X 自身错误展示为页面提示

Given `My-Code-X` 自身发生页面级错误
When 产品用户查看 `Conversation View`
Then 页面使用 banner 展示该错误
And banner 不为每种错误类型设计专门视觉

### Scenario: 一次性 banner 在配置时长后自动消失

Given 页面展示一个一次性 banner
And 一次性 banner 自动消失时长配置为 `T`
When 该 banner 已展示超过 `T`
Then 页面自动收起该 banner

### Scenario: 持续状态 banner 在状态恢复前不自动消失

Given 页面展示一个持续状态 banner
And 该持续状态尚未恢复
When 时间经过一次性 banner 的自动消失时长
Then 页面仍然展示该持续状态 banner

When 该持续状态恢复
Then 页面收起该持续状态 banner

### Scenario: 多个 banner 垂直堆叠

Given 页面同时存在多个 banner
When 产品用户查看 `Conversation View`
Then 多个 banner 垂直堆叠展示

## Composer

### Scenario: Composer 按对话保存 draft

Given 当前选中对话为对话 A
When 产品用户在 Composer 中输入文本 `draft A`
Then Composer 为对话 A 保存 `draft A`

When 外部功能把当前选中对话切换为对话 B
And 产品用户在 Composer 中输入文本 `draft B`
Then Composer 为对话 B 保存 `draft B`

When 外部功能把当前选中对话切换回对话 A
Then Composer 恢复展示对话 A 的 `draft A`

### Scenario: 空文本不能发送

Given 当前选中对话可以继续输入
And Composer 内容为空
When 产品用户查看 Composer
Then Composer 不允许发送普通输入

### Scenario: 空闲时发送普通输入

Given 当前选中对话可以继续输入
And 当前 `agent cli` 处于空闲状态
And Composer 中有产品用户输入原文
When 产品用户点击主操作按钮
Then Composer 发送普通输入请求
And 发送请求携带当前输入原文
And 发送请求不删改产品用户原始输入

### Scenario: 发送请求被接受后清空当前对话 draft

Given 当前选中对话可以继续输入
And Composer 中有产品用户输入原文
When 产品用户发送普通输入
And 发送请求被接受
Then Composer 清空当前对话 draft
And Composer 不把未被确认的输入伪装成已经进入消息列表的正式内容

### Scenario: 发送请求失败时保留当前对话 draft

Given 当前选中对话可以继续输入
And Composer 中有产品用户输入原文
When 产品用户发送普通输入
And 发送请求失败
Then Composer 保持当前对话 draft 不变
And 页面展示非阻塞错误提示

### Scenario: 工作中有输入时发送补充指令

Given 当前选中对话正在工作
And 当前 `agent cli` 支持工作中追加指令
And Composer 中有产品用户输入原文
When 产品用户点击主操作按钮
Then Composer 发送补充指令请求
And 发送请求携带当前输入原文
And 发送请求不删改产品用户原始输入

### Scenario: 工作中无输入时中断当前工作

Given 当前选中对话正在工作
And 当前 `agent cli` 支持中断当前工作
And Composer 内容为空
When 产品用户点击主操作按钮
Then 页面展示中断确认 modal

When 产品用户在 modal 中二次确认
Then Composer 发送中断当前工作请求

### Scenario: 不支持的 Composer 动作自然降级

Given 当前选中对话正在工作
And 当前 `agent cli` 不支持追加指令或中断当前工作
When 产品用户查看 Composer
Then 不支持的动作在 UI 上禁用或隐藏
And `My-Code-X` 不模拟该动作

### Scenario: 目标状态不明确时禁用发送

Given 当前选中对话存在
And 内容正在恢复、连接不可用或目标状态不明确
When 产品用户查看 Composer
Then Composer 保留当前对话 draft
And Composer 禁用发送

### Scenario: 没有选中对话时 Composer 不绑定 draft

Given 当前没有选中对话
When 产品用户查看 Composer
Then Composer 显示但发送禁用
And Composer 不绑定任何对话 draft

## Non-Functional Acceptance

### Scenario: 长对话在移动端保持可阅读

Given 当前选中对话包含数百条消息
And 这些消息包含 reasoning、工具结果、代码块、表格和普通回复
When 产品用户在移动端阅读 `Conversation View`
Then 页面不应出现明显卡顿或内存压力
And 产品用户可以继续滚动阅读

### Scenario: 流式增量更新不造成整列表重排

Given 当前选中对话正在流式输出
When 页面频繁收到当前回复的增量内容
Then 页面更新当前回复内容
And 页面不应因为每次增量更新造成整列表重排

### Scenario: 发送输入时文本编码保持完整

Given 产品用户发送的输入包含 UTF-8、CJK 或 emoji 字符
When Composer 发送该输入
Then 发送请求携带的原文保持字符不损坏

### Scenario: 渲染回复时文本编码保持完整

Given `agent cli` 回复包含 UTF-8、CJK 或 emoji 字符
When 页面渲染该回复
Then 页面展示的内容保持字符不损坏

## Out of Scope

- 创建、选中、取消选中对话。
- `agent cli` 能力重设计。
- `Pending interaction` 的处理与展示。
- codex `plan` 的处理。
- 图片展示/输入。
- 文件引用点击后的完整文件浏览能力。
- `agent cli` 的选择与切换。
- 不同 `agent cli` 之间展示文案的统一。
- 鉴权与传输安全。
