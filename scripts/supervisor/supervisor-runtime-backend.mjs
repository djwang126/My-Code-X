import process from 'node:process';

import {
  buildBackendInvocation,
  buildBackendRuntimeEnv,
  MAX_BACKEND_RESTART_ATTEMPTS,
} from '../my-code-x-supervisor-config.mjs';
import { repoRoot } from '../my-code-x-runtime-paths.mjs';
import { retryWithBackoff } from '../my-code-x-retry.mjs';
import { startManagedProcess, stopChild } from '../my-code-x-managed-process.mjs';
import {
  clearBackendState,
  deriveRuntimeStatus,
  isUnrecoverableLaunchError,
  resetBackendHealthWatchdogState,
  setStatus,
  waitForBackendHealthy,
  writeState,
} from './supervisor-runtime-context.mjs';

export function createBackendOperations(context) {
  async function restartBackend(reason = 'restart') {
    if (context.backendRestartInProgress || context.stopping) {
      return false;
    }

    context.backendRestartInProgress = true;

    try {
      resetBackendHealthWatchdogState(context);
      await stopChild(context.backendChild);
      clearBackendState(context);
      await writeState(context);
      await launchBackendWithRetry(reason);
      return true;
    } catch (error) {
      context.backendRestartInProgress = false;
      throw error;
    }
  }

  function attachBackendExitHandler(child) {
    child.on('exit', () => {
      if (context.backendChild !== child) {
        return;
      }

      resetBackendHealthWatchdogState(context);
      clearBackendState(context);
      if (context.state.status !== 'failed') {
        context.state.status = context.state.provider.kind ? 'degraded' : 'starting';
      }
      writeState(context).catch(() => {});
      if (!context.stopping && !context.backendRestartInProgress) {
        restartBackend('restart').catch(async error => {
          context.state.status = 'failed';
          context.state.lastError = error instanceof Error ? error.message : String(error);
          await writeState(context);
        });
      }
    });
  }

  async function launchBackendWithRetry(reason = 'start') {
    context.backendRestartInProgress = true;
    try {
      await retryWithBackoff({
        maxAttempts: MAX_BACKEND_RESTART_ATTEMPTS,
        shouldContinue: () => !context.stopping,
        beforeAttempt: async () => {
          clearBackendState(context);
          setStatus(context, reason === 'restart' ? 'restarting' : 'starting', '');
          await writeState(context);
        },
        attempt: async () => {
          const invocation = buildBackendInvocation({ env: process.env, repoRoot });
          const env = buildBackendRuntimeEnv({
            env: process.env,
            host: context.config.host,
            port: context.config.port,
            authToken: context.config.authToken,
            repoRoot,
            launcherScriptPath: context.launcherScriptPath,
            exposeMode: context.config.exposeMode,
            runtimeDir: context.paths.runtimeDir,
          });

          const managedBackend = startManagedProcess(invocation.command, invocation.args, {
            cwd: invocation.cwd,
            env,
            outLogPath: context.paths.backendOutLog,
            errLogPath: context.paths.backendErrLog,
          });
          context.backendChild = managedBackend.child;
          attachBackendExitHandler(context.backendChild);
          await managedBackend.spawned;

          context.state.backend.pid = context.backendChild.pid || 0;
          await writeState(context);

          const health = await waitForBackendHealthy(context, context.backendChild, context.config.backendStartupTimeoutMs);
          resetBackendHealthWatchdogState(context);
          context.state.backend.serverInstanceId = health.serverInstanceId;
          setStatus(context, deriveRuntimeStatus(context), '');
          await writeState(context);
        },
        onError: async (error, { isLastAttempt }) => {
          setStatus(context, context.state.status, error instanceof Error ? error.message : String(error));
          await writeState(context);
          await stopChild(context.backendChild);
          clearBackendState(context);
          await writeState(context);

          if (isUnrecoverableLaunchError(error)) {
            setStatus(context, 'failed', context.state.lastError);
            await writeState(context);
            throw error;
          }

          if (isLastAttempt) {
            setStatus(context, 'failed', context.state.lastError);
            await writeState(context);
          }
        },
      });
    } finally {
      context.backendRestartInProgress = false;
    }
  }

  return {
    launchBackendWithRetry,
    restartBackend,
  };
}
