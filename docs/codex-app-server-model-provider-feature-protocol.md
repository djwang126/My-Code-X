# Codex App Server 模型、Provider、协作模式与实验功能协议详解

本文档说明原生 Codex `codex app-server` 中与模型列表、模型 provider 能力、协作模式 preset、实验功能列表和实验功能启停相关的 JSON-RPC 接口。文档只覆盖这些查询和配置类接口，不覆盖普通聊天 turn 事件流。

本文基于本机相邻仓库 `../codex` 的 Rust 实现分析，主要事实来源：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`
- `../codex/codex-rs/app-server/src/message_processor.rs`
- `../codex/codex-rs/app-server/src/config_api.rs`
- `../codex/codex-rs/app-server/src/models.rs`
- `../codex/codex-rs/model-provider/src/provider.rs`
- `../codex/codex-rs/model-provider/src/amazon_bedrock/mod.rs`
- `../codex/codex-rs/models-manager/src/collaboration_mode_presets.rs`
- `../codex/codex-rs/features/src/lib.rs`

## 1. 范围

本文覆盖这些客户端 request：

| method | 稳定性 | 用途 |
| --- | --- | --- |
| `model/list` | 稳定 | 列出可用模型 picker metadata。 |
| `modelProvider/capabilities/read` | 稳定 | 读取当前配置 model provider 的工具能力上限。 |
| `collaborationMode/list` | 实验性 | 列出协作模式 preset。 |
| `experimentalFeature/list` | 稳定 | 分页列出 Codex feature registry 中的功能开关。 |
| `experimentalFeature/enablement/set` | 稳定 | 写入进程级 runtime feature enablement override。 |

本文不覆盖：

- `turn/start` 中如何实际选择模型、service tier、reasoning effort 或 collaboration mode。
- 模型请求体如何发给 Responses API。
- `config/read` / `config/value/write` / `config/batchWrite` 的完整配置协议。
- app/plugin/skill/MCP 的详细协议。

## 2. 基础协议约束

这些接口和聊天接口使用同一个 app-server transport 和 JSON-RPC-lite 形状：

```json
{
  "id": 1,
  "method": "model/list",
  "params": {}
}
```

成功响应：

```json
{
  "id": 1,
  "result": {}
}
```

错误响应：

```json
{
  "id": 1,
  "error": {
    "code": -32600,
    "message": "invalid cursor: abc"
  }
}
```

连接仍然必须先完成：

```text
initialize request
initialized notification
```

`collaborationMode/list` 是实验性 method。客户端要调用它，初始化时必须发送：

```json
{
  "id": 0,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "my_client",
      "title": "My Client",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true
    }
  }
}
```

如果未启用 `experimentalApi`，app-server 会在协议层拒绝实验性 method 或字段。

## 3. 接口总览

| method | params | response | 通知 |
| --- | --- | --- | --- |
| `model/list` | `ModelListParams` | `ModelListResponse` | 无 |
| `modelProvider/capabilities/read` | `{}` | `ModelProviderCapabilitiesReadResponse` | 无 |
| `collaborationMode/list` | `{}` | `CollaborationModeListResponse` | 无 |
| `experimentalFeature/list` | `ExperimentalFeatureListParams` | `ExperimentalFeatureListResponse` | 无 |
| `experimentalFeature/enablement/set` | `ExperimentalFeatureEnablementSetParams` | `ExperimentalFeatureEnablementSetResponse` | 可能间接触发 `app/list/updated` |

注意：

- 这些接口自身都没有专属 server notification。
- `experimentalFeature/enablement/set` 如果把 `apps` 设置为 `true`，且当前 auth/config 允许 apps，server 会异步刷新 app list，并可能发送 `app/list/updated`。
- `model/list` 和 `experimentalFeature/list` 都使用整数 offset 字符串作为 opaque cursor；客户端应把 cursor 当不透明字符串保存，不要依赖它永远是数字。

## 4. `model/list`

用途：列出 Codex 当前可用模型 metadata，供模型选择器、默认模型标记、reasoning effort 选择、升级提示等 UI 使用。

请求：

```json
{
  "id": 10,
  "method": "model/list",
  "params": {
    "cursor": null,
    "limit": 20,
    "includeHidden": false
  }
}
```

`ModelListParams`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cursor` | string 或 null | 否 | 上一页响应中的 `nextCursor`。省略或 null 表示从头开始。 |
| `limit` | number 或 null | 否 | 页大小。省略时默认一次返回当前过滤后的全部模型。`0` 会被 clamp 到 `1`。 |
| `includeHidden` | boolean 或 null | 否 | 为 true 时包含默认 picker 不展示的 hidden model；默认 false。 |

响应：

```json
{
  "id": 10,
  "result": {
    "data": [
      {
        "id": "gpt-5.1-codex",
        "model": "gpt-5.1-codex",
        "upgrade": null,
        "upgradeInfo": null,
        "availabilityNux": null,
        "displayName": "GPT-5.1 Codex",
        "description": "Fast coding model.",
        "hidden": false,
        "supportedReasoningEfforts": [
          {
            "reasoningEffort": "medium",
            "description": "Balanced speed and reasoning"
          }
        ],
        "defaultReasoningEffort": "medium",
        "inputModalities": ["text", "image"],
        "supportsPersonality": true,
        "additionalSpeedTiers": [],
        "isDefault": true
      }
    ],
    "nextCursor": null
  }
}
```

`Model` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 模型 preset id，通常也是客户端传给 `thread/start.model` 或 `turn/start.model` 的值。 |
| `model` | string | 实际 model slug。 |
| `upgrade` | string 或 null | legacy 推荐升级模型 id。 |
| `upgradeInfo` | object 或 null | 更完整的升级信息。 |
| `availabilityNux` | object 或 null | 模型可用性提示文案。 |
| `displayName` | string | UI 展示名。 |
| `description` | string | UI 描述。 |
| `hidden` | boolean | 是否默认从 picker 隐藏。 |
| `supportedReasoningEfforts` | `ReasoningEffortOption[]` | 可选 reasoning effort 列表。 |
| `defaultReasoningEffort` | `ReasoningEffort` | 默认 reasoning effort。 |
| `inputModalities` | `InputModality[]` | 支持的输入模态。旧 payload 缺省时按 `["text", "image"]` 处理。 |
| `supportsPersonality` | boolean | 是否支持 personality-specific instructions。 |
| `additionalSpeedTiers` | string[] | 除标准路径外可用的额外速度层级。 |
| `isDefault` | boolean | 是否为默认模型。正常只应有一个 true。 |

`ReasoningEffort` wire 值：

- `none`
- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`

`InputModality` wire 值：

- `text`
- `image`

`ModelUpgradeInfo`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | 推荐升级到的模型 id。 |
| `upgradeCopy` | string 或 null | UI 可展示的升级文案。 |
| `modelLink` | string 或 null | 模型说明链接。 |
| `migrationMarkdown` | string 或 null | 迁移说明 markdown。 |

`ModelAvailabilityNux`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message` | string | 新可用模型提示文案。 |

### 4.1 实现行为

`model/list` 在 `CodexMessageProcessor` 中异步处理。实现流程：

1. 调用 `supported_models(thread_manager, includeHidden)`。
2. `supported_models` 通过 `ThreadManager.list_models(RefreshStrategy::OnlineIfUncached)` 获取模型列表。
3. 若 `includeHidden` 不是 true，则过滤掉 `show_in_picker == false` 的 preset。
4. 将 `ModelPreset` 映射成 app-server protocol `Model`。
5. 对过滤后的数组做 offset cursor 分页。

分页规则：

- `limit` 省略时返回全部过滤结果。
- `limit = 0` 按 `1` 处理。
- `cursor` 需要能 parse 成 `usize`。
- `cursor > total` 会返回 JSON-RPC error。
- `nextCursor` 是下一页起始 offset 的字符串；没有下一页时为 null。

错误示例：

```json
{
  "id": 11,
  "error": {
    "code": -32600,
    "message": "invalid cursor: invalid"
  }
}
```

```json
{
  "id": 12,
  "error": {
    "code": -32600,
    "message": "cursor 99 exceeds total models 10"
  }
}
```

### 4.2 客户端建议

- 模型 picker 默认调用 `includeHidden: false`。
- 调试、迁移、历史会话模型展示可以调用 `includeHidden: true`。
- 不要硬编码模型列表；以 `model/list` 返回为准。
- `id` 更适合作为客户端选择值；`model` 是底层 slug，二者当前可能相同，但协议上不是同一语义。
- `isDefault` 是服务端计算结果，客户端不应自行猜默认模型。

## 5. `modelProvider/capabilities/read`

用途：读取当前配置的 model provider 支持哪些 provider-owned 能力。它表达的是 provider 能力上限，不代表当前 turn 一定会启用这些工具。普通配置、权限、auth、review mode 等仍然可以进一步禁用能力。

请求：

```json
{
  "id": 20,
  "method": "modelProvider/capabilities/read",
  "params": {}
}
```

响应：

```json
{
  "id": 20,
  "result": {
    "namespaceTools": true,
    "imageGeneration": true,
    "webSearch": true
  }
}
```

`ModelProviderCapabilitiesReadResponse`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `namespaceTools` | boolean | provider 是否支持 namespace tool 表达。 |
| `imageGeneration` | boolean | provider 是否支持 image generation tool。 |
| `webSearch` | boolean | provider 是否支持 web search tool。 |

### 5.1 实现行为

这个请求由 app-server 外层 `MessageProcessor` 处理，而不是进入 `CodexMessageProcessor`。

实现流程：

1. 加载最新 config。
2. 从 `config.model_provider` 创建 provider。
3. 调用 provider 的 `capabilities()`。
4. 返回 `namespaceTools`、`imageGeneration`、`webSearch`。

默认 provider capability 是：

```json
{
  "namespaceTools": true,
  "imageGeneration": true,
  "webSearch": true
}
```

Amazon Bedrock provider 当前显式返回：

```json
{
  "namespaceTools": false,
  "imageGeneration": false,
  "webSearch": false
}
```

### 5.2 客户端建议

- 把这个接口当作“provider 能力上限”。
- UI 可以据此隐藏明显不可用的 provider-level 工具能力。
- 不要用它判断某个具体 turn 最终一定会包含 web search 或 image generation；turn 级配置还会继续裁剪。
- provider 来自当前最新 config；如果客户端刚改了 config，先等 config write 成功，再重新读取 capabilities。

## 6. `collaborationMode/list`

用途：列出 Codex 内置协作模式 preset，供 UI 展示模式切换入口，或作为 `turn/start.collaborationMode` 的构造参考。

该 method 是实验性 API，需要 `initialize.params.capabilities.experimentalApi = true`。

请求：

```json
{
  "id": 30,
  "method": "collaborationMode/list",
  "params": {}
}
```

响应：

```json
{
  "id": 30,
  "result": {
    "data": [
      {
        "name": "Plan",
        "mode": "plan",
        "model": null,
        "reasoning_effort": "medium"
      },
      {
        "name": "Default",
        "mode": "default",
        "model": null,
        "reasoning_effort": null
      }
    ]
  }
}
```

注意：`reasoning_effort` 在这个 response 中是 snake_case 字段，不是 `reasoningEffort`。这是协议类型上显式 rename 的结果。

`CollaborationModeMask`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | UI 展示名。 |
| `mode` | `ModeKind` 或 null | 模式类型。当前 TUI 可见内置值是 `default` 和 `plan`。 |
| `model` | string 或 null | preset 指定的模型。内置 preset 当前不指定模型。 |
| `reasoning_effort` | `ReasoningEffort` 或 null | preset 对 reasoning effort 的覆盖语义。当前服务端响应会把无覆盖序列化为 null。 |

`ModeKind` wire 值：

- `default`
- `plan`

Rust 类型中还保留了 `pair_programming`、`execute` 的历史/隐藏变体，但它们被 skip serialization/deserialization，不应作为 wire API 使用。

### 6.1 内置 preset

当前 `builtin_collaboration_mode_presets()` 返回顺序固定：

1. `Plan`
2. `Default`

`Plan` preset：

```json
{
  "name": "Plan",
  "mode": "plan",
  "model": null,
  "reasoning_effort": "medium"
}
```

`Default` preset：

```json
{
  "name": "Default",
  "mode": "default",
  "model": null,
  "reasoning_effort": null
}
```

原始 core `CollaborationModeMask` 还包含 `developer_instructions`，但 app-server 的 `collaborationMode/list` 响应刻意不暴露这个字段。README 也明确说明：客户端如果要使用 Codex 内置 developer instructions，应在 `turn/start` 里传 `settings.developer_instructions: null`，让服务端根据 mode 补齐内置 instructions；或者客户端自己显式提供 instructions。

### 6.2 与 `turn/start.collaborationMode` 的关系

`collaborationMode/list` 只返回 preset metadata。真正启用模式发生在 `turn/start` 或相关 turn 配置中。

`turn/start` 中的 core `CollaborationMode` shape 大致是：

```json
{
  "mode": "plan",
  "settings": {
    "model": "gpt-5.1-codex",
    "reasoning_effort": "medium",
    "developer_instructions": null
  }
}
```

字段命名来自 core `CollaborationMode`，其中 `reasoning_effort` 和 `developer_instructions` 是 snake_case。客户端需要按对应 schema 处理，不要假设所有 app-server payload 都统一 camelCase。

### 6.3 客户端建议

- 调用前启用 `experimentalApi`。
- 不要在 UI 中展示隐藏的 historical mode。
- 如果只是让 Codex 使用内置 mode 指令，`developer_instructions` 传 null；不要复制服务端内置 prompt 到客户端。
- `collaborationMode/list` 无分页。
- 当前内置 preset 不选择模型；客户端仍需用当前模型或用户选择的模型。

## 7. `experimentalFeature/list`

用途：列出 Codex 内部 feature registry 中的 feature flag，包括 stage、默认启用状态、当前启用状态，以及 beta 功能的 UI 文案。

请求：

```json
{
  "id": 40,
  "method": "experimentalFeature/list",
  "params": {
    "cursor": null,
    "limit": 20
  }
}
```

`ExperimentalFeatureListParams`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cursor` | string 或 null | 否 | 上一页响应的 `nextCursor`。 |
| `limit` | number 或 null | 否 | 页大小。省略时返回全部 feature。`0` 会被 clamp 到 `1`。 |

响应：

```json
{
  "id": 40,
  "result": {
    "data": [
      {
        "name": "memories",
        "stage": "beta",
        "displayName": "Memories",
        "description": "Allow Codex to create new memories from conversations and bring relevant memories into new conversations.",
        "announcement": "NEW: Codex can now generate and uses memories. Try is now with `/memories`",
        "enabled": false,
        "defaultEnabled": false
      },
      {
        "name": "tool_search",
        "stage": "stable",
        "displayName": null,
        "description": null,
        "announcement": null,
        "enabled": true,
        "defaultEnabled": true
      }
    ],
    "nextCursor": null
  }
}
```

`ExperimentalFeature`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | canonical feature key，用于 config.toml 和 enablement API。 |
| `stage` | `ExperimentalFeatureStage` | 生命周期阶段。 |
| `displayName` | string 或 null | beta 功能给 UI 展示的名称。非 beta 为 null。 |
| `description` | string 或 null | beta 功能描述。非 beta 为 null。 |
| `announcement` | string 或 null | beta 功能公告文案。非 beta 为 null。 |
| `enabled` | boolean | 按当前最新 config 和 workspace gating 计算出的启用状态。 |
| `defaultEnabled` | boolean | 代码默认值。 |

`ExperimentalFeatureStage` wire 值：

| 值 | 说明 |
| --- | --- |
| `beta` | 用户可测试和反馈。Rust 内部对应 `Stage::Experimental`。 |
| `underDevelopment` | 开发中，未准备好广泛使用。 |
| `stable` | 生产可用。 |
| `deprecated` | 已废弃，应避免使用。 |
| `removed` | 仅为兼容保留。 |

### 7.1 实现行为

实现流程：

1. 加载最新 config。
2. 读取当前 auth。
3. 查询 workspace 是否允许 Codex plugins。
4. 遍历 `codex_features::FEATURES`。
5. 将内部 `Stage` 映射成 app-server `ExperimentalFeatureStage`。
6. 计算 `enabled` 和 `defaultEnabled`。
7. 做 offset cursor 分页。

`enabled` 的计算有一个特殊点：

- 通常是 `config.features.enabled(spec.id)`。
- 对 `apps` 和 `plugins`，如果 workspace 不允许 Codex plugins，则即使 config 中 feature enabled，响应里的 `enabled` 也会变成 false。
- 如果 workspace setting 拉取失败，当前实现会记录 warning 并按允许 Codex plugins 处理。

分页错误和 `model/list` 类似：

```json
{
  "id": 41,
  "error": {
    "code": -32600,
    "message": "invalid cursor: abc"
  }
}
```

```json
{
  "id": 42,
  "error": {
    "code": -32600,
    "message": "cursor 99 exceeds total feature flags 43"
  }
}
```

### 7.2 当前 registry 形状

`experimentalFeature/list` 返回的是完整 feature registry，不只是能被 `experimentalFeature/enablement/set` 修改的 feature。

当前 registry 包含不同阶段的功能，例如：

| feature key | stage | defaultEnabled |
| --- | --- | --- |
| `shell_tool` | `stable` | true |
| `unified_exec` | `stable` | 非 Windows 默认 true，Windows 默认 false |
| `shell_zsh_fork` | `underDevelopment` | false |
| `terminal_resize_reflow` | `beta` | true |
| `memories` | `beta` | false |
| `codex_hooks` | `stable` | true |
| `multi_agent` | `stable` | true |
| `multi_agent_v2` | `underDevelopment` | false |
| `apps` | `stable` | true |
| `tool_search` | `stable` | true |
| `tool_suggest` | `stable` | true |
| `plugins` | `stable` | true |
| `in_app_browser` | `stable` | true |
| `browser_use` | `stable` | true |
| `image_generation` | `stable` | true |
| `goals` | `underDevelopment` | false |
| `tool_call_mcp_elicitation` | `stable` | true |
| `personality` | `stable` | true |
| `realtime_conversation` | `underDevelopment` | false |
| `remote_control` | `underDevelopment` | false |
| `prevent_idle_sleep` | `beta` 或 `underDevelopment`，取决于平台 | false |
| `workspace_dependencies` | `stable` | true |

维护文档时不要手写完整 registry 作为权威列表；以 `codex_features::FEATURES` 和运行时 `experimentalFeature/list` 返回为准。

### 7.3 客户端建议

- UI 只想展示可被用户测试的实验入口时，优先筛选 `stage == "beta"`。
- 非 beta 功能的 `displayName`、`description`、`announcement` 按 null 处理。
- 对 enum 和 feature key 保持前向兼容，未知值不要让 UI 崩溃。
- 对 `apps` / `plugins` 的实际 enabled 状态以响应为准，因为 workspace gating 会参与计算。

## 8. `experimentalFeature/enablement/set`

用途：写入进程级 runtime feature enablement override。它适合“当前 app-server 进程内临时开关某些支持的 feature”，不是直接改写 `config.toml` 的通用配置写接口。

请求：

```json
{
  "id": 50,
  "method": "experimentalFeature/enablement/set",
  "params": {
    "enablement": {
      "apps": true,
      "memories": true,
      "tool_call_mcp_elicitation": false
    }
  }
}
```

响应：

```json
{
  "id": 50,
  "result": {
    "enablement": {
      "apps": true,
      "memories": true,
      "tool_call_mcp_elicitation": false
    }
  }
}
```

`ExperimentalFeatureEnablementSetParams`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `enablement` | object map string -> boolean | 是 | 要更新的 feature key。只更新 map 中出现的 key，未出现的 key 保持不变。空 map 是 no-op。 |

`ExperimentalFeatureEnablementSetResponse`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enablement` | object map string -> boolean | 本次接受并写入 runtime override 的条目。 |

### 8.1 允许修改的 feature key

当前只允许这些 canonical key：

| key | 说明 |
| --- | --- |
| `apps` | app/connectors 功能。 |
| `memories` | memory 功能。 |
| `plugins` | plugin 功能。 |
| `remote_control` | remote control 功能。 |
| `tool_search` | tool search 功能。 |
| `tool_suggest` | tool suggest 功能。 |
| `tool_call_mcp_elicitation` | MCP elicitation tool call 功能。 |

请求中如果包含已知但不在 allowlist 的 canonical key，会返回 invalid request。例如：

```json
{
  "id": 51,
  "method": "experimentalFeature/enablement/set",
  "params": {
    "enablement": {
      "personality": true
    }
  }
}
```

错误：

```json
{
  "id": 51,
  "error": {
    "code": -32600,
    "message": "unsupported feature enablement `personality`: currently supported features are apps, memories, plugins, remote_control, tool_search, tool_suggest, tool_call_mcp_elicitation"
  }
}
```

如果传入 legacy 或 alias key，服务端会提示使用 canonical key。例如某个 legacy key 能映射到 canonical feature 时，错误信息会包含：

```text
invalid feature enablement `<key>`: use canonical feature key `<canonical>`
```

完全未知 key 则返回：

```text
invalid feature enablement `<key>`
```

### 8.2 实现行为

实现位于 `ConfigApi::set_experimental_feature_enablement`，外层由 `MessageProcessor` 调用。

流程：

1. 校验每个 key 是否是 canonical feature key。
2. 校验 key 是否在 allowlist 中。
3. 空 map 直接返回 `{ enablement: {} }`，不 reload config。
4. 非空 map 调用 `config_manager.extend_runtime_feature_enablement(...)`。
5. 重新加载最新 config。
6. 通知 user config reloader，让 loaded thread 收到 `ReloadUserConfig`。
7. 返回本次 map。

`experimentalFeature/enablement/set` 的 runtime override 优先级低于显式用户 config。README 描述的 feature enablement 优先级是：

```text
cloud requirements
> --enable <feature_name>
> config.toml
> experimentalFeature/enablement/set
> code default
```

因此：

- 如果 `config.toml` 已显式设置 `[features].memories = false`，再调用 `experimentalFeature/enablement/set` 设置 `memories: true`，`config/read` 仍会显示 false。
- 如果用户 config 未显式设置对应 feature，runtime override 会体现在后续 `config/read` 和 thread config reload 中。

### 8.3 通知副作用

该接口本身没有专属 notification。

但如果本次请求包含：

```json
{
  "apps": true
}
```

并且请求成功，外层 `MessageProcessor` 会尝试刷新 app list。若当前 config/auth 判断 apps 可用，刷新完成后会发送：

```json
{
  "method": "app/list/updated",
  "params": {
    "data": []
  }
}
```

`data` 的具体 shape 属于 `app/list` 协议范围，本文不展开。

### 8.4 客户端建议

- 不要把它当作通用 config 写入 API。要持久修改 `config.toml`，使用 `config/value/write` 或 `config/batchWrite`。
- 只传需要更新的 key；不要每次把完整 feature map 回写。
- 空 map 可以用于测试连通性，但不会触发 reload。
- 更新后如果 UI 依赖最终有效状态，应重新调用 `experimentalFeature/list` 或 `config/read`。
- 对于 `apps: true`，客户端还要监听 `app/list/updated`，否则 app list UI 可能短时间显示旧数据。

## 9. 错误模型

这些接口主要返回 JSON-RPC error。常见错误：

| 场景 | code | message 示例 |
| --- | --- | --- |
| `model/list.cursor` 不是数字 | `-32600` | `invalid cursor: abc` |
| `model/list.cursor` 超出总数 | `-32600` | `cursor 99 exceeds total models 10` |
| `experimentalFeature/list.cursor` 不是数字 | `-32600` | `invalid cursor: abc` |
| `experimentalFeature/list.cursor` 超出总数 | `-32600` | `cursor 99 exceeds total feature flags 43` |
| `experimentalFeature/enablement/set` 使用不支持的 canonical key | `-32600` | `unsupported feature enablement ...` |
| `experimentalFeature/enablement/set` 使用 legacy/alias key | `-32600` | `use canonical feature key ...` |
| `collaborationMode/list` 未启用实验能力 | JSON-RPC error | `<descriptor> requires experimentalApi capability` |
| config reload 失败 | internal error | `failed to reload config: ...` |

客户端应按 request `id` 匹配错误响应，不应假设错误只来自当前 UI 页面正在发起的最新请求。

## 10. 端到端示例

### 10.1 初始化后列出模型

客户端：

```json
{"id":0,"method":"initialize","params":{"clientInfo":{"name":"example_client","title":"Example Client","version":"0.1.0"}}}
```

服务端：

```json
{"id":0,"result":{"userAgent":"codex_cli_rs/...","codexHome":"/Users/me/.codex","platformFamily":"unix","platformOs":"macos"}}
```

客户端：

```json
{"method":"initialized"}
```

客户端：

```json
{"id":1,"method":"model/list","params":{"limit":20,"cursor":null,"includeHidden":false}}
```

服务端：

```json
{"id":1,"result":{"data":[],"nextCursor":null}}
```

### 10.2 读取 provider 能力

客户端：

```json
{"id":2,"method":"modelProvider/capabilities/read","params":{}}
```

服务端：

```json
{"id":2,"result":{"namespaceTools":true,"imageGeneration":true,"webSearch":true}}
```

### 10.3 启用实验 API 后读取协作模式

客户端初始化：

```json
{"id":0,"method":"initialize","params":{"clientInfo":{"name":"example_client","title":"Example Client","version":"0.1.0"},"capabilities":{"experimentalApi":true}}}
```

客户端：

```json
{"method":"initialized"}
```

客户端：

```json
{"id":3,"method":"collaborationMode/list","params":{}}
```

服务端：

```json
{"id":3,"result":{"data":[{"name":"Plan","mode":"plan","model":null,"reasoning_effort":"medium"},{"name":"Default","mode":"default","model":null,"reasoning_effort":null}]}}
```

### 10.4 列出并修改实验功能

客户端：

```json
{"id":4,"method":"experimentalFeature/list","params":{"limit":10,"cursor":null}}
```

服务端：

```json
{"id":4,"result":{"data":[{"name":"memories","stage":"beta","displayName":"Memories","description":"Allow Codex to create new memories from conversations and bring relevant memories into new conversations.","announcement":"NEW: Codex can now generate and uses memories. Try is now with `/memories`","enabled":false,"defaultEnabled":false}],"nextCursor":"10"}}
```

客户端：

```json
{"id":5,"method":"experimentalFeature/enablement/set","params":{"enablement":{"memories":true}}}
```

服务端：

```json
{"id":5,"result":{"enablement":{"memories":true}}}
```

## 11. 客户端实现建议

1. 完成 `initialize` / `initialized` 后再调用这些接口。
2. `collaborationMode/list` 需要 `experimentalApi: true`，其他四个 method 不需要。
3. 用 request `id` 管理并发请求，尤其模型列表和 feature 列表都可能分页请求并发。
4. 对 `model/list` 和 `experimentalFeature/list` 的 `nextCursor` 原样传回，不要在客户端计算下一页。
5. 对未知 enum 值、未知 feature key、未来新增 model 字段保持前向兼容。
6. 如果用户改了 config 或 runtime feature enablement，重新读取相关列表，不要只在本地 patch UI state。
7. `modelProvider/capabilities/read` 只表示 provider 上限，不代表 turn 最终工具集。
8. `experimentalFeature/enablement/set` 只适合 runtime override；持久配置使用 config API。

## 12. 维护方式

协议可能随原生 Codex 更新。维护本文时优先检查：

1. `app-server-protocol/src/protocol/common.rs`：method wire 名称、实验性 gating、serialization scope。
2. `app-server-protocol/src/protocol/v2.rs`：请求、响应和字段 wire shape。
3. `app-server/src/codex_message_processor.rs`：`model/list`、`collaborationMode/list`、`experimentalFeature/list` 的处理逻辑。
4. `app-server/src/message_processor.rs`：`modelProvider/capabilities/read` 和 `experimentalFeature/enablement/set` 的外层处理、副作用。
5. `app-server/src/config_api.rs`：runtime feature enablement allowlist 和校验逻辑。
6. `app-server/src/models.rs`：`ModelPreset` 到 app-server `Model` 的映射。
7. `model-provider/src/provider.rs` 与具体 provider 实现：provider capability 默认值和覆盖值。
8. `models-manager/src/collaboration_mode_presets.rs`：协作模式 preset 列表和顺序。
9. `features/src/lib.rs`：feature registry、stage 和 default enabled。

原生仓库可以生成 schema：

```bash
codex app-server generate-ts --out DIR
codex app-server generate-json-schema --out DIR
```

如果需要包含实验性 API surface：

```bash
codex app-server generate-ts --out DIR --experimental
codex app-server generate-json-schema --out DIR --experimental
```

当 schema 与本文冲突时，以原生 Rust 类型和生成 schema 为准。
