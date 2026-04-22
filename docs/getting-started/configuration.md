# Configuration

## Repo `.env`

- My-Code-X now reads the repo-root `.env` file at startup
- current entrypoints that load `.env`: launcher, supervisor, backend
- explicit process environment variables still win over `.env`
- use `.env.example` as the starting template

## Backend environment variables

- `HOST` - bind host, default `127.0.0.1`
- `PORT` - bind port, default `4310`
- `MY_CODE_X_AUTH_TOKEN` - bearer token required for `/api/*` requests when set
- `SERVER_INSTANCE_ID` - optional explicit server instance identifier
- `CODEX_BIN` - Codex executable name/path, default `codex`
- `CODEX_WORKING_DIR` - working directory used for thread/turn startup, default repo root
- `MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES` - idle shutdown timeout in minutes, default `10`, disable with `0` or a negative value
- `MY_CODE_X_DYNAMIC_TOOLS_JSON` - optional JSON array of dynamic tool specs to forward on `thread/start`

## Launcher behavior

- `npm start` uses the cross-platform Node launcher instead of calling `apps/server` directly
- launcher default bind host is:
  - `0.0.0.0` for LAN and Tailscale
  - `127.0.0.1` for Cloudflare Tunnel quick-tunnel mode
- set `HOST` explicitly if you need to override that default
- the launcher records managed process IDs in repo-local `.tmp_my_code_x*.pid` files

## Runtime notes

- built frontend assets are served from `apps/web/dist`
- browser bootstrap uses `GET /api/v2/session`
- dynamic tools are only sent when `MY_CODE_X_DYNAMIC_TOOLS_JSON` is configured
- threadless requests such as auth refresh are supported by the current request contract
- launcher-driven restarts now re-enter through the Node launcher entrypoint instead of a Windows-only `cmd.exe + .bat` path

## Current caveats

- current runtime defaults still force permissive local execution behavior; issue #11 tracks narrowing/alignment work
- because of that, interactive-flow reachability is not yet the final intended product policy
- Cloudflare quick tunnels are public by default and need extra protection before sharing sensitive workspaces
- advanced remote nginx/basic-auth access currently assumes `MY_CODE_X_AUTH_TOKEN` is not set on the backend path

## Dynamic tools format note

`MY_CODE_X_DYNAMIC_TOOLS_JSON` should be valid JSON understood by the backend's app-server startup/thread configuration path. Keep this explicit and environment-driven; do not hard-code experimental tool registration in the frontend.
