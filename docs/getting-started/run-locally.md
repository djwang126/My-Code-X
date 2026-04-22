# Run locally

## Install

```sh
npm install
```

This repo uses npm workspaces, so install once from the repo root and keep the root lockfile authoritative.

## Development mode

Run backend and frontend in separate terminals:

```sh
npm run dev:backend
npm run dev:frontend
```

Default local endpoints:
- backend: `http://127.0.0.1:4310`
- frontend dev server: Vite default local dev host/port

Use this when iterating on frontend or backend code directly.

If you need to target one workspace directly, use:

```sh
npm run dev --workspace apps/web
npm run dev --workspace apps/server
```

## Launcher-based startup

```sh
npm start
```

This starts the Node launcher, which:

- builds `apps/web` when needed
- prefers Tailscale for remote access when available
- starts `apps/server` in the background
- prints the reachable URL(s) plus log locations

Supported exposure modes:

- LAN
- Tailscale
- Cloudflare Tunnel

Direct shortcuts:

```sh
npm run start:lan
npm run start:tailscale
npm run start:cloudflare
npm run stop
```

`npm start` prefers Tailscale by default. If Tailscale is not installed, the launcher automatically falls back to LAN mode, prints the local network URLs, and shows the official Tailscale download links for desktop, iOS, and Android so you can enable access away from the same local network later.

`npm run start:tailscale` configures `tailscale serve` and publishes an HTTPS `*.ts.net` URL for the current device. If Tailscale is missing, this explicit Tailscale command prints the official platform download page or Linux install command and exits. On first use after install, Tailscale can prompt you to enable HTTPS certificates / MagicDNS before the launcher continues.

## Production-style backend-only local run

```sh
npm run start:backend
```

Use this when you want the old integrated backend-only shape without the launcher.

## Recommended verification sequence

```sh
npm run lint
npm test
npm run test:integration
npm run test:all
npm run test:e2e
npm run test:e2e:real-resume
npm run smoke -- 3211
npm run smoke:clear -- 3211
```

`npm test` runs the default frontend, backend, and root test suites.

`npm run test:integration` runs the launcher/supervisor integration suites.

`npm run test:all` runs the default suites plus `test:integration`.

Optional live-app-server verification:

```sh
RUN_REAL_CODEX_LIVE=1 npm run test:e2e:real-live
```

PowerShell:

```powershell
$env:RUN_REAL_CODEX_LIVE='1'
npm run test:e2e:real-live
```

Optional upstream compatibility verification:

```sh
npm run compat:schema:check
npm run compat:report
```

When you intentionally adopt a new upstream Codex version, refresh the committed schema baseline with:

```sh
npm run compat:schema:snapshot
```

These schema checks are intended to fail clearly when the tracked Codex surface used by My-Code-X is missing from the committed snapshot, incomplete, or out of date.

Whenever you add a new Codex app-server dependency in My-Code-X, update [used-surface.json](packages/contracts/codex-app-server-schema/used-surface.json) in the same change so the schema compatibility check keeps tracking the real upstream surface the app uses.
