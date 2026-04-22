import process from 'node:process';

import { buildProviderInvocation, MAX_PROVIDER_RESTART_ATTEMPTS } from '../my-code-x-supervisor-config.mjs';
import { repoRoot } from '../my-code-x-runtime-paths.mjs';
import { retryWithBackoff } from '../my-code-x-retry.mjs';
import { startManagedProcess, stopChild } from '../my-code-x-managed-process.mjs';
import {
  clearProviderState,
  deriveRuntimeStatus,
  isUnrecoverableLaunchError,
  setProviderUrl,
  setStatus,
  waitForCloudflareQuickTunnelUrl,
  writeState,
} from './supervisor-runtime-context.mjs';

export function createProviderOperations(context, extractCloudflareQuickTunnelUrl) {
  async function restartProvider(reason = 'restart') {
    if (context.providerRestartInProgress || context.stopping || !context.state.provider.kind) {
      return false;
    }

    await stopChild(context.providerChild);
    clearProviderState(context);
    context.state.status = context.state.backend.serverInstanceId ? 'degraded' : context.state.status;
    await writeState(context);
    return await launchProviderWithRetry(reason);
  }

  function attachProviderExitHandler(child) {
    child.on('exit', () => {
      if (context.providerChild !== child) {
        return;
      }

      clearProviderState(context);
      if (context.state.backend.serverInstanceId && context.state.provider.kind) {
        context.state.status = 'degraded';
      }
      writeState(context).catch(() => {});
      if (!context.stopping && !context.providerRestartInProgress && context.state.provider.kind) {
        restartProvider('restart').catch(async error => {
          context.state.status = deriveRuntimeStatus(context);
          context.state.lastError = error instanceof Error ? error.message : String(error);
          await writeState(context);
        });
      }
    });
  }

  async function launchProviderWithRetry(reason = 'start') {
    if (context.config.exposeMode === 'tailscale') {
      context.state.provider = {
        pid: 0,
        kind: 'tailscale',
        url: context.config.configuredTailscaleUrl,
        ownerId: context.config.configuredTailscaleOwnerId,
      };
      context.state.exposureUrls = context.config.configuredTailscaleUrl ? [context.config.configuredTailscaleUrl] : [];
      context.state.status = deriveRuntimeStatus(context, { booting: reason === 'start' });
      await writeState(context);
      return Boolean(context.config.configuredTailscaleUrl);
    }

    if (context.config.exposeMode !== 'cloudflare') {
      clearProviderState(context, { preserveKind: false });
      context.state.status = deriveRuntimeStatus(context, { booting: reason === 'start' });
      await writeState(context);
      return true;
    }

    context.providerRestartInProgress = true;
    context.state.provider.kind = 'cloudflare';

    try {
      await retryWithBackoff({
        maxAttempts: MAX_PROVIDER_RESTART_ATTEMPTS,
        shouldContinue: () => !context.stopping,
        beforeAttempt: async ({ isFirstAttempt }) => {
          clearProviderState(context);
          setStatus(
            context,
            context.state.backend.serverInstanceId ? 'degraded' : reason === 'restart' ? 'restarting' : 'starting',
            isFirstAttempt ? '' : context.state.lastError,
          );
          await writeState(context);
        },
        attempt: async () => {
          let combinedLogs = '';
          const invocation = buildProviderInvocation({
            env: process.env,
            repoRoot,
            port: context.config.port,
          });
          const managedProvider = startManagedProcess(invocation.command, invocation.args, {
            cwd: invocation.cwd,
            env: process.env,
            outLogPath: context.paths.providerOutLog,
            errLogPath: context.paths.providerErrLog,
            onStdout(chunk) {
              combinedLogs += chunk;
            },
            onStderr(chunk) {
              combinedLogs += chunk;
            },
          });
          context.providerChild = managedProvider.child;
          attachProviderExitHandler(context.providerChild);
          await managedProvider.spawned;

          context.state.provider.pid = context.providerChild.pid || 0;
          await writeState(context);

          const url = await waitForCloudflareQuickTunnelUrl(
            extractCloudflareQuickTunnelUrl,
            context.providerChild,
            () => combinedLogs,
          );
          setProviderUrl(context, url);
          setStatus(context, deriveRuntimeStatus(context, { booting: !context.state.backend.serverInstanceId }), '');
          await writeState(context);
          return true;
        },
        onError: async (error, { isLastAttempt }) => {
          setStatus(context, context.state.status, error instanceof Error ? error.message : String(error));
          await writeState(context);
          await stopChild(context.providerChild);
          clearProviderState(context);
          await writeState(context);

          if (isUnrecoverableLaunchError(error)) {
            setStatus(context, context.state.backend.serverInstanceId ? 'degraded' : 'failed', context.state.lastError);
            await writeState(context);
            throw error;
          }

          if (isLastAttempt) {
            setStatus(context, context.state.backend.serverInstanceId ? 'degraded' : 'failed', context.state.lastError);
            await writeState(context);
          }
        },
      });

      return true;
    } catch (error) {
      if (!context.state.backend.serverInstanceId) {
        throw error;
      }
      return false;
    } finally {
      context.providerRestartInProgress = false;
    }
  }

  return {
    launchProviderWithRetry,
    restartProvider,
  };
}
