# Codex Conversation View Feature Slice - Frontend App Shell Architecture

- **Type:** HITL
- **Blocked by:** 无
- **Feature requirements covered:** 支撑全部 UI requirements，不直接覆盖单个产品需求
- **Status:** Decided and implemented as the Slice 1 frontend skeleton

## 目标

建立 `apps-new` 前端的清晰架构骨架，让后续 Conversation View slices 可以在不会变成单文件大泥球的结构里继续落地。

当前产品规划是 single-page app-like experience，不是多 page 网站。因此本 slice 采用 App Shell + Feature Regions，而不是 router/page-first 架构。

## 已决策架构

- `apps-new/web` 加入 root workspace。
- `apps-new/web` package name 为 `@my-code-x/web-new`。
- `apps-new/contracts` 加入 root workspace。
- `apps-new/contracts` package name 为 `@my-code-x/contracts-new`。
- 前端使用 Vite + React + TypeScript。
- 不使用 React Router。
- 不创建 `pages/` 层。
- `app/` 是单页 App Shell 和 composition layer。
- `features/` 是功能区域边界。
- Conversation View 是第一个 feature region。
- Web 不直接依赖 `apps-new/server/src/*`。
- Server/Web 后续通过 `@my-code-x/contracts-new` 共享 frontend-facing product contracts。
- Slice 1 引入 `zod`，contract package 负责 runtime schema boundary。
- Slice 1 不接真实 `/client` API。
- Slice 1 不配置测试工具。

## 垂直路径

- 建立 `apps-new/contracts` workspace package。
- 建立 `apps-new/web` workspace package。
- 建立 single-page App Shell。
- 建立 Conversation View feature region。
- 建立 Conversation View 内部边界：`api`、`model`、`components`、`markdown`。
- 建立 `shared/ui` 和 `shared/lib`，仅允许无业务概念的共享代码。
- 建立极简 mobile-friendly app shell 样式。
- 接入 root workspace 和基础 scripts。

## 完成后可验证

- root workspace 能识别 `@my-code-x/contracts-new` 和 `@my-code-x/web-new`。
- `apps-new/contracts` 可以 typecheck、lint、build。
- `apps-new/web` 可以 typecheck、lint、build。
- `apps-new/web` 有单页 App Shell。
- Conversation View 作为只读 feature region 挂载在 App Shell 内。
- Conversation View 内部边界已经分清楚，后续 slices 不需要先重构目录。

## 非目标

- 不实现真实 conversation snapshot。
- 不接真实 server `/client` API。
- 不实现消息发送、输入框、重试、取消、approval、pending request 或手动刷新。
- 不实现 Markdown 渲染细节。
- 不实现 conversation events。
- 不实现 restore 行为。
- 不实现真实 work trace、unknown item、error item 渲染。
- 不引入多 page router。
- 不配置测试框架。
