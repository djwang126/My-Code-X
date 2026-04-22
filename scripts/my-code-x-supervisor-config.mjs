import process from 'node:process';
import path from 'node:path';
import { resolveMyCodeXUserDir } from '@my-code-x/utils/my-code-x-user-env';

export const MAX_BACKEND_RESTART_ATTEMPTS = 5;
export const MAX_PROVIDER_RESTART_ATTEMPTS = 5;
export const DEFAULT_BACKEND_STARTUP_TIMEOUT_MS = 60_000;
export const DEFAULT_BACKEND_WATCHDOG_INTERVAL_MS = 5_000;
export const DEFAULT_BACKEND_WATCHDOG_TIMEOUT_MS = 1_000;
export const DEFAULT_BACKEND_WATCHDOG_FAILURE_THRESHOLD = 2;

export function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCliArgs(argv) {
  const parsed = {
    action: 'start',
    expose: '',
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (['start', 'run', 'stop', 'status', 'restart', 'logs'].includes(arg)) {
      parsed.action = arg;
      continue;
    }

    if (arg === '--json') {
      parsed.json = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith('--expose=')) {
      parsed.expose = arg.slice('--expose='.length).trim().toLowerCase();
    }
  }

  return parsed;
}

export function getCloudflaredCommand(platform = process.platform) {
  return platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
}

export function buildBackendInvocation({ env = process.env, repoRoot }) {
  const overrideCommand = String(env.MY_CODE_X_BACKEND_COMMAND || '').trim();
  const overrideArgsJson = String(env.MY_CODE_X_BACKEND_ARGS_JSON || '').trim();
  const overrideCwd = String(env.MY_CODE_X_BACKEND_CWD || '').trim();

  if (overrideCommand) {
    let args = [];
    if (overrideArgsJson) {
      const parsed = JSON.parse(overrideArgsJson);
      if (!Array.isArray(parsed)) {
        throw new Error('MY_CODE_X_BACKEND_ARGS_JSON must be a JSON array');
      }
      args = parsed.map(value => String(value));
    }

    return {
      command: overrideCommand,
      args,
      cwd: overrideCwd || repoRoot,
    };
  }

  return {
    command: process.execPath,
    args: [path.join(repoRoot, 'apps', 'server', 'dist', 'app', 'index.js')],
    cwd: repoRoot,
  };
}

export function buildProviderInvocation({ env = process.env, repoRoot, port, platform = process.platform }) {
  const overrideCommand = String(env.MY_CODE_X_PROVIDER_COMMAND || '').trim();
  const overrideArgsJson = String(env.MY_CODE_X_PROVIDER_ARGS_JSON || '').trim();
  const overrideCwd = String(env.MY_CODE_X_PROVIDER_CWD || '').trim();

  if (overrideCommand) {
    let args = [];
    if (overrideArgsJson) {
      const parsed = JSON.parse(overrideArgsJson);
      if (!Array.isArray(parsed)) {
        throw new Error('MY_CODE_X_PROVIDER_ARGS_JSON must be a JSON array');
      }
      args = parsed.map(value => String(value));
    }

    return {
      command: overrideCommand,
      args,
      cwd: overrideCwd || repoRoot,
    };
  }

  return {
    command: getCloudflaredCommand(platform),
    args: ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
    cwd: repoRoot,
  };
}

export function buildBackendRuntimeEnv({
  env = process.env,
  host,
  port,
  authToken,
  launcherScriptPath,
  exposeMode,
  runtimeDir,
}) {
  const sanitizedEnv = { ...env };
  delete sanitizedEnv.MY_CODE_X_TAILSCALE_MANAGED;
  delete sanitizedEnv.MY_CODE_X_TAILSCALE_URL;
  delete sanitizedEnv.MY_CODE_X_TAILSCALE_OWNER_ID;
  delete sanitizedEnv.MY_CODE_X_TAILSCALE_DNS_NAME;

  return {
    ...sanitizedEnv,
    HOST: host,
    PORT: String(port),
    MY_CODE_X_AUTH_TOKEN: authToken,
    CODEX_WORKING_DIR: env.CODEX_WORKING_DIR || resolveMyCodeXUserDir(env.MY_CODE_X_USER_DIR || ''),
    WEB_CODEX_RESTART_SCRIPT: launcherScriptPath,
    MY_CODE_X_EXPOSE_MODE: exposeMode,
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
  };
}

export function readSupervisorConfig({ env = process.env, requestedExpose = '', runtimeDir, getBindHost, buildHttpUrl }) {
  const exposeMode = requestedExpose || String(env.MY_CODE_X_EXPOSE_MODE || 'lan').trim() || 'lan';
  const host = getBindHost(exposeMode, String(env.HOST || '').trim());
  const port = parseNumber(env.PORT, 4310);
  const authToken = String(env.MY_CODE_X_AUTH_TOKEN || '').trim();
  const backendStartupTimeoutMs = parseNumber(
    env.MY_CODE_X_BACKEND_STARTUP_TIMEOUT_MS,
    DEFAULT_BACKEND_STARTUP_TIMEOUT_MS,
  );
  const backendWatchdogIntervalMs = parseNumber(
    env.MY_CODE_X_BACKEND_WATCHDOG_INTERVAL_MS,
    DEFAULT_BACKEND_WATCHDOG_INTERVAL_MS,
  );
  const backendWatchdogTimeoutMs = parseNumber(
    env.MY_CODE_X_BACKEND_WATCHDOG_TIMEOUT_MS,
    DEFAULT_BACKEND_WATCHDOG_TIMEOUT_MS,
  );
  const backendWatchdogFailureThreshold = Math.max(
    1,
    parseNumber(
      env.MY_CODE_X_BACKEND_WATCHDOG_FAILURE_THRESHOLD,
      DEFAULT_BACKEND_WATCHDOG_FAILURE_THRESHOLD,
    ),
  );
  const configuredTailscaleUrl = String(env.MY_CODE_X_TAILSCALE_URL || '').trim();
  const configuredTailscaleOwnerId = String(env.MY_CODE_X_TAILSCALE_OWNER_ID || '').trim();

  return {
    exposeMode,
    host,
    port,
    authToken,
    backendStartupTimeoutMs,
    backendWatchdogIntervalMs,
    backendWatchdogTimeoutMs,
    backendWatchdogFailureThreshold,
    configuredTailscaleUrl,
    configuredTailscaleOwnerId,
    runtimeDir,
    localUrl: buildHttpUrl(host, port),
  };
}
