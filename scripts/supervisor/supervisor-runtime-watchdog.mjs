import { probeBackendHealth } from '../my-code-x-supervisor-health.mjs';
import { resetBackendHealthWatchdogState, writeState } from './supervisor-runtime-context.mjs';

export function createStartBackendHealthWatchdog(context, { restartBackend }) {
  async function runBackendHealthWatchdogCheck() {
    if (
      context.stopping ||
      context.backendRestartInProgress ||
      context.backendHealthCheckInFlight ||
      !context.backendChild ||
      !context.state.backend.pid ||
      !context.state.backend.serverInstanceId
    ) {
      return;
    }

    context.backendHealthCheckInFlight = true;
    const watchedPid = context.state.backend.pid;

    try {
      const health = await probeBackendHealth(context.state, {
        authToken: context.config.authToken,
        timeoutMs: context.config.backendWatchdogTimeoutMs,
      });

      if (watchedPid !== context.state.backend.pid || context.backendChild?.pid !== watchedPid) {
        return;
      }

      if (health.ok) {
        resetBackendHealthWatchdogState(context);
        return;
      }

      context.backendHealthFailureCount += 1;
      context.state.status = 'degraded';
      context.state.lastError = health.error;
      await writeState(context);

      if (context.backendHealthFailureCount < context.config.backendWatchdogFailureThreshold) {
        return;
      }

      resetBackendHealthWatchdogState(context);
      restartBackend('restart').catch(async error => {
        context.state.status = 'failed';
        context.state.lastError = error instanceof Error ? error.message : String(error);
        await writeState(context);
      });
    } finally {
      context.backendHealthCheckInFlight = false;
    }
  }

  return function startBackendHealthWatchdog() {
    if (
      context.backendHealthWatchdog ||
      !Number.isFinite(context.config.backendWatchdogIntervalMs) ||
      context.config.backendWatchdogIntervalMs <= 0
    ) {
      return;
    }

    context.backendHealthWatchdog = setInterval(() => {
      runBackendHealthWatchdogCheck().catch(() => {});
    }, context.config.backendWatchdogIntervalMs);
    context.backendHealthWatchdog.unref?.();
  };
}
