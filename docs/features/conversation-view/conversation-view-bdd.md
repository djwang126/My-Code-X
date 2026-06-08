# Feature: Conversation View BDD

`Conversation View` 让产品用户在移动端友好的界面中阅读当前 `agent cli` 对话、理解工作过程、继续输入、追加指令或中断当前工作。它不重新设计 `agent cli` 能力。

`agent cli` 是 `My-Code-X` 当前对接的 cli 形态 agent 的统称（codex、claude code 等）。相关产品决策默认适用于所有 `agent cli`。

本文档只描述 `Conversation View` 自身的可验收行为。选中、取消选中对话与 `agent cli` 切换由其他功能提供。

## 背景

产品用户的电脑持续运行 `My-Code-X` 后端，后端调用同一台电脑上的 `agent cli`。产品用户可通过手机、其他电脑或同一电脑上的前端连接后端并与 `agent cli` 对话。

`Conversation View` 把产品内部信息分为四类，决定渲染方式：普通对话内容、工作过程信息、失败信息、未识别信息。

四类分类不是用户可见文案。用户可见的 type、status、message 等各类文字内容默认沿用 `agent cli` 原生内容。

`agent cli` 输出的每条信息都是结构化的，由若干「字段名 + 字段内容」组成。当某类信息没有专门展示规则时，`Conversation View` 用**通用字段解析**作为兜底，把结构化字段逐条渲染为产品用户可读内容。

native type 到各个分类信息的对应关系在各 `agent cli` 接入时确定。通常来说主要普通对话内容只对应普通message，工作过程则包含 reasoning、文件修改、命令运行等。未识别信息只用于 `agent cli` 无法安全归类或识别 native type 的信息。某些可识别 native type 可能不归入四大分类，进行刻意忽略或留用其他后续功能的展示逻辑。

`turn` 边界由 `agent cli` 提供的 turn 信息决定，`Conversation View` 不自行推断。

UI 标准由 UImock 提供，只体现样式与布局，不代表代码设计、领域定义或实现细节：[conversation-view-UImock.html](./conversation-view-UImock.html)

## Conversation View Shell

### Scenario: 没有选中对话时展示首屏状态

Given 当前没有选中对话
When 产品用户打开 `Conversation View`
Then 页面展示无选中对话提示
And 消息阅读区域不展示任何对话消息
And Composer 显示但禁用发送

### Scenario: 顶部上下文区域按标题与目录的有无展示

Given 产品用户打开 `Conversation View`

When 当前选中对话同时存在标题和所在目录
Then 顶部上下文区域展示标题和所在目录

When 当前选中对话缺少标题或所在目录的信息
Then 相关信息直接留空

### Scenario: 初次打开有内容的对话时定位到底部

Given 当前选中对话已有可读内容
When 产品用户首次打开该对话
Then 页面定位到消息列表底部

### Scenario: 打开新选中的对话/切换选中对话

Given 产品用户选中新的对话

When 需要加载新选中对话的历史记录
Then 通过各自 `agent cli` 的 native 历史恢复功能加载权威对话历史

When 对话正在加载
Then 页面展示加载中提示

When 对话加载成功但没有任何可展示内容
Then 页面展示无可展示内容提示

When 对话加载失败
Then 页面展示加载失败提示
And 页面展示重试按钮

### Scenario: 已有内容的对话同步到后端权威状态

Given 当前选中对话已有可读内容
And 因断线、切后台、弱网或重连导致内容可能非最新

When 前端开始同步对话
Then 页面展示同步中 banner
And 页面保持已有内容可滚动阅读
And 当前对话目标状态变为不明确

When 同步成功
Then 页面收起同步中 banner
And 页面内容对齐到后端权威状态
And 当前对话目标状态恢复明确

When 同步失败
Then 页面展示「同步失败」banner
And 该 banner 展示重试按钮
And 页面保持已有内容可滚动阅读
And 当前对话目标状态保持不明确

When 产品用户点击重试
Then 前端重新开始同步对话

## Conversation Information Rendering

### Scenario: 按发生顺序展示对话信息

Given 当前选中对话收到多条不同分类的信息
When 页面渲染消息列表
Then 页面按信息发生顺序展示
And 页面用不同视觉样式区分不同产品内部分类

### Scenario: 工作过程信息默认折叠、可展开

Given 当前选中对话收到一条工作过程信息
When 渲染该工作过程信息
Then 展示该工作过程信息摘要且默认折叠
And 摘要仅展示原生 type 和原生 status（如果有status）

When 产品用户展开该信息
Then 页面以通用字段解析展示该信息的结构化内容
And 页面保持产品用户当前阅读位置不变

### Scenario: 工作过程信息与未识别信息的展开状态在对话打开期间保持

Given 产品用户已展开一条工作过程信息或未识别信息

When 页面收到 live update
Then 该信息保持展开

When 产品用户滚动后回到该信息
Then 该信息保持展开

When 页面刷新后恢复同一对话
Then 该信息保持展开

When app 断线重连后恢复同一对话
Then 该信息保持展开

When 外部功能把当前选中对话切换走再切换回来
Then 该信息恢复为默认折叠状态

### Scenario: 未识别信息默认折叠、可展开

Given 当前选中对话收到来自 `agent cli` 的未知归类的信息
When 渲染该未识别信息
Then 展示该未识别信息摘要且默认折叠
And 摘要仅展示原生 type 和原生 status（如果有 type 或 status）

When 未识别没有原生 type
Then 摘要展示含义为 `Unknown type` 的文案

When 产品用户展开该未识别信息
Then 页面以通用字段解析展示该信息的结构化内容
And 页面保持产品用户当前阅读位置不变

### Scenario: 失败信息对应位置醒目展示

Given 当前选中对话收到来自 `agent cli` 的失败信息
When 渲染该失败信息
Then 页面在失败发生的位置展示该信息
And 失败信息比普通信息更醒目
And 用通用字段解析展示该信息的结构化内容

When 失败信息没有可展示结构化内容
Then 页面展示含义为 `Unknown error` 的文案

## Message Reading

### Scenario: 代码块支持窄屏阅读和复制

Given 当前选中对话的一条普通消息包含代码块
When 页面渲染该消息
Then 代码块展示在横向滚动容器中
And 代码块右上角展示复制按钮

When 产品用户点击该复制按钮
Then 页面复制该代码块内容

### Scenario: 宽表格支持窄屏阅读

Given 当前选中对话的一条普通消息包含 Markdown 表格
When 页面渲染该消息
Then 宽表格展示在横向滚动容器中

### Scenario: 渲染保持文本编码完整

Given 当前选中对话的一条消息包含 UTF-8、CJK 或 emoji 字符
When 页面渲染该消息
Then 页面展示的内容中这些字符不损坏

### Scenario: 链接按类型处理

Given 当前选中对话的一条普通消息包含链接
When 页面渲染该消息

When 该链接是 Markdown 外链且产品用户点击
Then 页面打开该外链

When 该链接是相对链接或本地文件引用
Then 页面按纯文本展示该链接

## Turn Toolbar

### Scenario: turn 工具栏按 turn 状态展示

turn 状态与边界由 `agent cli` 提供。不同 `agent cli` 的时间戳/turn标记信息不同，best-effort 取最接近的可用信息。

Given 当前 `agent cli` 提供一个 turn
And 该 turn 包含至少一条产品用户输入

When 页面渲染该 turn
Then 页面在该 turn 第一条产品用户消息下方展示工具栏
And 该工具栏 best-effort 展示最接近该 turn 开始的时间

When 该 turn 已结束且包含至少一条 `agent cli` 回复
Then 页面在该 turn 最后一条 `agent cli` 消息下方展示工具栏
And 该工具栏 best-effort 展示最接近该 turn 结束的时间

When 该 turn 仍在进行中
Then 页面不在 agent 回复下方展示工具栏

When 该 turn 已结束但不包含任何 `agent cli` 回复
Then 页面不在 agent 回复下方展示工具栏

### Scenario: 工具栏复制 turn 首尾消息原文

Given 当前对话中有工具栏
When 工具栏所在位置为该 turn 第一条产品用户消息下方
And 该消息为普通对话内容
Then 工具栏中有复制按钮

When 工具栏所在位置为该 turn 最后一条 `agent cli` 消息下方
And 该消息为普通对话内容
Then 工具栏中有复制按钮

When 产品用户点击工具栏的复制按钮
Then 页面复制第一条产品用户消息/最后一条 `agent cli` 普通对话内容原文

## Live Update

`live update` 是 `agent cli` 实时输出新信息时，后端持续向前端推送增量、保持前端内容与后端同步的机制。它由 `agent cli` 是否在输出驱动：有增量则推送，没有输出时自然没有增量。

`Conversation View` 不自行判断一条信息是否「完成」。信息的状态（如有）沿用 `agent cli` 提供的 native status，由各分类的渲染规则透传展示。

### Scenario: 新信息进入消息列表，已有信息就地更新

Given 当前选中对话的 `agent cli` 正在输出

When 页面收到一条新信息
Then 页面把新信息按发生顺序展示到消息列表

When 页面收到一条已存在信息的后续数据
Then 页面按该 `agent cli` 对该信息类型规定的方式就地更新原信息
And 该方式可能是追加增量，也可能是整条替换，由 `agent cli` 与信息类型决定
And 页面不新增列表项

### Scenario: 新内容按当前阅读位置决定是否滚动

Given 当前选中对话的 `agent cli` 正在输出

When 产品用户当前在消息列表底部阅读
And 页面收到新信息
Then 页面自动滚动跟随新内容

When 产品用户正在查看不在底部的旧内容
And 页面收到新信息
Then 页面保持产品用户当前阅读位置不变

### Scenario: 输出期间重连后续接 live update

Given 当前选中对话的 `agent cli` 正在输出
And app 因弱网、切后台或连接中断失去 live update
When app 重新连接
Then 前端按「已有内容的对话同步到后端权威状态」同步内容
And 同步完成后页面继续接收后续 live update

## Conversation View Notice

错误是否归属到具体对话或位置，由 `agent cli` 自身逻辑决定，`Conversation View` 不自行判断：带归属的错误作为失败信息进入对应对话的消息列表，无归属的错误与 `My-Code-X` 自身错误展示为 banner。

### Scenario: 无归属错误展示为 banner

Given `My-Code-X` 收到 `agent cli` 给出的无归属错误，或 `My-Code-X` 自身的错误
When 产品用户查看 `Conversation View`
Then 页面用 banner 展示该错误
And 该错误不插入消息列表

### Scenario: banner 按类型决定消失时机

Given 一次性 banner 的自动消失时长配置为 `T`

When 一次性 banner 已展示超过 `T`
Then 页面自动收起该 banner

When 持续状态 banner 展示已超过 `T` 但状态尚未恢复
Then 页面仍然展示该 banner

When 该持续状态恢复
Then 页面收起该 banner

### Scenario: 多个 banner 垂直堆叠

Given 页面同时存在多个 banner
When 产品用户查看 `Conversation View`
Then 多个 banner 垂直堆叠展示

## Composer

### Scenario: Composer 在本地客户端按对话保存 draft

Given 当前选中对话为对话 A

When 产品用户输入文本 `draft A`
Then Composer 为对话 A 保存 `draft A`

When 外部功能切换到对话 B 且产品用户输入 `draft B`
Then Composer 为对话 B 保存 `draft B`

When 外部功能切换回对话 A
Then Composer 恢复展示 `draft A`

When 产品用户在另一个客户端打开对话 A
Then 该客户端的 Composer 不恢复前一个客户端的 `draft A`

### Scenario: Composer 支持多行输入

Given 当前选中对话可以继续输入
When 产品用户输入多行文本
Then Composer 保留换行并用多行输入框展示
And 输入框随内容增长到最大高度
And 超过最大高度后输入框内部滚动

### Scenario: 主操作按钮按对话状态、输入与 cli 能力决定动作

主操作按钮的动作由「对话是否工作中」「Composer 是否有输入」「`agent cli` 支持哪些动作」共同决定。

Given 当前选中对话存在

When `agent cli` 空闲且 Composer 为空
Then 主操作按钮禁用发送

When `agent cli` 空闲且 Composer 有输入
Then 主操作按钮为发送普通输入

When 对话工作中、`agent cli` 支持中断且 Composer 为空
Then 主操作按钮为中断当前工作

When 对话工作中、`agent cli` 不支持中断且 Composer 为空
Then 主操作按钮为被禁用的发送普通输入

When 对话工作中、`agent cli` 支持追加指令且 Composer 有输入
Then 主操作按钮为补充指令

When 对话工作中、`agent cli` 不支持追加指令且 Composer 有输入
Then 主操作按钮保持不变

When 内容正在加载、连接不可用或对话目标状态不明确
Then Composer 保留当前对话 draft 并禁用主操作按钮

### Scenario: 发送普通输入或补充指令

Given Composer 中有产品用户输入原文
And 主操作按钮为发送普通输入或补充指令
When 产品用户点击主操作按钮
Then Composer 发送对应请求并保真携带原始输入
And 原始输入中的 UTF-8、CJK、emoji 字符不损坏
And Composer 在等待发送结果期间禁用重复发送

When 发送请求被 `agent cli` 接受
Then Composer 清空当前对话 draft
And 消息列表内容由 live update 推送决定

When 发送请求失败
Then Composer 保持当前对话 draft 不变
And 页面展示非阻塞错误提示

### Scenario: 中断当前工作需二次确认

Given 当前选中对话正在工作（有正在进行的 `turn` ）
When 产品用户点击中断当前工作
Then 页面展示中断确认 modal

When 产品用户在 modal 中二次确认
Then Composer 发送中断当前工作请求
And 中断结果由 `agent cli` 后续信息与对话状态变化体现

When 中断请求失败
Then 页面展示非阻塞错误提示
And 产品用户可再次发起中断

When 产品用户在 modal 中取消
Then 页面关闭 modal 且不发送中断请求
And Composer 状态不变

## Multiple Connections

多个前端实例（不同设备、不同 tab）可同时连接同一个后端。所有连接对等，不引入会话独占或"活跃设备"概念。

### Scenario: live update 在所有连接间一致

Given 产品用户在设备 A 和设备 B 同时打开同一个对话
And 当前agent cli 正在输出

When 页面收到新的对话信息
Then 设备 A 和设备 B 都收到该 live update
And 两端展示内容一致

When 产品用户在设备 A 发送普通输入且请求被 `agent cli` 接受
Then 设备 A 和设备 B 都通过 live update 看到该输入进入消息列表

### Scenario: draft 不跨客户端同步

Given 产品用户在设备 A 的 Composer 中输入 `draft text`
When 产品用户在设备 B 打开同一个对话
Then 设备 B 的 Composer 为空


## Pending Interaction

`agent cli` 工作过程中可能产生需要产品用户响应的交互请求（权限审批、确认操作等），称为 `pending interaction`。同一对话同一时刻可能存在多个，多个对话也可能各自独立存在。

所有连接对等：任何前端都能看到并响应。后端对响应做幂等去重，接受第一个有效响应，忽略后续重复响应。

响应方式由 interaction 自身决定（选项选择、文字输入作为某选项的补充）。`Conversation View` 按 interaction 提供的方式渲染响应控件，不自行推断。

### Scenario: pending interaction 展示与并存

Given 当前选中对话存在未响应的 pending interaction
When 页面渲染 `Conversation View`
Then 页面弹出待响应弹窗
And 弹窗内按发生顺序列出待响应 pending interaction
And 每条沿用 `agent cli` 提供的交互内容

When 对话同时存在多个未响应 pending interaction
Then 弹窗内按发生顺序列出每条
And 每条可独立响应，响应其一不改变其他条目状态

When 外部功能把当前选中对话切换为存在 pending interaction 的对话
Then 弹窗列出该对话的所有未响应 pending interaction 且可操作

### Scenario: 响应 pending interaction

Given 页面展示一个待响应的 pending interaction

When 产品用户选择一个选项并提交
Then 页面发送包含所选选项的响应请求
And 页面在等待结果期间禁用重复响应

When 该选项需要文字输入作为补充，产品用户输入文字后提交
Then 页面发送包含所选选项和文字内容的响应请求
And 页面在等待结果期间禁用重复响应

When 响应请求失败
Then 页面展示非阻塞错误提示
And 该 pending interaction 恢复为可响应

### Scenario: pending interaction 状态流转

Given 页面展示一个待响应的 pending interaction

When 产品用户提交的响应被后端接受
Then 页面更新该 interaction 状态为已响应且不再可操作

When 该 interaction 因超时或 `agent cli` 取消而失效
Then 页面更新该 interaction 状态为已失效且不再可操作

### Scenario: 多连接下先到先得

Given 设备 A 和设备 B 同时展示同一个 pending interaction

When 设备 A 提交响应且被后端接受
Then 设备 A 的该 interaction 更新为已响应
And 设备 B 收到已响应更新并更新为已响应且不再可操作

When 设备 B 在收到已响应更新前也提交响应
Then 后端拒绝设备 B 的重复响应
And 设备 B 展示非阻塞错误提示表明该 interaction 已被处理

## Non-Functional Acceptance

- **长对话渲染**
  - 对象：包含数百条消息（含 reasoning、工具结果、代码块、表格、普通回复）的对话在移动端的阅读体验。
  - 指标：滚动帧率、内存占用。
  - 目标：滚动保持流畅无明显掉帧；内存占用随消息数线性增长且有上限，不随滚动持续累积。

## Out of Scope

- 创建、选中、取消选中对话。
- `agent cli` 能力重设计。
- codex `plan` 的处理。
- 图片展示/输入。
- 文件引用点击后的完整文件浏览能力。
- 工作过程信息的专门渲染（diff、命令等）；当前统一走通用字段解析。
- `agent cli` 的选择与切换。
- 不同 `agent cli` 之间展示文案的统一。
- 鉴权与传输安全。
