# Codex slash commands research note

This note records the current upstream Codex TUI slash-command surface, what each command does, and what is relevant to My-Code-X.

Primary source files checked:
- `D:\workspace\codex\codex-rs\tui\src\slash_command.rs`
- `D:\workspace\codex\codex-rs\tui\src\chatwidget.rs`
- `D:\workspace\codex\codex-rs\tui\src\bottom_pane\command_popup.rs`
- `D:\workspace\codex\codex-rs\app-server-protocol\schema\typescript\ClientRequest.ts`

This is a research note, not a parity goal. My-Code-X should follow product needs and the Codex app-server API, not copy the upstream terminal UI blindly.

## Full built-in slash command list

### Session and thread
- `/new` — start a new chat/session.
- `/resume` — open a saved-thread picker.
- `/fork` — fork the current chat/thread.
- `/rename [name]` — rename the current thread. Supports inline args.
- `/init` — create `AGENTS.md` by sending Codex's built-in init prompt.
- `/compact` — compact/summarize conversation context.
- `/clear` — clear the terminal UI and start a new chat.
- `/exit` — exit Codex.
- `/quit` — alias of `/exit`.
- `/logout` — log out of Codex, then exit.
- `/rollout` — print the rollout file path. Debug-only.

### Review and coding helpers
- `/review [instructions]` — open review presets or run a custom review with inline instructions.
- `/diff` — show git diff, including untracked files.
- `/copy` — copy the latest Codex output.
- `/mention` — insert `@` mention syntax.
- `/skills` — open/list skills.
- `/status` — show session configuration and token/rate-limit usage.
- `/debug-config` — show config layers and config requirement sources.

### Model, mode, and permissions
- `/model` — choose model and reasoning effort.
- `/fast [on|off|status]` — toggle or inspect Fast mode. Supports inline args.
- `/personality` — choose a communication style.
- `/plan [prompt]` — switch to Plan mode; with args, submit a message in Plan mode. Supports inline args.
- `/collab` — open collaboration mode picker.
- `/agent` — switch the active agent thread.
- `/subagents` — same command family as `/agent`.
- `/permissions` — choose approval/sandbox settings.
- `/approvals` — alias of `/permissions`.
- `/experimental` — toggle experimental features.
- `/setup-default-sandbox` — start Windows elevated sandbox setup flow.
- `/sandbox-add-read-dir <absolute-path>` — add a Windows read-only sandbox path. Supports inline args.

### UI and terminal configuration
- `/title` — configure terminal title items.
- `/statusline` — configure status-line items.
- `/theme` — choose syntax-highlighting theme.

### Integrations and ecosystem
- `/mcp` — list configured MCP tools.
- `/apps` — manage apps/connectors.
- `/plugins` — browse plugins.

### Realtime and audio
- `/realtime` — toggle realtime voice mode.
- `/settings` — configure realtime microphone/speaker.

### Background terminals and internal/debug commands
- `/ps` — list background terminals.
- `/stop` — stop background terminals.
- `/clean` — alias of `/stop`.
- `/feedback` — send logs/feedback to maintainers.
- `/test-approval` — test approval flow. Debug-only.
- `/debug-m-drop` — internal memory debugging command. Do not use.
- `/debug-m-update` — internal memory debugging command. Do not use.

## Important upstream behavior notes

### Aliases
- `/quit` is an alias of `/exit`.
- `/approvals` is an alias of `/permissions`.
- `/clean` is an alias of `/stop`.

### Hidden or limited-visibility commands
- `/quit` and `/approvals` are hidden in the default popup so each action appears once.
- `/apps` is filtered out of the popup even though the command exists.
- `/debug-*` commands are hidden from the popup.
- `/rollout` and `/test-approval` are debug-only.
- `/sandbox-add-read-dir` is Windows-only.
- `/plan`, `/collab`, `/fast`, `/personality`, `/realtime`, and `/settings` are feature-gated.

### Inline-argument commands
These support `/<command> ...` inline args instead of only opening a picker:
- `/rename`
- `/review`
- `/plan`
- `/fast`
- `/sandbox-add-read-dir`

### Custom prompts
Upstream also supports custom prompt commands in the form `/prompts:<name>`, but current upstream docs/code mark custom prompts as deprecated in favor of skills. My-Code-X should not treat prompt parity as a priority feature.

## Relevance to My-Code-X

### Good fits for a mobile-friendly web client
- `/new`
- `/compact`
- `/review`
- `/rename`
- `/fork`
- `/status`
- `/mcp`

### Already broadly covered in the current My-Code-X product
The web app already exposes runtime settings and session metadata that cover the main value of:
- `/model`
- `/permissions` / `/approvals`
- model reasoning effort
- thread status and token usage display

### Low-priority or poor-fit items for current scope
These are mostly TUI convenience features, desktop-terminal features, Windows-specific setup, or debug/internal features:
- `/clear`
- `/copy`
- `/mention`
- `/title`
- `/statusline`
- `/theme`
- `/ps`
- `/stop`
- `/setup-default-sandbox`
- `/sandbox-add-read-dir`
- `/feedback`
- `/test-approval`
- `/debug-m-drop`
- `/debug-m-update`
- `/realtime`
- `/settings`
