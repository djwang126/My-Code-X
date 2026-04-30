# Codex Conversation View Feature Slice - Error Surfaces

- **Type:** AFK
- **Blocked by:** Slice 2, Slice 6
- **Feature requirements covered:** 16, 38, 39, 40, 41

## 目标

区分 conversation 内错误 item 和非 conversation 基础设施错误，让用户看到原始错误信息而不混淆来源。

## 垂直路径

- Server 把 Codex/app-server 表示为 conversation item 的聊天过程错误进入 timeline。
- Web 把 conversation 错误 item 渲染为错误卡片。
- 错误卡片展示原始错误信息。
- 错误卡片中的错误文字使用红色。
- 加载、恢复等非 conversation 基础设施错误显示为 timeline 外常规错误状态。
- Conversation View 不改写、重新解释或推断原始错误原因。

## 完成后可验证

- 聊天过程中产生的错误显示在 timeline 中。
- 错误 item 不伪装成普通 assistant message。
- 恢复失败不会被伪造成 Codex conversation item。
- 用户看到的是原始错误信息。

## 非目标

- 不设计复杂错误图标、边框或背景。
- 不展示额外错误分析。
- 不给错误卡片加专门复制按钮。
- 不给错误卡片增加重试、取消、approval 或发送控件。
- 不显示错误时间戳。
