# Feature-Conversation View

Conversation View 是 `Active Work` 中承载当前 `Conversation` 的手机端阅读和继续工作界面。

它不是 Codex `Thread` 本身，也不是普通聊天页面。Conversation View 面向移动端用户呈现一个可阅读、可理解、可介入、可恢复的 `Conversation`，让用户在手机上继续使用本地 Codex，而不需要承担 TUI 的交互负担。

Conversation View 的设计边界是表达当前 Codex 工作现场中的 `Conversation`，不重新设计 Codex agent 的智能能力。Codex 负责理解需求、阅读项目、制定计划、执行工具和总结结果；Conversation View 负责让这些过程在移动端具备清晰呈现、用户介入、移动可靠性和异步连续性。

## User identity

1. 主要用户是远程使用 Codex 的个人开发者。他们已经会用或愿意用 Codex，但不喜欢 TUI 或桌面端体验，尤其希望在手机上继续推进本地项目。
2. 核心场景用户是移动设备上的持续协作者。他们不是只想发送一条 prompt，而是希望在手机上看进展、补充上下文、纠偏、授权、确认结果并继续下一步。
3. 高级用户需要接近 Codex TUI 的关键语义。他们关心 Codex `Thread`、执行状态、工具调用、待处理交互、历史恢复和真实副作用，而不满足于普通聊天 UI。
4. 隐含用户是在电脑不方便操作时接管工作的人。他们可能在通勤、外出、休息或远程环境中使用手机，希望完成监督、决策、补充和恢复，而不是完整替代 IDE。
5. 非目标用户不是普通 AI 问答用户。Conversation View 不应泛化成通用 chatbot，而应服务用户和本地 Codex 一起完成开发工作。

## Job statements

1. When 我在手机上打开 My-Code-X 时，I want to 快速进入正确的 Conversation View，so I can 继续当前工作而不用重新定位项目、目标或 session。
2. When 页面刷新、切后台、断网或重新打开时，I want to 保持当前 `Conversation`、草稿和状态不丢失，so I can 信任手机端适合远程协作。
3. When 当前 Codex 工作正在进行时，I want to 一眼看懂 Codex 是运行、等待、完成、失败、暂停还是断开，so I can 判断自己是否需要介入。
4. When Codex 长时间沉默或执行工具时，I want to 看到最后活动、当前动作和执行状态，so I can 区分正常推进、等待输入和可能卡住。
5. When Codex 输出计划、工具、错误等各种信息时，I want to 以清晰类型和层级阅读这些事件，so I can 在手机上理解 agent 工作而不被原始流淹没。
6. When 我需要证据或细节时，I want to 展开原始输出、命令结果、文件变更或错误信息，so I can 保留 Codex TUI 的可追溯性。
7. When Codex 等待我或我想纠偏时，I want to 在正确 Codex `Thread` 中快速发送回复、补充指令或限制，so I can 影响后续行为而不重启工作。
8. When 当前 Codex 工作需要控制节奏时，I want to 暂停、继续、结束它，so I can 管理长任务。
9. When 有高影响动作需要用户决定时，I want to 清楚区分普通消息和授权决策，so I can 避免移动端误触造成真实副作用。
10. When 我离开后再回来时，I want to 看到期间发生的关键状态变化和当前待处理事项，so I can 快速恢复现场感。
