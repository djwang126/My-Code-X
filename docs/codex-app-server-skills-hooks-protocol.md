# Codex App Server Skills 与 Hooks 协议详解

本文档说明原生 Codex `codex app-server` 中 Skills 与 Hooks 相关接口、发现逻辑、配置写入、事件通知和运行时行为。文档只覆盖原生 Codex app-server，不包含 My-Code-X 上层 UI 适配逻辑。

本文基于本机相邻仓库 `../codex` 的 Rust 实现分析，主要事实来源：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`
- `../codex/codex-rs/app-server/src/bespoke_event_handling.rs`
- `../codex/codex-rs/core-skills/src/manager.rs`
- `../codex/codex-rs/core-skills/src/loader.rs`
- `../codex/codex-rs/core-skills/src/config_rules.rs`
- `../codex/codex-rs/core-skills/src/injection.rs`
- `../codex/codex-rs/hooks/src/registry.rs`
- `../codex/codex-rs/hooks/src/engine/discovery.rs`
- `../codex/codex-rs/hooks/src/engine/dispatcher.rs`
- `../codex/codex-rs/hooks/src/engine/command_runner.rs`
- `../codex/codex-rs/hooks/src/engine/output_parser.rs`
- `../codex/codex-rs/hooks/src/events/common.rs`
- `../codex/codex-rs/hooks/src/schema.rs`
- `../codex/codex-rs/config/src/skills_config.rs`
- `../codex/codex-rs/config/src/hook_config.rs`

## 1. 范围

本文回答这些问题：

1. 客户端如何通过 app-server 查询 skills 和 hooks。
2. app-server 如何发现、合并、过滤和缓存 skills。
3. app-server 如何发现 hooks、合成启停状态、返回 UI 可展示 metadata。
4. hooks 在 turn/thread 生命周期中如何运行、如何向客户端发出运行通知。

本文刻意不覆盖：

- `plugin/list`、`plugin/install`、`marketplace/*` 的完整协议。
- MCP tool 具体协议。
- 上层 Web UI 如何选择、展示、保存这些结果。
- Codex 模型 prompt 的完整拼装细节。

本文中的“客户端”指连接到 `codex app-server` 的调用方。“服务端”指原生 Codex app-server 进程。

## 2. API 总览

Skills 与 Hooks 的直接客户端 request 只有三个：

| method | 用途 | response | 主要通知 |
| --- | --- | --- | --- |
| `skills/list` | 按 cwd 列出可用 skill metadata。 | `SkillsListResponse` | 无直接响应通知；后续变更通过 `skills/changed` 提醒重拉 |
| `skills/config/write` | 按 path 或 name 写入用户级 skill enabled 配置。 | `SkillsConfigWriteResponse` | 无固定通知；会清理服务端 skills/plugins cache |
| `hooks/list` | 按 cwd 列出有效 hook metadata。 | `HooksListResponse` | 无直接响应通知；hook 运行时会有 `hook/started`、`hook/completed` |

相关通知：

| method | 来源 | 用途 |
| --- | --- | --- |
| `skills/changed` | loaded thread 的 skills watcher | 本地 skill 文件变化后通知客户端重新调用 `skills/list` |
| `hook/started` | hook runtime | 某个 hook command 开始运行 |
| `hook/completed` | hook runtime | 某个 hook command 完成、失败、阻塞或停止 |

所有 request 都需要先完成 app-server 标准握手：

```text
initialize
initialized
skills/list 或 hooks/list
```

`skills/list`、`skills/config/write`、`hooks/list` 在协议枚举中都使用 `global("config")` serialization scope。含义是这些请求会按全局 config 相关串行化处理，避免并发读写 config 造成不一致。

## 3. Skills 核心概念

Skill 是一个本地 instruction bundle，核心文件是 `SKILL.md`。app-server 返回的是 metadata，用于 UI 展示和输入 mention；真正 turn 里使用 skill 时，core 会再读取对应 `SKILL.md` 全文并注入到模型上下文。

### 3.1 Skill 文件形态

最小 `SKILL.md`：

```markdown
---
name: skill-creator
description: Create or update a Codex skill
metadata:
  short-description: Create skills
---

# Skill Body

...
```

解析规则：

- 必须有 `---` 包围的 YAML frontmatter。
- `name` 为空时使用 `SKILL.md` 父目录名作为默认 name。
- `description` 必填且不能为空；为空会导致该 skill 解析失败。
- `name` 和 `description` 都会压缩为单行文本。
- `name` 最大 64 字符。
- `description` 最大 1024 字符。
- `metadata.short-description` 可选，最大 1024 字符。

如果 skill 属于 plugin，loader 会尝试给 name 增加 plugin namespace。例如 plugin `linear` 中的 `triage-issues` 可能暴露为 `linear:triage-issues`。

### 3.2 可选 metadata 文件

除了 `SKILL.md` frontmatter，每个 skill 目录下还可以有：

```text
agents/openai.yaml
```

该文件是 fail-open 的：缺失、不可读、解析失败或字段非法时，不阻塞 `SKILL.md` 本身加载，只会忽略对应可选 metadata。

可用字段大致是：

```yaml
interface:
  display_name: Skill Creator
  short_description: Create or update Codex skills
  icon_small: assets/icon.svg
  icon_large: assets/icon-large.svg
  brand_color: "#111111"
  default_prompt: Add a new skill

dependencies:
  tools:
    - type: mcp
      value: github
      description: GitHub MCP server
      transport: stdio
      command: github-mcp
      url: https://example.com

policy:
  allow_implicit_invocation: true
  products:
    - codex
```

注意：

- `icon_small` / `icon_large` 必须是相对路径，且必须在 skill 目录的 `assets/` 下。
- `dependencies.tools[].type` 和 `value` 是必需字段；缺任一字段则该 dependency tool 被忽略。
- `policy.allow_implicit_invocation: false` 表示该 skill 不会被自动隐式触发，但仍可作为显式 skill 出现在列表里。
- `policy.products` 会按当前产品过滤。app-server 的 `SkillsManager::new` 默认限制为 `Product::Codex`。

### 3.3 SkillScope

`skills/list` 返回的 `scope` 是 camelCase enum：

| wire 值 | 含义 |
| --- | --- |
| `user` | 用户级 skill，例如 `$CODEX_HOME/skills`、`$HOME/.agents/skills`、plugin skill roots、extra user roots |
| `repo` | 仓库级 skill，例如 project config folder 下的 `skills`，以及 repo `.agents/skills` |
| `system` | Codex 内置 system skills，缓存到 `$CODEX_HOME/skills/.system` |
| `admin` | 系统配置层带来的 admin skills，例如 Unix 上 `/etc/codex/skills` |

排序优先级是 repo、user、system、admin，然后按 name、path 排序。

## 4. `skills/list`

用途：按一个或多个 cwd 计算该 cwd 下可用的 skills，返回 metadata、enabled 状态和加载错误。

请求：

```json
{
  "id": 25,
  "method": "skills/list",
  "params": {
    "cwds": ["/repo"],
    "forceReload": true,
    "perCwdExtraUserRoots": [
      {
        "cwd": "/repo",
        "extraUserRoots": ["/shared/skills"]
      }
    ]
  }
}
```

`SkillsListParams`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cwds` | path[] | 可省略或空数组。为空时使用 app-server 当前 session cwd。允许相对路径，响应里保留原请求 cwd。 |
| `forceReload` | boolean | 默认 false。为 true 时绕过 skills cache，重新扫描磁盘。 |
| `perCwdExtraUserRoots` | array 或 null | 可选。为某些 cwd 添加额外 user scope skill root。只有 `cwd` 同时出现在 `cwds` 中才生效。 |

`perCwdExtraUserRoots[].extraUserRoots` 必须是绝对路径。相对路径会让整个请求返回 JSON-RPC error。`perCwdExtraUserRoots[].cwd` 不在 `cwds` 中时，服务端只记录 warn 并忽略该 entry。

响应：

```json
{
  "id": 25,
  "result": {
    "data": [
      {
        "cwd": "/repo",
        "skills": [
          {
            "name": "skill-creator",
            "description": "Create or update a Codex skill",
            "shortDescription": "Create skills",
            "interface": {
              "displayName": "Skill Creator",
              "shortDescription": "Create skills",
              "iconSmall": "/home/me/.codex/skills/skill-creator/assets/icon.svg",
              "iconLarge": null,
              "brandColor": "#111111",
              "defaultPrompt": "Add a new skill"
            },
            "dependencies": null,
            "path": "/home/me/.codex/skills/skill-creator/SKILL.md",
            "scope": "user",
            "enabled": true
          }
        ],
        "errors": []
      }
    ]
  }
}
```

`SkillsListEntry`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cwd` | path | 该 entry 对应请求 cwd。 |
| `skills` | `SkillMetadata[]` | 发现到的 skills。被禁用的 skill 仍会返回，只是 `enabled: false`。 |
| `errors` | `SkillErrorInfo[]` | skill 解析错误或 cwd 配置解析错误。 |

`SkillMetadata`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 用于 `$skill-name` mention 的名称。plugin skill 可能带 `plugin:` namespace。 |
| `description` | string | `SKILL.md` frontmatter description。 |
| `shortDescription` | string 或缺省 | legacy frontmatter `metadata.short-description`。 |
| `interface` | object 或缺省 | `agents/openai.yaml` 的 UI metadata。 |
| `dependencies` | object 或缺省 | `agents/openai.yaml` 中声明的 tool dependencies。 |
| `path` | absolute path | `SKILL.md` 绝对路径。显式 skill input 推荐使用该路径。 |
| `scope` | `user` / `repo` / `system` / `admin` | skill 来源域。 |
| `enabled` | boolean | 当前 config 叠加后是否启用。 |

### 4.1 `skills/list` 处理流程

服务端大致流程：

1. 如果 `cwds` 为空，替换成 app-server 当前 `self.config.cwd`。
2. 校验并整理 `perCwdExtraUserRoots`。
3. 读取 latest config，并读取当前 auth。
4. 判断 workspace Codex plugins 是否启用。
5. 对每个 cwd：
   - 解析 cwd 对应 config layer stack。
   - 如果 plugins 有效，计算 plugin 提供的 effective skill roots。
   - 构造 `SkillsLoadInput`。
   - 调 `SkillsManager::skills_for_cwd_with_extra_user_roots`。
   - 把 core `SkillMetadata` 映射成 app-server `SkillMetadata`。

如果某个 cwd 的 config 解析失败，该 cwd 的 entry 仍会返回，但 `skills: []`，`errors` 中有一条 `SkillErrorInfo`。其他 cwd 不受影响。

### 4.2 Skill roots 来源

实际扫描 roots 来自多层：

| 来源 | scope | 条件 |
| --- | --- | --- |
| project config folder 下的 `skills` | `repo` | config layer 是 Project，且有 repo filesystem |
| `$CODEX_HOME/skills` | `user` | User config layer，保留的 deprecated 用户目录 |
| `$HOME/.agents/skills` | `user` | User config layer，推荐的用户安装目录之一 |
| `$CODEX_HOME/skills/.system` | `system` | User config layer；内置 system skills 会安装或缓存到这里 |
| system config folder 下的 `skills` | `admin` | System config layer，例如 Unix `/etc/codex/skills` |
| plugin effective skill roots | `user` | plugins feature、workspace policy 和 plugin state 都允许时 |
| repo `.agents/skills` | `repo` | 从 project root 到 cwd 之间每一层存在 `.agents/skills` 时 |
| `perCwdExtraUserRoots` | `user` | 请求显式传入，且默认 execution environment filesystem 存在 |

root 会按路径去重。扫描时对每个 root 做 canonicalize，无法 canonicalize 时保留原路径。

### 4.3 Repo `.agents/skills` 查找范围

repo skills 不是只看 cwd 当前目录。服务端会：

1. 根据 `project_root_markers` 找 project root。
2. 枚举从 project root 到 cwd 的每一级目录。
3. 对每一级目录检查 `.agents/skills`。
4. 存在且是目录的 `.agents/skills` 会作为 repo scope root 加入扫描。

`project_root_markers` 来自非 Project config layer 合并结果；如果没有配置，使用默认 project root markers。

### 4.4 扫描规则

每个 root 的扫描规则：

- 只识别文件名为 `SKILL.md` 的文件。
- 跳过以 `.` 开头的目录项。
- 最大扫描深度是从 root 起 6 层。
- 每个 root 最多访问 2000 个目录，超过只记录 warn。
- repo、user、admin scope 会跟随 symlinked directories。
- system scope 不跟随 symlinked directories。
- 解析失败的非 system skill 会进入 `errors`；system skill 解析失败不会暴露给客户端。

解析成功后，按 canonical `SKILL.md` path 去重。

### 4.5 启停配置

Skill 启停配置来自 config：

```toml
[[skills.config]]
path = "/home/me/.codex/skills/demo/SKILL.md"
enabled = false

[[skills.config]]
name = "github:triage"
enabled = true
```

规则：

- 只读取 User 和 SessionFlags config layer 中的 `skills.config`。
- Project、System、MDM、plugin 等层不会写入用户偏好规则。
- 每条规则必须二选一：`path` 或 `name`。
- `path` 规则会 canonicalize，失败则保留原路径。
- `name` 规则会匹配当前加载出来的所有同名 skill。
- 后出现的同 selector 规则覆盖前面的规则。
- `enabled: false` 会把匹配 path 加入 disabled set。
- `enabled: true` 会从 disabled set 移除。

被禁用的 skill 仍在 `skills/list` 中返回，`enabled` 为 false。它不会被 implicit invocation 选中；显式 structured skill input 也会跳过 disabled path。

### 4.6 缓存语义

`skills/list` 使用 `SkillsManager` 的 cwd cache。关键点：

- 当默认 execution environment filesystem 存在时，`skills_for_cwd_with_extra_user_roots` 会使用按 cwd 缓存。
- `forceReload: true` 会绕过 cwd cache 并重新扫描。
- `forceReload: false` 时，如果 cwd 已有缓存，即使本次传了新的 `perCwdExtraUserRoots`，也可能继续返回旧缓存。
- `skills/config/write` 成功后会清理 plugins cache 和 skills cache。
- 如果 execution environment 被禁用，`perCwdExtraUserRoots` 不会被加入 roots。

## 5. `skills/config/write`

用途：写入用户 config 中的 `[[skills.config]]`，启用或禁用某个 skill。该接口是 path selector 和 name selector 的便捷写入 API。

按 path 禁用：

```json
{
  "id": 26,
  "method": "skills/config/write",
  "params": {
    "path": "/home/me/.codex/skills/demo/SKILL.md",
    "name": null,
    "enabled": false
  }
}
```

按 name 启用：

```json
{
  "id": 27,
  "method": "skills/config/write",
  "params": {
    "path": null,
    "name": "github:triage",
    "enabled": true
  }
}
```

`SkillsConfigWriteParams`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `path` | absolute path 或 null | path/name 二选一 | path selector。 |
| `name` | string 或 null | path/name 二选一 | name selector。空白字符串无效。 |
| `enabled` | boolean | 是 | 目标启停状态。 |

约束：

- 必须恰好提供 `path` 或 `name` 之一。
- `name` 不能是空白字符串。
- 非法请求返回 JSON-RPC invalid params。

响应：

```json
{
  "id": 26,
  "result": {
    "effectiveEnabled": false
  }
}
```

实现细节：

- `path` 会写成 `ConfigEdit::SetSkillConfig`。
- `name` 会写成 `ConfigEdit::SetSkillConfigByName`。
- 由 `ConfigEditsBuilder` 修改 `$CODEX_HOME/config.toml`。
- 成功后清空 `plugins_manager` cache 和 `skills_manager` cache。
- response 里的 `effectiveEnabled` 当前就是请求的 `enabled` 值，不重新计算所有层叠后的最终状态。

## 6. `skills/changed`

通知：

```json
{
  "method": "skills/changed",
  "params": {}
}
```

来源：

- core 的 `skills_watcher` 观察到 skill 文件变化。
- loaded thread 或 thread manager 收到 `SkillsUpdateAvailable`。
- app-server 把它转成 `ServerNotification::SkillsChanged`。

语义：

- 它只是 invalidation signal。
- 通知 payload 为空，不包含变更路径。
- 客户端应使用当前 UI 查询参数重新调用 `skills/list`。
- 如果客户端初始化时 opt out 了 `skills/changed`，则不会收到该通知。

## 7. Skill 使用方式

`skills/list` 只返回 metadata。实际 turn 中使用 skill 有两种路径。

### 7.1 显式 structured skill input

推荐方式是在 `turn/start` 或 `turn/steer` 的 input 中加入 `skill` item：

```json
{
  "type": "skill",
  "name": "skill-creator",
  "path": "/home/me/.codex/skills/skill-creator/SKILL.md"
}
```

core 会先按 path 匹配 enabled skill。disabled skill 会被跳过。

### 7.2 文本 mention

用户也可以在文本里写 `$skill-name`。core 会扫描 text input 的 tool mention：

```json
{
  "type": "text",
  "text": "$skill-creator Add a new skill",
  "textElements": []
}
```

选择规则要点：

- structured skill input 优先按 path 解析。
- 文本 mention 按 name 或 resource link 解析。
- plain name 只有在 enabled skills 中不歧义时才匹配。
- 同名 skill 如果数量大于 1，plain `$name` 可能不会被自动选中。
- connector/app/plugin slug 冲突也会影响 plain mention 解析。

### 7.3 注入到模型上下文

当某些 skill 被显式选中后，core 会读取对应 `SKILL.md` 全文，生成 `<skill>` 开头的 skill instructions block。读取失败不会让 turn 直接崩溃，而是生成 warning。

隐式可用 skills 列表也会进入 developer instructions。该列表只包含 enabled 且 `allow_implicit_invocation` 允许的 skills。为控制上下文成本，渲染层可能截断 description 或省略部分 skills。

## 8. Hooks 核心概念

Hook 是 Codex 在特定事件点运行的命令。当前 app-server 暴露的 hooks 主要是 Claude hooks 兼容风格，但实现落在 `codex_hooks` crate。

Hook 分两部分：

- 静态发现：`hooks/list` 返回当前 cwd 下可发现的 hook metadata。
- 运行时执行：thread/turn 过程中，hook engine 按事件、matcher、enabled 状态选择并运行 command，然后发 `hook/started` / `hook/completed`。

当前支持的事件名：

| config 名 | app-server wire enum | 触发点 |
| --- | --- | --- |
| `SessionStart` | `sessionStart` | thread/session 启动或 clear 后启动 |
| `UserPromptSubmit` | `userPromptSubmit` | 用户 prompt 提交时 |
| `PreToolUse` | `preToolUse` | tool 执行前 |
| `PermissionRequest` | `permissionRequest` | permission/approval request 阶段 |
| `PostToolUse` | `postToolUse` | tool 执行后 |
| `Stop` | `stop` | turn 停止阶段 |

只有 `PreToolUse`、`PermissionRequest`、`PostToolUse`、`SessionStart` 的 matcher 有意义。`UserPromptSubmit` 和 `Stop` 即使配置了 matcher，发现和执行时也会忽略 matcher。

## 9. `hooks/list`

用途：按一个或多个 cwd 解析有效 config layer stack，返回该 cwd 下可展示的 hooks。

请求：

```json
{
  "id": 28,
  "method": "hooks/list",
  "params": {
    "cwds": ["/repo"]
  }
}
```

`HooksListParams`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cwds` | path[] | 可省略或空数组。为空时使用 app-server 当前 session cwd。允许相对路径，响应里保留原请求 cwd。 |

响应：

```json
{
  "id": 28,
  "result": {
    "data": [
      {
        "cwd": "/repo",
        "hooks": [
          {
            "key": "/home/me/.codex/config.toml:pre_tool_use:0:0",
            "eventName": "preToolUse",
            "handlerType": "command",
            "matcher": "Bash",
            "command": "python3 /tmp/listed-hook.py",
            "timeoutSec": 5,
            "statusMessage": "running listed hook",
            "sourcePath": "/home/me/.codex/config.toml",
            "source": "user",
            "pluginId": null,
            "displayOrder": 0,
            "enabled": true,
            "isManaged": false
          }
        ],
        "warnings": [],
        "errors": []
      }
    ]
  }
}
```

`HooksListEntry`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cwd` | path | 请求 cwd。 |
| `hooks` | `HookMetadata[]` | 当前 cwd 下发现的 hooks。disabled hooks 仍会返回。 |
| `warnings` | string[] | 解析 hooks 时的 warning，例如 plugin hooks JSON 解析失败。 |
| `errors` | `HookErrorInfo[]` | cwd config 加载失败。 |

`HookMetadata`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | string | 用于 `hooks.state` 启停的稳定性有限 key。当前包含 source、event、group index、handler index。 |
| `eventName` | enum | `preToolUse`、`permissionRequest`、`postToolUse`、`sessionStart`、`userPromptSubmit`、`stop`。 |
| `handlerType` | enum | 当前只有 `command` 会真正进入可运行列表；`prompt` / `agent` 会被跳过并产生 warning。 |
| `matcher` | string 或 null | 对支持 matcher 的事件用于匹配工具名或 session source。 |
| `command` | string 或 null | command handler 的命令字符串。 |
| `timeoutSec` | number | 超时时间，默认 600，最小 1。 |
| `statusMessage` | string 或 null | hook 运行时 UI 可展示状态。 |
| `sourcePath` | absolute path | hooks 来源文件路径。 |
| `source` | enum | `system`、`user`、`project`、`mdm`、`sessionFlags`、`plugin`、`cloudRequirements` 等。 |
| `pluginId` | string 或 null | plugin hook 的 plugin id，例如 `demo@test`。 |
| `displayOrder` | number | 发现顺序。 |
| `enabled` | boolean | 是否实际会进入 runtime handlers。managed source 永远视为 enabled。 |
| `isManaged` | boolean | 是否由 system、MDM、cloud requirements、legacy managed config 等托管来源提供。 |

### 9.1 `hooks/list` 处理流程

服务端大致流程：

1. 如果 `cwds` 为空，替换成 app-server 当前 `self.config.cwd`。
2. 对每个 cwd 调 `config_manager.load_for_cwd`。
3. 如果 config 加载失败，该 cwd 返回 `hooks: []`、`warnings: []`、`errors` 一条。
4. 判断 plugins feature 和 workspace Codex plugins policy。
5. 如果 `features.plugins`、workspace plugins、`features.plugin_hooks` 都允许，加载 plugin hook sources。
6. 调 `codex_hooks::list_hooks`：
   - `feature_enabled` 来自 `features.codex_hooks`。
   - `config_layer_stack` 使用该 cwd 的有效 config stack。
   - `plugin_hook_sources` 来自 plugin load outcome。
   - `plugin_hook_load_warnings` 透传到 response warnings。
7. 把 core `HookListEntry` 映射成 app-server `HookMetadata`。

注意：`hooks/list` 会对每个 cwd 单独加载 config，因此同一请求里不同 cwd 可以有不同 feature gate 和不同 project hooks。

## 10. Hooks 配置格式

Hooks 可以从两种项目/用户配置表示读取：`config.toml` 中的 `[hooks]`，以及 config folder 下的 `hooks.json`。

### 10.1 TOML 配置

```toml
[features]
codex_hooks = true

[hooks]

[[hooks.PreToolUse]]
matcher = "Bash"

[[hooks.PreToolUse.hooks]]
type = "command"
command = "python3 /tmp/listed-hook.py"
timeout = 5
statusMessage = "running listed hook"

[[hooks.UserPromptSubmit]]

[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = "python3 /tmp/user-prompt.py"
```

### 10.2 JSON 配置

`hooks.json`：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo hello",
            "timeout": 5,
            "statusMessage": "running hook"
          }
        ]
      }
    ]
  }
}
```

每个事件名映射到 `MatcherGroup[]`。每个 group：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `matcher` | string 或缺省 | 可选 matcher。空字符串或 `*` 表示 match all。 |
| `hooks` | array | handler 列表。 |

当前 handler 类型：

| `type` | 当前行为 |
| --- | --- |
| `command` | 支持，实际运行 shell command。 |
| `prompt` | 发现时跳过，产生 warning：暂不支持。 |
| `agent` | 发现时跳过，产生 warning：暂不支持。 |

`command` handler 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `command` | string | 必填。trim 后为空会被跳过并产生 warning。 |
| `timeout` | number 或缺省 | 秒，默认 600，最小 1。 |
| `async` | boolean | 当前不支持。为 true 会被跳过并产生 warning。 |
| `statusMessage` | string 或缺省 | 运行状态展示文本。 |

如果同一 config layer 同时存在 `hooks.json` 和 `config.toml` 中的 hooks，且两者都非空，服务端会产生 warning，建议同一层只使用一种表示。

## 11. Hook 来源与发现顺序

`discover_handlers` 的顺序：

1. managed requirements hooks。
2. config layer stack 中的 hooks，按 LowestPrecedenceFirst。
3. plugin hook sources。

每发现一个可用 command handler，会分配递增的 `displayOrder`。

普通 config layer 的 source 映射：

| ConfigLayerSource | HookSource |
| --- | --- |
| System | `system` |
| User | `user` |
| Project | `project` |
| Mdm | `mdm` |
| SessionFlags | `sessionFlags` |
| LegacyManagedConfigTomlFromFile | `legacyManagedConfigFile` |
| LegacyManagedConfigTomlFromMdm | `legacyManagedConfigMdm` |

Managed requirements 可能映射到 `mdm`、`system`、`cloudRequirements`、legacy managed source 或 `unknown`。

Plugin hooks 的特殊点：

- 只有 `features.plugins`、workspace policy、`features.plugin_hooks` 都允许时才加载。
- source 是 `plugin`。
- `pluginId` 是 plugin key，例如 `demo@test`。
- hook key 的 source 部分不是绝对路径，而是类似 `demo@test:hooks/hooks.json`。
- command 中的 `${PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_ROOT}`、`${PLUGIN_DATA}`、`${CLAUDE_PLUGIN_DATA}` 会替换成 plugin 路径。

## 12. Hook key 与启停状态

Hook key 当前格式：

```text
{keySource}:{event_label}:{group_index}:{handler_index}
```

例子：

```text
/home/me/.codex/config.toml:pre_tool_use:0:0
demo@test:hooks/hooks.json:pre_tool_use:0:0
```

`event_label` 是 snake_case：

| event | key label |
| --- | --- |
| `PreToolUse` | `pre_tool_use` |
| `PermissionRequest` | `permission_request` |
| `PostToolUse` | `post_tool_use` |
| `SessionStart` | `session_start` |
| `UserPromptSubmit` | `user_prompt_submit` |
| `Stop` | `stop` |

服务端代码里有 TODO：未来可能用 durable hook id 替代 positional suffix。因此客户端应把 `key` 当作当前版本内的启停 key，不要假设长期稳定。

### 12.1 启停配置

Hooks 没有单独的 `hooks/config/write` API。启停通过通用 config 写接口：

```json
{
  "id": 29,
  "method": "config/batchWrite",
  "params": {
    "edits": [
      {
        "keyPath": "hooks.state",
        "value": {
          "/home/me/.codex/config.toml:pre_tool_use:0:0": {
            "enabled": false
          }
        },
        "mergeStrategy": "upsert"
      }
    ],
    "reloadUserConfig": true
  }
}
```

对应 TOML 概念：

```toml
[hooks.state."/home/me/.codex/config.toml:pre_tool_use:0:0"]
enabled = false
```

启停规则：

- 只读取 User 和 SessionFlags config layer 中的 `hooks.state`。
- Project、managed、plugin hooks 可以被发现，但不直接写用户 enablement state。
- later layer wins。
- `enabled = false` 加入 disabled key set。
- `enabled = true` 从 disabled key set 移除。
- 缺少 `enabled` 的 state entry 会被忽略，未来可承载其他 per-hook state。
- malformed state entry 会被忽略。
- managed source 不受 user state 禁用影响，`enabled` 永远为 true，`isManaged` 为 true。

被禁用的非 managed hook 仍会出现在 `hooks/list` 中，但 runtime handlers 不包含它，因此不会运行。

## 13. Matcher 语义

支持 matcher 的事件：

- `PreToolUse`
- `PermissionRequest`
- `PostToolUse`
- `SessionStart`

不支持 matcher 的事件：

- `UserPromptSubmit`
- `Stop`

匹配规则：

| matcher | 行为 |
| --- | --- |
| 省略 | match all |
| `""` | match all |
| `*` | match all |
| 只含 ASCII 字母数字、`_`、`|` | exact match，`|` 表示候选值之一 |
| 其他字符串 | 作为 Rust regex 匹配 |

例子：

| matcher | 输入 | 结果 |
| --- | --- | --- |
| `Bash` | `Bash` | match |
| `Bash` | `BashOutput` | 不 match |
| `Edit|Write` | `Edit` | match |
| `mcp__memory__.*` | `mcp__memory__create_entities` | match |
| `^Bash$` | `BashOutput` | 不 match |

发现阶段会校验支持 matcher 的事件。如果 matcher 是非法 regex，该 group 会被跳过并产生 warning。不支持 matcher 的事件会直接把 matcher 置为 null，不校验也不使用。

执行阶段会按 event 和 matcher 选择 handlers。工具类事件可以传入多个 matcher aliases，但同一个 handler 只会运行一次。

## 14. Hook 运行时

Hook runtime 会在 thread/turn 生命周期中调用 `preview_*` 和 `run_*`。客户端主要关心两个通知。

### 14.1 `hook/started`

```json
{
  "method": "hook/started",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "run": {
      "id": "pre-tool-use:0:/home/me/.codex/config.toml",
      "eventName": "preToolUse",
      "handlerType": "command",
      "executionMode": "sync",
      "scope": "turn",
      "sourcePath": "/home/me/.codex/config.toml",
      "source": "user",
      "displayOrder": 0,
      "status": "running",
      "statusMessage": "running listed hook",
      "startedAt": 1760000000,
      "completedAt": null,
      "durationMs": null,
      "entries": []
    }
  }
}
```

### 14.2 `hook/completed`

```json
{
  "method": "hook/completed",
  "params": {
    "threadId": "thr_1",
    "turnId": "turn_1",
    "run": {
      "id": "pre-tool-use:0:/home/me/.codex/config.toml",
      "eventName": "preToolUse",
      "handlerType": "command",
      "executionMode": "sync",
      "scope": "turn",
      "sourcePath": "/home/me/.codex/config.toml",
      "source": "user",
      "displayOrder": 0,
      "status": "completed",
      "statusMessage": "running listed hook",
      "startedAt": 1760000000,
      "completedAt": 1760000001,
      "durationMs": 123,
      "entries": []
    }
  }
}
```

`HookRunSummary` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 运行 id。普通形式是 `{event-label}:{displayOrder}:{sourcePath}`，工具相关完成事件可能追加 `:{toolUseId}`。 |
| `eventName` | enum | 事件名。 |
| `handlerType` | enum | 当前实际运行的是 `command`。 |
| `executionMode` | enum | 当前实际运行的是 `sync`。 |
| `scope` | `thread` / `turn` | `SessionStart` 是 thread scope，其余当前为 turn scope。 |
| `sourcePath` | absolute path | hooks 来源。 |
| `source` | enum | hook 来源。 |
| `displayOrder` | number | 发现顺序。 |
| `status` | enum | `running`、`completed`、`failed`、`blocked`、`stopped`。 |
| `statusMessage` | string 或 null | 配置中的 statusMessage。 |
| `startedAt` | number | Unix 秒。 |
| `completedAt` | number 或 null | Unix 秒。 |
| `durationMs` | number 或 null | 运行耗时。 |
| `entries` | array | hook 输出条目。 |

`HookOutputEntry.kind`：

- `warning`
- `stop`
- `feedback`
- `context`
- `error`

## 15. Command hook 执行模型

当前可运行 hook handler 只有 command。

运行方式：

- 默认 shell：
  - Windows：`%COMSPEC% /C <command>`，没有 `COMSPEC` 时用 `cmd.exe /C`。
  - 非 Windows：`$SHELL -lc <command>`，没有 `SHELL` 时用 `/bin/sh -lc`。
- 如果 hook engine 配置了自定义 shell program，则用该 program，加上 shell args，再追加 command。
- command 的 cwd 是触发事件的 cwd。
- hook input JSON 写入 stdin。
- stdout、stderr 会完整读取为 UTF-8 lossy string。
- 超时使用 `timeoutSec`。
- 进程对象 `kill_on_drop(true)`。

运行失败分类：

- spawn 失败：`error` 有错误信息。
- 写 stdin 失败：kill child，`error` 是写入失败。
- wait 失败：`error` 是 wait 错误。
- 超时：`error` 是 `hook timed out after Ns`。
- exit code 非零：具体是否 failed/blocked 由各事件 parser 和 handler parse 逻辑决定。

## 16. Hook input/output 大致形状

Hook command 的 stdin 是 JSON。不同事件字段不同，但共同字段通常包括：

- `session_id`
- `turn_id`，除了 `SessionStart` 没有 turn id
- `transcript_path`
- `cwd`
- `hook_event_name`
- `model`
- `permission_mode`

工具类事件还包括：

- `tool_name`
- `tool_input`
- `tool_use_id`
- `tool_response`，仅 `PostToolUse`

`UserPromptSubmit` 包含：

- `prompt`

`SessionStart` 包含：

- `source`，例如 startup 或 clear

`Stop` 包含：

- `stop_hook_active`
- `last_assistant_message`

command stdout 如果是空或不是 JSON object，通常视为没有结构化 hook output。结构化 output 使用 camelCase。

通用 output 字段：

```json
{
  "continue": true,
  "stopReason": null,
  "suppressOutput": false,
  "systemMessage": null
}
```

不同事件支持的 hook-specific output 不同。当前实现有一些限制：

- `PreToolUse` 不支持 `continue: false`、`stopReason`、`suppressOutput`。
- `PermissionRequest` 不支持 `continue: false`、`stopReason`、`suppressOutput`，也不支持 `updatedInput`、`updatedPermissions`、`interrupt: true`。
- `PostToolUse` 不支持 `suppressOutput`。
- `UserPromptSubmit` 和 `Stop` 支持 `decision: "block"`，但必须提供非空 `reason`。

部分 output 示例：

`PreToolUse` legacy block：

```json
{
  "decision": "block",
  "reason": "Do not run this command"
}
```

`PermissionRequest` allow/deny：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "deny",
      "message": "Not allowed"
    }
  }
}
```

`PostToolUse` 追加上下文：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Remember this result"
  }
}
```

`UserPromptSubmit` 阻塞：

```json
{
  "decision": "block",
  "reason": "Prompt violates local policy"
}
```

## 17. 客户端实现建议

Skills：

1. 页面初始化或 cwd 切换时调用 `skills/list`。
2. 用户手动刷新时设置 `forceReload: true`。
3. 收到 `skills/changed` 后，使用当前查询参数重新调用 `skills/list`。
4. UI 中不要隐藏 disabled skill 太早；可以展示为 disabled，并允许用户通过 `skills/config/write` 改回 enabled。
5. 发起 turn 时优先发送 structured `skill` input，使用 `skills/list` 返回的 `path`。
6. 处理重名 skill 时，不要只靠 name 存储选择状态，path 更准确。

Hooks：

1. 页面初始化或 cwd 切换时调用 `hooks/list`。
2. 使用 `key` 写入 `hooks.state`，但不要假设 key 跨版本长期稳定。
3. `isManaged: true` 的 hooks 不应提供启停按钮，或至少不能通过用户 config 禁用。
4. 修改 hook state 推荐使用 `config/batchWrite`，`keyPath: "hooks.state"`，`mergeStrategy: "upsert"`，并设置 `reloadUserConfig: true`。
5. hook 运行展示应以 `hook/started` 和 `hook/completed` 为准，按 `run.id` 或 `displayOrder + eventName + sourcePath` 关联。
6. `hooks/list.warnings` 应展示给高级用户或诊断面板，尤其是 plugin hook parse warnings。

## 18. 维护方式

协议可能随原生 Codex 更新。维护本文时优先检查：

1. `app-server-protocol/src/protocol/common.rs`：`skills/list`、`skills/config/write`、`hooks/list`、`skills/changed`、`hook/started`、`hook/completed` 的 wire 名称。
2. `app-server-protocol/src/protocol/v2.rs`：Skills、Hooks 的 request/response/notification payload。
3. `app-server/src/codex_message_processor.rs`：app-server request handler。
4. `core-skills/src/manager.rs`：skills cache、roots、config rules。
5. `core-skills/src/loader.rs`：skill root 扫描、`SKILL.md` 和 `agents/openai.yaml` 解析。
6. `core-skills/src/config_rules.rs`：`skills.config` 启停规则。
7. `hooks/src/registry.rs`：hooks list 和 runtime engine 入口。
8. `hooks/src/engine/discovery.rs`：hooks source、key、enabled、warning、plugin env 替换。
9. `hooks/src/engine/dispatcher.rs`：runtime handler 选择、run summary。
10. `hooks/src/schema.rs` 和 `hooks/src/engine/output_parser.rs`：hook command stdin/stdout 结构。
11. `config/src/skills_config.rs` 和 `config/src/hook_config.rs`：TOML/JSON 配置形状。

原生仓库可以生成 schema：

```bash
codex app-server generate-ts --out DIR
codex app-server generate-json-schema --out DIR
```

当 schema 与本文冲突时，以原生 Rust 类型和生成 schema 为准。
