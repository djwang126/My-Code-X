# Feature: Conversation View BDD

`Conversation View` 让产品用户通过移动端友好的界面阅读当前 `agent cli` 对话、理解工作过程、继续输入、追加指令或中断当前工作。

`Conversation View` 不重新设计 `agent cli` 能力。它的目标是把 `agent cli` 的对话内容、工作过程、失败信息和其他可见信息，以适合手机阅读和操作的方式呈现出来。

`agent cli` 是 `My-Code-X` 当前对接的 cli 形态 agent 的统称，包括但不限于 codex 和 claude code。相关产品决策默认适用于所有 `agent cli`。

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

UI标准由 UImock 提供，UImock 只体现界面样式与布局，不代表任何代码设计、领域定义或实现细节。[conversation-view-UImock.html](./conversation-view-UImock.html)：

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
And 普通对话内容不可折叠

### Scenario: 工作过程信息默认折叠

Given 当前选中对话收到被 adapter 映射为工作过程的信息
And 该信息包含 `agent cli` 原生 type
And 该信息包含 `agent cli` 原生 status
When 页面渲染消息列表
Then 页面展示一条工作过程信息摘要
And 摘要优先展示原生 type 和原生 status
And 该信息默认折叠
And 产品用户可以展开查看详细内容

### Scenario: 工作过程信息缺少原生 type 或 status 时降级展示

Given 当前选中对话收到被 adapter 映射为工作过程的信息
And 该信息缺少原生 type 或原生 status
When 页面渲染消息列表
Then 摘要展示可用字段
And 缺失字段不使用占位文案

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
And 用户消息工具栏展示该 turn 用户输入时间
And agent 消息工具栏展示该 turn 最后回复完成时间

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

### Scenario: 进行中的 turn 不展示 agent 回复侧工具栏

Given 当前 `agent cli` 提供一个进行中的 turn
And 该 turn 的 `agent cli` 回复尚未完成
When 页面渲染该 turn
Then 页面不在 agent 回复下方展示工具栏
And 页面在该 turn 第一条产品用户消息下方仍展示工具栏

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

### Scenario: Composer 支持多行输入

Given 当前选中对话可以继续输入
When 产品用户在 Composer 中输入多行文本
Then Composer 保留产品用户输入中的换行
And Composer 使用多行输入框展示该输入
And 输入框随内容增长到最大高度
And 输入超过最大高度后，输入框内部滚动

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
And Composer 在等待发送结果期间禁用重复发送

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
And Composer 在等待发送结果期间禁用重复发送

### Scenario: 工作中无输入时中断当前工作

Given 当前选中对话正在工作
And 当前 `agent cli` 支持中断当前工作
And Composer 内容为空
When 产品用户点击主操作按钮
Then 页面展示中断确认 modal

When 产品用户在 modal 中二次确认
Then Composer 发送中断当前工作请求

When 产品用户在 modal 中取消
Then 页面关闭 modal
And Composer 状态不变
And 不发送中断请求

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

## Multiple Connections

多个前端实例（不同设备、不同 tab）可以同时连接同一个后端。所有连接对等，不引入会话独占或"活跃设备"概念。

### Scenario: 多个前端同时接收 live update

Given 产品用户在设备 A 和设备 B 同时打开同一个对话
And 当前选中对话正在工作
When 页面收到新的对话信息
Then 设备 A 和设备 B 都收到该 live update
And 两端展示内容一致

### Scenario: 任一前端发送成功后所有连接可见

Given 产品用户在设备 A 和设备 B 同时打开同一个对话
When 产品用户在设备 A 发送普通输入
And 发送请求被接受
Then 设备 A 通过 live update 看到该输入进入消息列表
And 设备 B 通过 live update 看到该输入进入消息列表

### Scenario: draft 不跨连接同步

Given 产品用户在设备 A 的 Composer 中输入 `draft text`
When 产品用户在设备 B 打开同一个对话
Then 设备 B 的 Composer 为空
And 设备 A 的 draft 不受设备 B 连接影响

### Scenario: 重连时恢复对话内容而非其他连接的操作状态

Given 产品用户在设备 A 操作对话期间，设备 B 断开连接
When 设备 B 重新连接
Then 设备 B 恢复到当前最新对话内容
And 设备 B 不继承设备 A 的 Composer draft 或展开状态

## Pending Interaction

`agent cli` 在工作过程中可能产生需要产品用户响应的交互请求（如权限审批、确认操作等），称为 `pending interaction`。

同一对话在同一时刻可能存在多个 pending interaction。多个对话可能各自有独立的 pending interaction。

所有连接对等：任何前端都能看到 pending interaction，任何前端都能响应。后端对响应做幂等去重，接受第一个有效响应，忽略后续重复响应。

响应方式由 interaction 自身决定，包括：选项选择、文字输入（作为某个选项的补充）。`Conversation View` 按 interaction 提供的方式渲染响应控件，不自行推断响应方式。

### Scenario: pending interaction 在消息列表中展示

Given 当前选中对话产生一个 pending interaction
When 页面渲染消息列表
Then 页面在该 interaction 发生位置展示待响应卡片
And 待响应卡片比普通信息更醒目
And 待响应卡片展示 `agent cli` 提供的交互内容

### Scenario: 同一对话多个 pending interaction 并存

Given 当前选中对话同时存在多个未响应的 pending interaction
When 页面渲染消息列表
Then 页面按各 interaction 的发生顺序分别展示
And 每个 interaction 可独立响应
And 响应某个 interaction 不影响其他 interaction 的状态

### Scenario: 切换到有 pending interaction 的对话

Given 对话 A 存在未响应的 pending interaction
And 产品用户当前查看的是对话 B
When 外部功能把当前选中对话切换为对话 A
Then 页面展示对话 A 的所有未响应 pending interaction
And 待响应卡片可操作

### Scenario: 通过选项选择响应 pending interaction

Given 页面展示一个待响应的 pending interaction
And 该 interaction 提供选项列表
When 产品用户选择其中一个选项并提交
Then 页面发送包含所选选项的响应请求
And 页面在等待结果期间禁用重复响应

### Scenario: 通过文字输入响应 pending interaction

Given 页面展示一个待响应的 pending interaction
And 该 interaction 的某个选项需要文字输入作为补充
When 产品用户选择该选项并输入文字后提交
Then 页面发送包含所选选项和文字内容的响应请求
And 页面在等待结果期间禁用重复响应

### Scenario: 响应被后端接受

Given 产品用户已提交一个 pending interaction 的响应
When 响应被后端接受
Then 页面更新该 interaction 状态为已响应
And 该 interaction 不再可操作

### Scenario: 多连接下先到先得

Given 设备 A 和设备 B 同时展示同一个 pending interaction
When 产品用户在设备 A 提交响应
And 响应被后端接受
Then 设备 A 的该 interaction 更新为已响应
And 设备 B 通过 live update 收到该 interaction 已被响应
And 设备 B 的该 interaction 更新为已响应且不再可操作

### Scenario: 重复响应被后端拒绝

Given 设备 A 已成功响应一个 pending interaction
When 设备 B 在收到已响应更新前也提交响应
Then 后端拒绝设备 B 的重复响应
And 设备 B 展示非阻塞提示表明该 interaction 已被处理

### Scenario: pending interaction 超时或取消

Given 页面展示一个待响应的 pending interaction
When 该 interaction 因超时或 `agent cli` 取消而失效
Then 页面更新该 interaction 状态为已失效
And 该 interaction 不再可操作

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
- codex `plan` 的处理。
- 图片展示/输入。
- 文件引用点击后的完整文件浏览能力。
- `agent cli` 的选择与切换。
- 不同 `agent cli` 之间展示文案的统一。
- 鉴权与传输安全。
