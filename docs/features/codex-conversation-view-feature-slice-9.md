# Codex Conversation View Feature Slice - Long Work Trace Expansion

- **Type:** AFK
- **Blocked by:** Slice 8
- **Feature requirements covered:** 28, 29, 30, 31, 32

## 目标

让长 stdout、stderr、diff、工具输出、搜索结果等工作痕迹在移动端可控阅读。

## 垂直路径

- Web 在工作痕迹展开后首次最多显示 30 行。
- 超过 30 行时显示“展开剩余 xxx 行”或等价入口。
- 用户继续展开后可以查看剩余内容。
- 长内容规则只应用于工作痕迹，不应用于普通 user/assistant Markdown message。
- 工作痕迹不提供专门复制按钮。

## 完成后可验证

- 超长 stdout 不会一展开就压垮页面。
- 用户能看到剩余行数。
- 用户可以继续展开查看完整内容。
- 普通长聊天消息不被这个 30 行规则截断。

## 非目标

- 不做虚拟列表。
- 不做工作痕迹折叠预览。
- 不做工作痕迹复制按钮。
