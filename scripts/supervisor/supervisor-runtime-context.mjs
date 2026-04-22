import fsp from 'node:fs/promises';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

import { writeJsonFileAtomic, ensureFileParent } from '../my-code-x-runtime-state.mjs';
import { probeBackendHealth } from '../my-code-x-supervisor-health.mjs';
import { sleep } from '../my-code-x-managed-process.mjs';

export function createRuntimeContext({
  parsed,
  paths,
  config,
  launcherScriptPath,
  removeIfExists,
}) {
  const controlToken = randomUUID();
  const startedAt = new Date().toISOString();
  const state = {
    status: 'starting',
    startedAt,
    updatedAt: startedAt,
    exposeMode: config.exposeMode,
    runtimeDir: paths.runtimeDir,
    localUrl: config.localUrl,
    exposureUrls: config.exposeMode === 'tailscale' && config.configuredTailscaleUrl ? [config.configuredTailscaleUrl] : [],
    lastError: '',
    supervisor: {
      pid: process.pid,
    },
    backend: {
      pid: 0,
      host: config.host,
      port: config.port,
      serverInstanceId: '',
    },
    provider: {
      pid: 0,
      kind: config.exposeMode === 'cloudflare' ? 'cloudflare' : config.exposeMode === 'tailscale' ? 'tailscale' : '',
      url: config.exposeMode === 'tailscale' ? config.configuredTailscaleUrl : '',
      ownerId: config.exposeMode === 'tailscale' ? config.configuredTailscaleOwnerId : '',
    },
    logs: {
      supervisorOutLog: paths.supervisorOutLog,
      supervisorErrLog: paths.supervisorErrLog,
      backendOutLog: paths.backendOutLog,
      backendErrLog: paths.backendErrLog,
      providerOutLog: paths.providerOutLog,
      providerErrLog: paths.providerErrLog,
    },
    control: {
      port: 0,
      token: controlToken,
    },
  };

  return {
    parsed,
    paths,
    config,
    launcherScriptPath,
    removeIfExists,
    controlToken,
    state,
    stopping: false,
    backendRestartInProgress: false,
    providerRestartInProgress: false,
    backendChild: null,
    providerChild: null,
    backendHealthFailureCount: 0,
    backendHealthCheckInFlight: false,
    backendHealthWatchdog: null,
    stateWritePromise: Promise.resolve(),
    controlServer: null,
  };
}

export function deriveRuntimeStatus(context, { booting = false } = {}) {
  if (context.stopping) {
    return 'stopping';
  }

  if (!context.state.backend.serverInstanceId) {
    return booting ? 'starting' : context.state.status;
  }

  if (context.state.provider.kind && !context.state.provider.url) {
    return 'degraded';
  }

  return 'healthy';
}

export function setStatus(context, status, lastError = context.state.lastError) {
  context.state.status = status;
  context.state.lastError = lastError;
}

export function clearBackendState(context) {
  context.state.backend.pid = 0;
  context.state.backend.serverInstanceId = '';
}

export function clearProviderState(context, { preserveKind = true } = {}) {
  context.state.provider.pid = 0;
  context.state.provider.url = '';
  context.state.exposureUrls = [];
  if (!preserveKind) {
    context.state.provider.kind = '';
    context.state.provider.ownerId = '';
  }
}

export function setProviderUrl(context, url = '') {
  context.state.provider.url = url;
  context.state.exposureUrls = url ? [url] : [];
}

export function isUnrecoverableLaunchError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|spawn|not recognized/i.test(message);
}

export function resetBackendHealthWatchdogState(context) {
  context.backendHealthFailureCount = 0;
}

export function stopBackendHealthWatchdog(context) {
  if (context.backendHealthWatchdog) {
    clearInterval(context.backendHealthWatchdog);
    context.backendHealthWatchdog = null;
  }

  resetBackendHealthWatchdogState(context);
}

export async function writeState(context) {
  const writeOperation = async () => {
    context.state.updatedAt = new Date().toISOString();
    await writeJsonFileAtomic(context.paths.stateFile, context.state);
    await ensureFileParent(context.paths.supervisorPid);
    await fsp.writeFile(context.paths.supervisorPid, `${process.pid}\n`, 'utf8');

    if (context.state.backend.pid) {
      await fsp.writeFile(context.paths.backendPid, `${context.state.backend.pid}\n`, 'utf8');
    } else {
      await context.removeIfExists(context.paths.backendPid);
    }

    if (context.state.provider.pid) {
      await fsp.writeFile(context.paths.providerPid, `${context.state.provider.pid}\n`, 'utf8');
    } else {
      await context.removeIfExists(context.paths.providerPid);
    }
  };

  const nextWritePromise = context.stateWritePromise.then(writeOperation, writeOperation);
  context.stateWritePromise = nextWritePromise.catch(() => {});
  return await nextWritePromise;
}

export async function waitForBackendHealthy(context, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      const exitSummary = child.exitCode !== null ? `code ${child.exitCode}` : `signal ${child.signalCode}`;
      throw new Error(`backend exited before becoming healthy (${exitSummary})`);
    }

    const health = await probeBackendHealth(context.state, {
      authToken: context.config.authToken,
      timeoutMs: Math.min(timeoutMs, context.config.backendWatchdogTimeoutMs),
    });
    if (health.ok) {
      return {
        serverInstanceId: health.serverInstanceId,
      };
    }

    await sleep(200);
  }

  throw new Error(`backend did not become healthy within ${timeoutMs / 1000}s`);
}

export async function waitForCloudflareQuickTunnelUrl(
  extractCloudflareQuickTunnelUrl,
  child,
  getCombinedLogs,
  timeoutMs = 25_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = extractCloudflareQuickTunnelUrl(getCombinedLogs());
    if (url) {
      return url;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('cloudflared exited before publishing a quick tunnel URL');
    }

    await sleep(200);
  }

  throw new Error('cloudflared did not publish a quick tunnel URL');
}
