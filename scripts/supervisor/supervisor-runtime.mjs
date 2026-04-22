import process from 'node:process';

import { buildHttpUrl, extractCloudflareQuickTunnelUrl, getBindHost } from '../my-code-x-exposure.mjs';
import { readSupervisorConfig } from '../my-code-x-supervisor-config.mjs';
import { repoRoot } from '../my-code-x-runtime-paths.mjs';
import { refreshTailscaleServeOwner } from '../tailscale-serve.mjs';
import { createRuntimeContext, writeState } from './supervisor-runtime-context.mjs';
import { startControlServer, registerShutdownSignals } from './supervisor-runtime-control.mjs';
import { createRuntimeOperations } from './supervisor-runtime-operations.mjs';
import { removeIfExists } from './supervisor-state-files.mjs';

export async function runSupervisor({ parsed, paths, launcherScriptPath }) {
  const config = readSupervisorConfig({
    env: process.env,
    requestedExpose: parsed.expose,
    repoRoot,
    runtimeDir: paths.runtimeDir,
    getBindHost,
    buildHttpUrl,
  });

  const context = createRuntimeContext({
    parsed,
    paths,
    config,
    launcherScriptPath,
    removeIfExists,
  });
  const operations = createRuntimeOperations(context, extractCloudflareQuickTunnelUrl);

  await startControlServer(context, operations);
  if (config.exposeMode === 'tailscale' && config.configuredTailscaleOwnerId && config.configuredTailscaleUrl) {
    await refreshTailscaleServeOwner(
      {
        ownerId: config.configuredTailscaleOwnerId,
        runtimeDir: paths.runtimeDir,
        port: config.port,
        url: config.configuredTailscaleUrl,
        ownerPid: process.pid,
        pidRole: 'supervisor',
      },
      {
        userDir: process.env.MY_CODE_X_USER_DIR,
      },
    ).catch(() => {});
  }
  await writeState(context);

  try {
    await operations.launchProviderWithRetry('start');
    await operations.launchBackendWithRetry('start');
    operations.startBackendHealthWatchdog();
  } catch (error) {
    context.state.status = 'failed';
    context.state.lastError = error instanceof Error ? error.message : String(error);
    await writeState(context);
  }

  registerShutdownSignals(context);
}
