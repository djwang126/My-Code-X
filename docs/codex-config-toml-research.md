# Codex config.toml research note

This note records what upstream Codex currently accepts in `config.toml`, how the config is layered, and which nested sections exist in the current source tree.

Primary source files checked:
- `D:\workspace\codex\codex-rs\core\src\config\mod.rs`
- `D:\workspace\codex\codex-rs\core\src\config\types.rs`
- `D:\workspace\codex\codex-rs\core\src\config\permissions.rs`
- `D:\workspace\codex\codex-rs\core\src\config\profile.rs`
- `D:\workspace\codex\codex-rs\core\src\model_provider_info.rs`
- `D:\workspace\codex\codex-rs\config\src\skills_config.rs`
- `D:\workspace\codex\codex-rs\core\src\config_loader\mod.rs`
- `D:\workspace\codex\codex-rs\core\config.schema.json`

This is a research note about upstream Codex behavior as currently implemented in the checked source.

## Config loading order

Upstream Codex builds effective configuration from multiple layers in this order:

1. admin managed preferences
2. system config
3. user config
4. cwd config
5. parent-tree `.codex/config.toml`
6. repo-root `.codex/config.toml`
7. runtime overrides

The loader comments currently describe these filesystem locations:

- system: `/etc/codex/config.toml` on Unix or `%ProgramData%\OpenAI\Codex\config.toml` on Windows
- user: `${CODEX_HOME}/config.toml`
- cwd: `${PWD}/config.toml`
- tree: parent directories containing `./.codex/config.toml`
- repo: `$(git rev-parse --show-toplevel)/.codex/config.toml`

Project-scoped config layers can be loaded but disabled when the directory is untrusted.

## Top-level config surface

The generated schema currently exposes 85 top-level keys:

- `agents`
- `allow_login_shell`
- `analytics`
- `approval_policy`
- `approvals_reviewer`
- `apps`
- `audio`
- `background_terminal_max_timeout`
- `chatgpt_base_url`
- `check_for_update_on_startup`
- `cli_auth_credentials_store`
- `commit_attribution`
- `compact_prompt`
- `default_permissions`
- `developer_instructions`
- `disable_paste_burst`
- `experimental_compact_prompt_file`
- `experimental_realtime_start_instructions`
- `experimental_realtime_ws_backend_prompt`
- `experimental_realtime_ws_base_url`
- `experimental_realtime_ws_model`
- `experimental_realtime_ws_startup_context`
- `experimental_use_freeform_apply_patch`
- `experimental_use_unified_exec_tool`
- `features`
- `feedback`
- `file_opener`
- `forced_chatgpt_workspace_id`
- `forced_login_method`
- `ghost_snapshot`
- `hide_agent_reasoning`
- `history`
- `instructions`
- `js_repl_node_module_dirs`
- `js_repl_node_path`
- `log_dir`
- `mcp_oauth_callback_port`
- `mcp_oauth_callback_url`
- `mcp_oauth_credentials_store`
- `mcp_servers`
- `memories`
- `model`
- `model_auto_compact_token_limit`
- `model_catalog_json`
- `model_context_window`
- `model_instructions_file`
- `model_provider`
- `model_providers`
- `model_reasoning_effort`
- `model_reasoning_summary`
- `model_supports_reasoning_summaries`
- `model_verbosity`
- `notice`
- `notify`
- `openai_base_url`
- `oss_provider`
- `otel`
- `permissions`
- `personality`
- `plan_mode_reasoning_effort`
- `plugins`
- `profile`
- `profiles`
- `project_doc_fallback_filenames`
- `project_doc_max_bytes`
- `project_root_markers`
- `projects`
- `realtime`
- `review_model`
- `sandbox_mode`
- `sandbox_workspace_write`
- `service_tier`
- `shell_environment_policy`
- `show_raw_agent_reasoning`
- `skills`
- `sqlite_home`
- `suppress_unstable_features_warning`
- `tool_output_token_limit`
- `tool_suggest`
- `tools`
- `tui`
- `web_search`
- `windows`
- `windows_wsl_setup_acknowledged`
- `zsh_path`

## Model and provider settings

Top-level model and provider-related fields:

- `model`
- `review_model`
- `model_provider`
- `model_context_window`
- `model_auto_compact_token_limit`
- `model_catalog_json`
- `model_instructions_file`
- `model_reasoning_effort`
- `plan_mode_reasoning_effort`
- `model_reasoning_summary`
- `model_supports_reasoning_summaries`
- `model_verbosity`
- `service_tier`
- `personality`
- `chatgpt_base_url`
- `openai_base_url`
- `oss_provider`

### `model_reasoning_effort`

Current enum values:

- `none`
- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`

### `model_reasoning_summary`

Current enum values:

- `auto`
- `concise`
- `detailed`
- `none`

### `model_verbosity`

Current enum values:

- `low`
- `medium`
- `high`

### `service_tier`

Current enum values:

- `fast`
- `flex`

### `personality`

Current enum values:

- `none`
- `friendly`
- `pragmatic`

## `model_providers`

`model_providers` is a map of provider id to provider config.

Each provider entry currently supports:

- `name`
- `base_url`
- `env_key`
- `env_key_instructions`
- `experimental_bearer_token`
- `wire_api`
- `query_params`
- `http_headers`
- `env_http_headers`
- `request_max_retries`
- `stream_max_retries`
- `stream_idle_timeout_ms`
- `websocket_connect_timeout_ms`
- `requires_openai_auth`
- `supports_websockets`

Current `wire_api` support is `responses`. The legacy `chat` value is explicitly rejected.

## Approval, sandbox, and execution settings

Top-level fields in this area:

- `approval_policy`
- `approvals_reviewer`
- `sandbox_mode`
- `sandbox_workspace_write`
- `default_permissions`
- `permissions`
- `shell_environment_policy`
- `allow_login_shell`
- `background_terminal_max_timeout`

### `approval_policy`

Current accepted values:

- `untrusted`
- `on-failure`
- `on-request`
- `never`

It also accepts an object form:

```toml
approval_policy = { granular = { sandbox_approval = true, rules = true, skill_approval = true, request_permissions = true, mcp_elicitations = true } }
```

The `granular` object currently supports:

- `sandbox_approval`
- `rules`
- `skill_approval`
- `request_permissions`
- `mcp_elicitations`

### `approvals_reviewer`

Current enum values:

- `user`
- `guardian_subagent`

### `sandbox_mode`

Current enum values:

- `read-only`
- `workspace-write`
- `danger-full-access`

### `sandbox_workspace_write`

Current fields:

- `writable_roots`
- `network_access`
- `exclude_tmpdir_env_var`
- `exclude_slash_tmp`

### `shell_environment_policy`

Current fields:

- `inherit`
- `ignore_default_excludes`
- `exclude`
- `set`
- `include_only`
- `experimental_use_profile`

Current `inherit` enum values:

- `core`
- `all`
- `none`

The effective policy logic in source currently:

1. starts from the chosen inheritance mode
2. excludes default secret-like variables unless disabled
3. applies `exclude`
4. applies `set`
5. applies `include_only`

## `permissions`

`permissions` is a named-profile map used with `default_permissions`.

Top-level shape:

```toml
default_permissions = "profile_name"

[permissions.profile_name]
filesystem = { ... }
network = { ... }
```

Each named permission profile currently supports:

- `filesystem`
- `network`

### Filesystem permission shape

`filesystem` is a map. Each entry can be either:

- a direct access mode
- a scoped map of child path to access mode

The parser in `permissions.rs` recognizes special filesystem roots:

- `:root`
- `:minimal`
- `:project_roots`
- `:tmpdir`

Unknown `:special` paths are intentionally parsed as unknown and surfaced as warnings instead of hard-failing.

### Network permission shape

Current `network` fields:

- `enabled`
- `proxy_url`
- `enable_socks5`
- `socks_url`
- `enable_socks5_udp`
- `allow_upstream_proxy`
- `dangerously_allow_non_loopback_proxy`
- `dangerously_allow_all_unix_sockets`
- `mode`
- `allowed_domains`
- `denied_domains`
- `allow_unix_sockets`
- `allow_local_binding`

Current `mode` values in schema:

- `limited`
- `full`

### Observed permissions-related validation behavior

Current source contains these validation/error conditions:

- if permission profiles exist but no `default_permissions` is set, config loading errors
- if `default_permissions` is set without a `[permissions]` table, config loading errors
- if `default_permissions` points to a missing profile, config loading errors

## Prompt and instruction settings

Top-level fields in this area:

- `instructions`
- `developer_instructions`
- `compact_prompt`
- `commit_attribution`
- `project_doc_max_bytes`
- `project_doc_fallback_filenames`
- `experimental_compact_prompt_file`
- `experimental_realtime_start_instructions`

The source also still contains a deprecated `experimental_instructions_file` field, but it is skipped from the schema and marked ignored.

## Profiles and project trust

Top-level fields:

- `profile`
- `profiles`
- `projects`
- `project_root_markers`

### `profiles`

`profiles` is a map of named config presets.

Each profile currently supports:

- `model`
- `service_tier`
- `model_provider`
- `approval_policy`
- `approvals_reviewer`
- `sandbox_mode`
- `model_reasoning_effort`
- `plan_mode_reasoning_effort`
- `model_reasoning_summary`
- `model_verbosity`
- `model_catalog_json`
- `personality`
- `chatgpt_base_url`
- `model_instructions_file`
- `js_repl_node_path`
- `js_repl_node_module_dirs`
- `zsh_path`
- `experimental_compact_prompt_file`
- `include_apply_patch_tool`
- `experimental_use_unified_exec_tool`
- `experimental_use_freeform_apply_patch`
- `tools_view_image`
- `tools`
- `web_search`
- `analytics`
- `windows`
- `features`
- `oss_provider`

### `projects`

`projects` is a map of absolute project path string to project config.

Each project entry currently supports:

- `trust_level`

Current `trust_level` values:

- `trusted`
- `untrusted`

## MCP server settings

`mcp_servers` is a map of server id to config.

Current fields accepted in raw config:

- `command`
- `args`
- `env`
- `env_vars`
- `cwd`
- `http_headers`
- `env_http_headers`
- `url`
- `bearer_token`
- `bearer_token_env_var`
- `startup_timeout_sec`
- `startup_timeout_ms`
- `tool_timeout_sec`
- `enabled`
- `required`
- `enabled_tools`
- `disabled_tools`
- `scopes`
- `oauth_resource`
- `name`
- `tools`

Observed transport rules in current deserializer:

- `command` selects stdio transport
- `url` selects streamable HTTP transport
- mixed transport-only fields are rejected
- `name` is accepted only as a legacy compatibility field

### MCP per-tool config

`mcp_servers.<server>.tools.<tool>` currently supports:

- `approval_mode`

Current `approval_mode` values:

- `auto`
- `prompt`
- `approve`

### MCP OAuth settings

Top-level OAuth-related fields:

- `mcp_oauth_credentials_store`
- `mcp_oauth_callback_port`
- `mcp_oauth_callback_url`

Current `mcp_oauth_credentials_store` values:

- `auto`
- `file`
- `keyring`

## App and connector settings

Top-level field:

- `apps`

`apps` supports:

- `_default`
- one entry per app id

### `apps._default`

Current fields:

- `enabled`
- `destructive_enabled`
- `open_world_enabled`

### `apps.<app_id>`

Current fields:

- `enabled`
- `destructive_enabled`
- `open_world_enabled`
- `default_tools_approval_mode`
- `default_tools_enabled`
- `tools`

### `apps.<app_id>.tools.<tool>`

Current fields:

- `enabled`
- `approval_mode`

Current `approval_mode` values:

- `auto`
- `prompt`
- `approve`

## Tool, search, skill, plugin, and agent settings

Top-level fields:

- `tools`
- `tool_suggest`
- `web_search`
- `skills`
- `plugins`
- `agents`
- `memories`

### `tools`

Current nested tool settings:

- `web_search`
- `view_image`

`tools.web_search` currently supports:

- `context_size`
- `allowed_domains`
- `location`

`tools.web_search.location` supports:

- `country`
- `region`
- `city`
- `timezone`

Current `context_size` values:

- `low`
- `medium`
- `high`

### `web_search`

Current top-level mode values:

- `disabled`
- `cached`
- `live`

### `tool_suggest`

Current fields:

- `discoverables`

Each discoverable currently supports:

- `type`
- `id`

Current discoverable `type` values:

- `connector`
- `plugin`

### `skills`

Current fields:

- `bundled`
- `config`

`skills.bundled` currently supports:

- `enabled`

Each entry in `skills.config` currently supports:

- `path`
- `name`
- `enabled`

### `plugins`

`plugins` is a map of plugin name to config.

Each plugin config currently supports:

- `enabled`

### `agents`

Current direct agent settings:

- `max_threads`
- `max_depth`
- `job_max_runtime_seconds`

`agents` also supports arbitrary additional role entries by name. Each role currently supports:

- `description`
- `config_file`
- `nickname_candidates`

### `memories`

Current fields:

- `no_memories_if_mcp_or_web_search`
- `generate_memories`
- `use_memories`
- `max_raw_memories_for_consolidation`
- `max_unused_days`
- `max_rollout_age_days`
- `max_rollouts_per_startup`
- `min_rollout_idle_hours`
- `extract_model`
- `consolidation_model`

## TUI, notification, and local-state settings

Top-level fields:

- `tui`
- `notify`
- `notice`
- `history`
- `analytics`
- `feedback`
- `file_opener`
- `log_dir`
- `sqlite_home`
- `hide_agent_reasoning`
- `show_raw_agent_reasoning`
- `disable_paste_burst`
- `check_for_update_on_startup`

### `tui`

Current fields:

- `notifications`
- `notification_method`
- `animations`
- `show_tooltips`
- `alternate_screen`
- `status_line`
- `terminal_title`
- `theme`
- `model_availability_nux`

Current `alternate_screen` values:

- `auto`
- `always`
- `never`

`tui.notifications` accepts either:

- a boolean
- a custom string array command

Current `notification_method` values:

- `auto`
- `osc9`
- `bel`

### `history`

Current fields:

- `persistence`
- `max_bytes`

Current `persistence` values:

- `save-all`
- `none`

### `analytics`

Current fields:

- `enabled`

### `feedback`

Current fields:

- `enabled`

### `file_opener`

Current enum values:

- `vscode`
- `vscode-insiders`
- `windsurf`
- `cursor`
- `none`

### `notice`

Current fields:

- `hide_full_access_warning`
- `hide_world_writable_warning`
- `hide_rate_limit_model_nudge`
- `hide_gpt5_1_migration_prompt`
- `hide_gpt-5.1-codex-max_migration_prompt`
- `model_migrations`

## Realtime, audio, platform, and runtime-path settings

Top-level fields:

- `audio`
- `realtime`
- `windows`
- `windows_wsl_setup_acknowledged`
- `js_repl_node_path`
- `js_repl_node_module_dirs`
- `zsh_path`
- `forced_chatgpt_workspace_id`
- `forced_login_method`
- `cli_auth_credentials_store`

### `audio`

Current fields:

- `microphone`
- `speaker`

### `realtime`

Current fields:

- `version`
- `type`

Current `type` values:

- `conversational`
- `transcription`

### `windows`

Current fields:

- `sandbox`
- `sandbox_private_desktop`

Current `windows.sandbox` values:

- `elevated`
- `unelevated`

### `forced_login_method`

Current enum values:

- `chatgpt`
- `api`

### `cli_auth_credentials_store`

Current enum values:

- `file`
- `keyring`
- `auto`
- `ephemeral`

## OTEL settings

Top-level field:

- `otel`

Current fields:

- `log_user_prompt`
- `environment`
- `exporter`
- `trace_exporter`
- `metrics_exporter`

Current exporter variants in source:

- `none`
- `statsig`
- `otlp-http`
- `otlp-grpc`

TLS subfields used by OTEL exporters:

- `ca_certificate`
- `client_certificate`
- `client_private_key`

## Feature flags

`features` is a large boolean flag table. The generated schema currently exposes 61 keys:

- `apply_patch_freeform`
- `apps`
- `child_agents_md`
- `code_mode`
- `code_mode_only`
- `codex_git_commit`
- `codex_hooks`
- `collab`
- `collaboration_modes`
- `connectors`
- `default_mode_request_user_input`
- `elevated_windows_sandbox`
- `enable_experimental_windows_sandbox`
- `enable_fanout`
- `enable_request_compression`
- `exec_permission_approvals`
- `experimental_use_freeform_apply_patch`
- `experimental_use_unified_exec_tool`
- `experimental_windows_sandbox`
- `fast_mode`
- `guardian_approval`
- `image_detail_original`
- `image_generation`
- `include_apply_patch_tool`
- `js_repl`
- `js_repl_tools_only`
- `memories`
- `memory_tool`
- `multi_agent`
- `multi_agent_v2`
- `personality`
- `plugins`
- `prevent_idle_sleep`
- `realtime_conversation`
- `remote_models`
- `request_permissions`
- `request_permissions_tool`
- `request_rule`
- `responses_websockets`
- `responses_websockets_v2`
- `runtime_metrics`
- `search_tool`
- `shell_snapshot`
- `shell_tool`
- `shell_zsh_fork`
- `skill_env_var_dependency_prompt`
- `skill_mcp_dependency_install`
- `sqlite`
- `steer`
- `tool_call_mcp_elicitation`
- `tool_search`
- `tool_suggest`
- `tui_app_server`
- `undo`
- `unified_exec`
- `use_legacy_landlock`
- `use_linux_sandbox_bwrap`
- `voice_transcription`
- `web_search`
- `web_search_cached`
- `web_search_request`

## Experimental and legacy fields observed

The current top-level config surface contains explicit experimental fields:

- `experimental_compact_prompt_file`
- `experimental_realtime_start_instructions`
- `experimental_realtime_ws_backend_prompt`
- `experimental_realtime_ws_base_url`
- `experimental_realtime_ws_model`
- `experimental_realtime_ws_startup_context`
- `experimental_use_freeform_apply_patch`
- `experimental_use_unified_exec_tool`
- `suppress_unstable_features_warning`

The source also still carries these legacy or compatibility-related details:

- deprecated `experimental_instructions_file` field exists in source but is skipped from schema
- legacy `mcp_servers.<id>.name` is still accepted
- `wire_api = "chat"` is explicitly rejected with a migration error
