# Codex App Server 模糊文件搜索协议详解

本文档说明原生 Codex `codex app-server` 中 fuzzy file search 相关接口、session 生命周期、通知语义、结果排序和客户端实现建议。文档只覆盖原生 Codex app-server，不包含 My-Code-X 上层 UI 适配逻辑。

本文基于本机相邻仓库 `../codex` 的 Rust 实现分析，主要事实来源：

- `../codex/codex-rs/app-server/README.md`
- `../codex/codex-rs/app-server-protocol/src/protocol/common.rs`
- `../codex/codex-rs/app-server/src/codex_message_processor.rs`
- `../codex/codex-rs/app-server/src/fuzzy_file_search.rs`
- `../codex/codex-rs/file-search/src/lib.rs`
- `../codex/codex-rs/app-server/tests/suite/fuzzy_file_search.rs`

## 1. 范围

本文回答这些问题：

1. 客户端如何通过 app-server 做一次性模糊文件搜索。
2. 客户端如何启动、更新、停止一个持续的 fuzzy file search session。
3. app-server 会发哪些通知，以及这些通知如何映射到前端文件 mention / quick open 类体验。
4. 搜索结果的字段、排序、匹配、高亮 indices 和取消语义是什么。

本文刻意不覆盖：

- 上层 UI 如何展示文件选择器。
- turn input 中的 `textElements` 或 file mention 如何序列化。
- Codex 模型如何消费被用户选中的文件路径。
- 通用 `fs/*` 文件系统读写协议。

本文中的“客户端”指连接到 `codex app-server` 的调用方。“服务端”指原生 Codex app-server 进程。

## 2. API 总览

Fuzzy file search 有两套入口。

| method | 稳定性 | 用途 | response | 主要通知 |
| --- | --- | --- | --- | --- |
| `fuzzyFileSearch` | stable | 发起一次搜索，等待最终结果。 | `{ files }` | 无 |
| `fuzzyFileSearch/sessionStart` | experimental | 创建一个可持续更新 query 的搜索 session。 | `{}` | 后续由 update 触发 |
| `fuzzyFileSearch/sessionUpdate` | experimental | 更新已有 session 的 query。 | `{}` | `fuzzyFileSearch/sessionUpdated`、`fuzzyFileSearch/sessionCompleted` |
| `fuzzyFileSearch/sessionStop` | experimental | 停止并释放 session。 | `{}` | 无固定通知 |

相关通知：

| method | payload | 用途 |
| --- | --- | --- |
| `fuzzyFileSearch/sessionUpdated` | `{ sessionId, query, files }` | 返回当前 query 的最新 top-N 匹配结果。可能在扫描完成前多次发送。 |
| `fuzzyFileSearch/sessionCompleted` | `{ sessionId }` | 表示当前 session 已经针对最近 query 进入 idle / complete 状态。 |

所有 request 都需要先完成 app-server 标准握手：

```text
initialize
initialized
fuzzyFileSearch 或 fuzzyFileSearch/sessionStart
```

Session 版方法是 experimental API。客户端需要在 `initialize.params.capabilities.experimentalApi` 中显式开启：

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

如果没有开启 experimental capability，`fuzzyFileSearch/sessionStart`、`fuzzyFileSearch/sessionUpdate`、`fuzzyFileSearch/sessionStop` 会被协议层拒绝。

## 3. 使用场景

`fuzzyFileSearch` 适合一次性查询：客户端发送 query 和 roots，服务端遍历 roots，返回最终结果。

Session 版更适合交互式输入框：

1. 用户打开 `@file`、`#file`、quick open 或文件 mention 面板。
2. 客户端调用 `fuzzyFileSearch/sessionStart`，传入搜索 roots。
3. 用户每输入或删除字符，客户端调用 `fuzzyFileSearch/sessionUpdate`。
4. 服务端持续复用同一个文件索引 / matcher session，发 `sessionUpdated` 通知刷新列表。
5. 用户关闭面板或选中文件后，客户端调用 `fuzzyFileSearch/sessionStop`。

Session 版的价值是避免每个按键都重新创建完整搜索流程，同时允许扫描未完成时先返回部分 top-N 结果。

## 4. 数据结构

### 4.1 FuzzyFileSearchResult

搜索结果结构：

```json
{
  "root": "/repo",
  "path": "src/main.ts",
  "match_type": "file",
  "file_name": "main.ts",
  "score": 96,
  "indices": [4, 5, 6]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `root` | string | 命中的搜索 root。通常应由客户端传绝对路径；协议类型本身只是 string。 |
| `path` | string | 相对 `root` 的路径。用于展示或拼接完整路径。 |
| `match_type` | `file` / `directory` | 命中项是文件还是目录。注意该字段使用 snake_case，不是 camelCase。 |
| `file_name` | string | `path` 的最后一段。注意该字段使用 snake_case。 |
| `score` | number | fuzzy matcher 给出的相关性分数。越高越靠前。 |
| `indices` | number[] 或 null | query 命中的字符位置，用于高亮。app-server 当前开启 `compute_indices: true`，所以正常结果会有数组。 |

`indices` 是按升序去重后的字符 index。它来自底层 `nucleo` matcher，用于 UI 高亮命中字符。客户端应把它理解为对匹配列文本的字符位置，而不是文件内容位置。

### 4.2 MatchType

wire 值：

| 值 | 说明 |
| --- | --- |
| `file` | 普通文件。 |
| `directory` | 目录。 |

底层 walker 会把文件和目录都加入候选集，因此 quick open 可以展示目录命中。

## 5. 一次性 `fuzzyFileSearch`

用途：发起一次搜索，等待服务端返回最终 top-N 结果。

请求：

```json
{
  "id": 10,
  "method": "fuzzyFileSearch",
  "params": {
    "query": "main",
    "roots": ["/repo"],
    "cancellationToken": null
  }
}
```

`FuzzyFileSearchParams`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `query` | string | 搜索字符串。空字符串直接返回空结果。 |
| `roots` | string[] | 搜索 root 列表。为空时返回空结果。 |
| `cancellationToken` | string 或 null | 可选取消 token。相同 token 的新请求会取消旧的 in-flight 搜索。 |

响应：

```json
{
  "id": 10,
  "result": {
    "files": [
      {
        "root": "/repo",
        "path": "src/main.ts",
        "match_type": "file",
        "file_name": "main.ts",
        "score": 96,
        "indices": [4, 5, 6]
      }
    ]
  }
}
```

一次性搜索没有进度通知。服务端会在后台 blocking task 中运行搜索，搜索结束后返回 response。

### 5.1 cancellationToken 语义

`cancellationToken` 只属于旧的一次性 `fuzzyFileSearch`。

如果客户端连续发送：

```json
{
  "id": 11,
  "method": "fuzzyFileSearch",
  "params": {
    "query": "mai",
    "roots": ["/repo"],
    "cancellationToken": "file-picker-1"
  }
}
```

```json
{
  "id": 12,
  "method": "fuzzyFileSearch",
  "params": {
    "query": "main",
    "roots": ["/repo"],
    "cancellationToken": "file-picker-1"
  }
}
```

第二个请求会把同 token 下仍在运行的第一个搜索标记为取消。被取消的搜索会尽量提前退出，但底层 walker 是周期性检查取消标志，不保证立刻停止。

注意：

- `cancellationToken` 不是 request id。
- 只有复用同一个 token 才会互相取消。
- 当前实现仍会给被取消的 request 发送 response，通常可能是空或部分结果，客户端应以最新 request id / 最新 query 为准。

## 6. Session 生命周期

Session 版有三个 request：

```text
fuzzyFileSearch/sessionStart
fuzzyFileSearch/sessionUpdate
fuzzyFileSearch/sessionStop
```

这些 request 在协议层按 `sessionId` 做串行化。实际效果是，同一个 `sessionId` 的 start、update、stop 会按顺序处理。因此客户端可以在发送 `sessionStart` 后立刻发送 `sessionUpdate`，不必等待 start response 再发送第一个 query update。

不同 `sessionId` 的 session 彼此独立。

### 6.1 `fuzzyFileSearch/sessionStart`

用途：创建一个搜索 session，开始遍历 roots 并准备接收 query update。

请求：

```json
{
  "id": 20,
  "method": "fuzzyFileSearch/sessionStart",
  "params": {
    "sessionId": "file-picker-1",
    "roots": ["/repo"]
  }
}
```

`FuzzyFileSearchSessionStartParams`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sessionId` | string | 客户端生成的 session id。不能为空。 |
| `roots` | string[] | 搜索 root 列表。底层要求至少一个 root；为空会导致 session 创建失败。 |

响应：

```json
{
  "id": 20,
  "result": {}
}
```

实现细节：

- 服务端把 session 存入内存 map，key 是 `sessionId`。
- 如果 `sessionId` 已存在，新的 session 会替换旧 session；旧 session 被 drop 后会被取消。
- `sessionStart` 本身不携带 query，也不保证立即发 `sessionUpdated`。
- session 的初始 query 是空字符串。

错误：

| 场景 | 错误 |
| --- | --- |
| `sessionId` 是空字符串 | JSON-RPC invalid request，message: `sessionId must not be empty` |
| `roots` 为空或底层 session 创建失败 | JSON-RPC internal error，message 以 `failed to start fuzzy file search session:` 开头 |

### 6.2 `fuzzyFileSearch/sessionUpdate`

用途：更新 session 的当前 query。每次用户输入变化时调用。

请求：

```json
{
  "id": 21,
  "method": "fuzzyFileSearch/sessionUpdate",
  "params": {
    "sessionId": "file-picker-1",
    "query": "main"
  }
}
```

`FuzzyFileSearchSessionUpdateParams`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sessionId` | string | 已通过 `sessionStart` 创建的 session id。 |
| `query` | string | 新 query。可以为空字符串。 |

响应：

```json
{
  "id": 21,
  "result": {}
}
```

`sessionUpdate` response 只表示服务端接受了 query，不表示搜索已经完成。结果通过通知返回。

如果 session 不存在，返回 JSON-RPC error：

```json
{
  "id": 21,
  "error": {
    "code": -32600,
    "message": "fuzzy file search session not found: file-picker-1"
  }
}
```

### 6.3 `fuzzyFileSearch/sessionUpdated`

通知：

```json
{
  "method": "fuzzyFileSearch/sessionUpdated",
  "params": {
    "sessionId": "file-picker-1",
    "query": "main",
    "files": [
      {
        "root": "/repo",
        "path": "src/main.ts",
        "match_type": "file",
        "file_name": "main.ts",
        "score": 96,
        "indices": [4, 5, 6]
      }
    ]
  }
}
```

语义：

- 每条通知都属于一个 `sessionId`。
- `query` 是该结果对应的 query。
- `files` 是当前 snapshot 的 top-N 结果，不是增量 patch。
- 同一个 query 可能收到多次 `sessionUpdated`，因为文件 walk 和 matcher 可能分批推进。
- 如果 query 变成空字符串，服务端会发送 `files: []` 的 snapshot。
- 服务端会丢弃已经不是最新 query 的 snapshot：如果底层 snapshot.query 和 session 的 latest query 不一致，就不会发通知。

客户端应该把 `sessionUpdated` 当作“替换当前列表”的事件，而不是把 `files` 追加到旧列表。

### 6.4 `fuzzyFileSearch/sessionCompleted`

通知：

```json
{
  "method": "fuzzyFileSearch/sessionCompleted",
  "params": {
    "sessionId": "file-picker-1"
  }
}
```

语义：

- 表示 session 当前进入 idle / complete 状态。
- 底层保证每次 `update_query` 至少会触发一次 complete 回调。
- 当前 wire payload 只有 `sessionId`，没有 `query` 字段。
- 收到 completed 后，如果用户继续修改 query，仍可再次调用 `sessionUpdate`，session 会继续发新的 update / completed。

README 的事件总览中曾把 `sessionCompleted` 描述成 `{ sessionId, query }`，但当前 Rust 协议类型和生成 schema 只有 `sessionId`。客户端应以协议类型为准。

### 6.5 `fuzzyFileSearch/sessionStop`

用途：停止并释放 session。

请求：

```json
{
  "id": 22,
  "method": "fuzzyFileSearch/sessionStop",
  "params": {
    "sessionId": "file-picker-1"
  }
}
```

响应：

```json
{
  "id": 22,
  "result": {}
}
```

语义：

- 服务端从 session map 中移除该 `sessionId`。
- session drop 时会设置取消标志，底层 worker 会停止继续发送 update。
- 停止不存在的 session 也返回 `{}`，不会报错。
- stop 后再 update 同一个 `sessionId` 会报 `fuzzy file search session not found: ...`。

由于 worker 是异步停止，stop 附近可能存在极短的竞态窗口。当前实现会在发送 snapshot / complete 前检查 canceled 标志，正常情况下 stop 后不会再收到该 session 的 update。

## 7. 端到端示例：文件 mention 面板

客户端初始化：

```json
{
  "id": 0,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "my_code_x",
      "title": "My Code X",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true
    }
  }
}
```

客户端：

```json
{
  "method": "initialized"
}
```

用户打开文件选择器，客户端启动 session：

```json
{
  "id": 1,
  "method": "fuzzyFileSearch/sessionStart",
  "params": {
    "sessionId": "mention-1710000000000",
    "roots": ["D:\\workspaces\\AI-Tools\\My-Code-X-C"]
  }
}
```

服务端：

```json
{
  "id": 1,
  "result": {}
}
```

用户输入 `codex`：

```json
{
  "id": 2,
  "method": "fuzzyFileSearch/sessionUpdate",
  "params": {
    "sessionId": "mention-1710000000000",
    "query": "codex"
  }
}
```

服务端 response：

```json
{
  "id": 2,
  "result": {}
}
```

服务端通知：

```json
{
  "method": "fuzzyFileSearch/sessionUpdated",
  "params": {
    "sessionId": "mention-1710000000000",
    "query": "codex",
    "files": [
      {
        "root": "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        "path": "docs\\codex-app-server-chat-protocol.md",
        "match_type": "file",
        "file_name": "codex-app-server-chat-protocol.md",
        "score": 87,
        "indices": [5, 6, 7, 8, 9]
      }
    ]
  }
}
```

服务端完成当前 query：

```json
{
  "method": "fuzzyFileSearch/sessionCompleted",
  "params": {
    "sessionId": "mention-1710000000000"
  }
}
```

用户关闭面板：

```json
{
  "id": 3,
  "method": "fuzzyFileSearch/sessionStop",
  "params": {
    "sessionId": "mention-1710000000000"
  }
}
```

## 8. 匹配与排序语义

app-server 对一次性搜索和 session 搜索使用同一套底层搜索配置：

| 配置 | 当前值 |
| --- | --- |
| 最大返回数量 | 50 |
| 最大线程数 | `min(available_parallelism, 12)`，至少 1 |
| 是否计算高亮 indices | true |
| 是否允许 hidden entries | true |
| 是否跟随 symlink | true |
| 是否尊重 gitignore | true，且使用 `require_git(true)` 贴近 git 语义 |

匹配由 `nucleo` 完成：

- case-insensitive：`ALP` 可以匹配 `alpha.txt`。
- smart normalization。
- 路径级匹配：matcher 匹配的是相对 root 的路径字符串，不是文件内容。
- 结果包含文件和目录。

排序规则：

1. `score` 降序。
2. 分数相同按 `path` 字符串升序。

客户端不需要重新排序，除非想叠加自己的 UI 规则。

## 9. Root 与路径语义

`roots` 是搜索根目录列表。当前协议类型只是 `string[]`，app-server 没有像 `fs/*` API 那样强制要求 absolute path。但客户端实践上应该传绝对路径，原因是：

- response 的 `root` 会直接使用底层 root 的字符串表示。
- response 的 `path` 是相对 root 的路径。
- UI 拼接完整路径时，绝对 root 更稳定。
- Windows、Linux、macOS 的相对路径基准不应由前端猜测。

完整路径可以按平台规则拼接：

```text
fullPath = join(result.root, result.path)
```

不要把 `path` 当作绝对路径使用。

## 10. Session 并发与订阅边界

Session 不是 thread-scoped。它不依赖 `thread/start`，也没有 `threadId` 字段。它是 app-server 连接/processor 内存中的辅助 UI session。

关键语义：

- 同一个 `sessionId` 的 start/update/stop 会按协议 serialization scope 串行执行。
- 不同 `sessionId` 可以并行。
- `sessionUpdated` 和 `sessionCompleted` 是普通 server notification，不属于 `ThreadItem`，不会进入聊天历史。
- `initialize.capabilities.optOutNotificationMethods` 如果包含这些通知方法名，客户端可能收不到对应通知。
- 客户端断开连接后，相关 processor / session 生命周期由 app-server 连接管理清理，不应依赖 session 跨连接持久存在。

因此，前端应把 fuzzy search session 当成短生命周期 UI 状态，而不是持久业务对象。

## 11. 错误模型

常见错误：

| request | 场景 | 错误 |
| --- | --- | --- |
| `sessionStart` | 未开启 experimental API | JSON-RPC error：`fuzzyFileSearch/sessionStart requires experimentalApi capability` |
| `sessionStart` | `sessionId` 为空 | JSON-RPC invalid request：`sessionId must not be empty` |
| `sessionStart` | `roots` 为空或底层创建失败 | JSON-RPC internal error：`failed to start fuzzy file search session: ...` |
| `sessionUpdate` | session 不存在 | JSON-RPC invalid request：`fuzzy file search session not found: <sessionId>` |
| `sessionStop` | session 不存在 | 成功 `{}` |
| `fuzzyFileSearch` | roots 为空 | 成功 `{ "files": [] }` |
| `fuzzyFileSearch` | query 为空 | 成功 `{ "files": [] }` |

底层搜索失败时，一次性搜索会记录 warn 并返回空数组；session 创建失败会转成 JSON-RPC error。

## 12. 客户端实现建议

1. 文件选择器打开时创建唯一 `sessionId`，关闭时总是调用 `sessionStop`。
2. 对 session 版搜索，初始化时必须开启 `experimentalApi: true`。
3. `sessionStart` 后可以立即发第一个 `sessionUpdate`，不需要等待 start response。
4. 每次收到 `sessionUpdated`，用 `params.files` 替换当前候选列表。
5. 用 `params.query` 防御过期 UI 状态；如果它不是当前输入框文本，可以忽略。
6. 收到 `sessionCompleted` 后可以把 UI 状态标为 idle，但不要关闭 session；用户继续输入时继续 `sessionUpdate`。
7. query 为空时保留 session 也可以，服务端会返回空列表；关闭面板时再 stop。
8. 对旧的 `fuzzyFileSearch`，用稳定的 `cancellationToken` 表示同一个输入框，这样新请求可以取消旧请求。
9. 不要假设 `score` 的绝对值稳定；只把它当作当前版本内排序依据。
10. 不要把 session 结果写入聊天历史；用户最终选中文件后，再由上层决定如何转成 text mention、structured input 或其他 UI 状态。

## 13. 维护方式

协议可能随原生 Codex 更新。维护本文时优先检查：

1. `app-server-protocol/src/protocol/common.rs`：`fuzzyFileSearch`、session request、notification 的 wire 名称和类型。
2. `app-server/src/codex_message_processor.rs`：request handler、session map、错误处理和 serialization 行为。
3. `app-server/src/fuzzy_file_search.rs`：app-server 搜索配置、通知发送、取消过滤和结果映射。
4. `file-search/src/lib.rs`：底层 matcher、walker、session reporter、排序和 gitignore 语义。
5. `app-server/tests/suite/fuzzy_file_search.rs`：端到端行为，例如 case-insensitive、stop 后无 update、多 session 独立、start 后立即 update。

原生仓库可以生成 schema：

```bash
codex app-server generate-ts --out DIR
codex app-server generate-json-schema --out DIR
```

Session 版方法是 experimental surface。生成 schema 时如果需要看到 `fuzzyFileSearch/sessionStart`、`fuzzyFileSearch/sessionUpdate`、`fuzzyFileSearch/sessionStop`，需要带 `--experimental`：

```bash
codex app-server generate-ts --out DIR --experimental
codex app-server generate-json-schema --out DIR --experimental
```

当 README、生成 schema 与 Rust 协议类型冲突时，以当前版本的 Rust 类型和对应 experimental schema 为准。
