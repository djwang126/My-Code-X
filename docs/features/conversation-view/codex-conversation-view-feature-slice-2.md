# Codex Conversation View Feature Slice - Conversation Snapshot Shell

- **Type:** AFK
- **Blocked by:** Slice 1
- **Feature requirements covered:** 1, 15, 16, 42, 43, 44, 45

## 目标

建立 Conversation View 最小可显示外壳，让前端能展示当前 thread 的 conversation snapshot，以及空状态、加载状态、恢复失败状态。

## 垂直路径

- Server contract 增加 Conversation View 所需的最小 snapshot 状态。
- Server presenter 输出 conversation revision、items 和 view 状态。
- API 返回当前 conversation snapshot。
- Web 读取 snapshot 并渲染 Conversation View 外壳。
- UI 区分：加载中、空 thread、恢复失败、已有 timeline。

## 完成后可验证

- 空 thread 显示明确空状态。
- 加载或恢复中显示明确状态。
- 恢复失败显示 timeline 外常规错误信息。
- Conversation View 尚不需要渲染复杂 item，只需要有稳定外壳。

## 非目标

- 不做消息发送。
- 不做 approval / pending request。
- 不做自动滚动。
- 不做 workspace 文件打开。
- 不显示额外完成横幅或 done 提示。
- 不显示消息、工作痕迹、错误或 turn 的时间戳。
- 不提供搜索、筛选、item 跳转、手动刷新、重试、approval、取消或发送控件。
- 不处理 pending request / approval 业务逻辑；如需视觉相邻或关联，由 Conversation View 外部区域负责。
