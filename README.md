[简体中文](./README.zh-CN.md) | English

# My-Code-X

Use local Codex from a phone browser for vibe-coding or other production work.

My-Code-X lets you use Codex from a phone, tablet, or desktop browser, with support for multiple tabs and multiple working directories at the same time.

The codebase is  cross-platform (Windows, Linux, macOS).

## Features

- SSE streaming interaction
- Support for interactive request flows such as approvals and user input
- Support for overriding the base Codex prompt, which is useful for prompt design or workflows beyond vibe-coding
- Support for context window settings
- Support for image uploads
- Quickly browse and edit files in the local workspace
- Local-first design, using Tailscale by default for secure and convenient remote access

## Feature Preview

# Work across multiple tabs
![Work across multiple tabs](./docs/images/multi-tab-view.png)

# Different features
![Different features](./docs/images/features.png)

## Requirements

Before getting started, prepare the following:

- Install the Codex CLI or the Codex Windows app
- Install Tailscale on both your phone and your computer

## Quick Start

Download the latest portable package for your platform:

- [Windows x64](https://github.com/djwang126/My-Code-X/releases/latest/download/my-code-x-windows-x64.zip)
- [Linux x64](https://github.com/djwang126/My-Code-X/releases/latest/download/my-code-x-linux-x64.tar.gz)
- [macOS arm64](https://github.com/djwang126/My-Code-X/releases/latest/download/my-code-x-macos-arm64.tar.gz)

After extracting the portable package, you can use it directly:

- Start on Windows: `start-my-code-x.cmd`
- Stop on Windows: `stop-my-code-x.cmd`
- Start on Linux / macOS: `start-my-code-x.sh`
- Stop on Linux / macOS: `stop-my-code-x.sh`

## Configuration

### Environment Variables

My-Code-X loads configuration from the user directory first:

- Default Windows directory: `%USERPROFILE%\.My-Code-X\`
- Default Linux / macOS directory: `~/.My-Code-X/`

Common options:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4310` | Web service port |
| `HOST` | `127.0.0.1` | Bind address for the service; change this only when you need LAN access |
| `MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES` | `10` | Minutes before an idle Codex instance shuts down automatically |

Example:

```env
PORT=4310
MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=10
```

### Custom Prompt Overrides

My-Code-X reads prompt overrides from Markdown files in `.My-Code-X/custom-harness/prompts-override`. You can freely edit the existing files or add new ones.

The file content is the base prompt you want to inject into Codex. The filename is shown directly in the settings panel as the Prompt override option. For example, `reviewer.md` appears as `reviewer`.

Restart My-Code-X to reload the available options.

## Security Notes

- LAN mode may expose the app to other devices on your local network
- Tailscale is usually the safer way to access it remotely
- Cloudflare Quick Tunnels are currently not recommended, and they do not support SSE

## Known Issues

The project is currently developed and tested mainly on Windows, so behavior on other platforms maybe unstable.
Codex's native Code Review behaves a bit oddly at the moment, so it is not recommended.

## License

This project is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full text.

If you modify My-Code-X and let users access that modified version over a network, the AGPL requires you to provide those users with the corresponding source code for the version they are using.

The canonical public source repository for this project is:

- <https://github.com/djwang126/My-Code-X>
