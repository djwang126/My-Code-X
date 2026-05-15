# Feature-Workspace Thread Browser

`Workspace Thread Browser` 让用户在 My-Code-X 中按 `My-Code-X Workspace` 查看、切换、恢复和整理 Codex `Thread`，使移动端使用体验更适合并行开发。

## User identity

1. 多项目并行工作的个人开发者：同时维护多个本机项目，希望每个工作上下文保持独立。

2. 用手机远程驱动 Codex 的开发者：需要在离开主力电脑时查看进度、继续指令、处理紧急任务。

3. 高频使用 Codex 的并行工作用户：会让 Codex 同时承担 planning、implementation、review、debug、testing、docs 等不同工作。

4. 需要监控多个进行中 `Turn` 的用户：关心哪些工作正在运行、失败、完成、等待响应或稍后处理。

## Job statements

1. When 我同时推进多个 My-Code-X Workspace 或 Codex `Thread` 中的工作, I want to 在一个视图中理解每个 Active work 的归属、状态、摘要和是否需要行动, so I can 快速建立全局认知，不必逐个 Workspace 查找。

2. When 我只记得任务内容、最近状态或大概时间，但不记得具体 Workspace / Thread, I want to 通过摘要、最近活动、状态和任务线索找回对应 Active work, so I can 快速恢复上下文而不用翻找历史。

3. When 我从手机打开 My-Code-X、刷新页面或离开一段时间后回来, I want to 恢复未完成、完成未读、失败、等待处理和稍后处理的 Active work, so I can 信任当前看到的是需要继续关注的工作。

4. When 多个 `Turn` 同时处于 running、completed、failed、interrupted 或 waiting 状态, I want to 清楚区分每个状态属于哪个 Workspace / Thread / Turn, so I can 判断哪些工作需要行动，哪些可以继续等待。

5. When 后台 Active work 完成、失败或等待我响应, I want to 获得轻量提醒但不被强制切换当前 focus, so I can 保持当前工作节奏，同时不错过需要处理的任务。

6. When 我正在等待 long-running `Turn`, I want to 暂时离开当前 `Conversation` 并继续处理其他 Active work, so I can 利用等待时间而不丢失原任务状态。

7. When 我在多个 Active work 之间切换, I want to 保留每个工作的阅读位置、输入草稿、处理状态和运行状态, so I can 低成本往返而不误中断正在执行的 Codex 工作。

8. When 高优先级问题突然打断当前工作, I want to 快速切到相关 Active work 并保留原工作的上下文, so I can 先处理紧急任务，再顺畅回到原来的工作。

9. When 我准备发送消息或执行 `Thread action`, I want to 明确看到当前目标 Workspace / Thread / Turn 和任务身份, so I can 避免把操作发到错误的 Codex `Thread`。

10. When 我在同一 Workspace 中并行做 planning、implementation、review、testing 或 docs, I want to 将不同工作流保持为独立但可参照的 Active work, so I can 避免一个超长 `Thread` 承载所有工作。

11. When 我想比较两种实现路径或让 Codex 承担不同工作角色, I want to 为每条路径或角色保留独立状态和结果, so I can 横向比较后由自己统一决策。

12. When Active work 越来越多, I want to 按“需要行动、运行中、完成未读、失败、稍后处理、已收束”等意义组织它们, so I can 控制注意力并避免重要任务被最近活动顺序淹没。

13. When 某个 Active work 我暂时不想处理、已经阅读、已经处理或决定不再关注, I want to 将它稍后处理或从 Active work view 中收束出去, so I can 降低噪音，同时保留必要的恢复入口。

14. When 我需要对外响应 bug、review、PR、客户项目或协作进度, I want to 快速定位相关 Active work 并确认当前结果, so I can 更快给出可靠回应，不漏掉承诺过的工作。
