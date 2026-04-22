import { createBackendOperations } from './supervisor-runtime-backend.mjs';
import { createProviderOperations } from './supervisor-runtime-provider.mjs';
import { createStartBackendHealthWatchdog } from './supervisor-runtime-watchdog.mjs';

export function createRuntimeOperations(context, extractCloudflareQuickTunnelUrl) {
  const backendOperations = createBackendOperations(context);
  const providerOperations = createProviderOperations(context, extractCloudflareQuickTunnelUrl);
  const startBackendHealthWatchdog = createStartBackendHealthWatchdog(context, {
    restartBackend: backendOperations.restartBackend,
  });

  return {
    launchBackendWithRetry: backendOperations.launchBackendWithRetry,
    launchProviderWithRetry: providerOperations.launchProviderWithRetry,
    restartBackend: backendOperations.restartBackend,
    startBackendHealthWatchdog,
  };
}
