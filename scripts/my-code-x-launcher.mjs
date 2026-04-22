import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadMyCodeXUserEnv } from '@my-code-x/utils/my-code-x-user-env';
import { applyEnvFileToEnv } from '@my-code-x/utils/env-file';
export { extractCloudflareQuickTunnelUrl, getBindHost } from './my-code-x-exposure.mjs';
import { repoRoot } from './my-code-x-runtime-paths.mjs';
import { resolveSpawnInvocation } from './shared/spawn-invocation.mjs';
import { createRunTailscaleCommand } from './tailscale-serve.mjs';
import {
  buildTailscaleLanFallbackHelp,
  TailscaleInstallRequiredError,
  ensureTailscaleInstalled,
} from './tailscale/tailscale-bootstrap.mjs';
import { ensureLaunchBuilds } from './launcher/launcher-build.mjs';
import { parseCliArgs, resolveExposureSelection } from './launcher/launcher-cli.mjs';
import { formatStartSuccess, buildStartFailureMessage } from './launcher/launcher-output.mjs';
import { collectLanIpv4Addresses } from './launcher/launcher-network.mjs';
import {
  getLauncherPaths,
  parseNumber,
  runCommand,
  readSupervisorState,
  runSupervisorCommand,
  stopLauncherManagedProcesses,
} from './launcher/launcher-process.mjs';
import { printCliError } from './shared/cli-error-output.mjs';

const supervisorScriptPath = path.join(repoRoot, 'scripts', 'my-code-x-supervisor.mjs');
const launcherScriptPath = fileURLToPath(import.meta.url);
const runTailscaleCommand = createRunTailscaleCommand({ repoRoot, runCommand });

async function handleStart(args) {
  const exposureSelection = resolveExposureSelection(args);
  const launcherPaths = getLauncherPaths();
  let exposeMode = exposureSelection.mode;
  let fallbackNotice = '';

  if (args.restart || process.env.WEB_CODEX_RESTART_SHUTDOWN_TOKEN) {
    if (!args.noBuild) {
      await ensureLaunchBuilds(launcherPaths.buildStamps);
    }
    await runSupervisorCommand(supervisorScriptPath, ['restart']);
    return;
  }

  if (!args.noBuild) {
    await ensureLaunchBuilds(launcherPaths.buildStamps);
  }

  if (exposeMode === 'tailscale' && exposureSelection.source === 'default') {
    try {
      await ensureTailscaleInstalled({ runTailscaleCommand });
    } catch (error) {
      if (!(error instanceof TailscaleInstallRequiredError)) {
        throw error;
      }

      exposeMode = 'lan';
      fallbackNotice = buildTailscaleLanFallbackHelp({ platform: process.platform });
    }
  }

  try {
    await runSupervisorCommand(supervisorScriptPath, ['start', `--expose=${exposeMode}`, '--json'], {
      captureOutput: true,
      env: {
        ...process.env,
        MY_CODE_X_EXPOSE_MODE: exposeMode,
      },
    });

    const state = await readSupervisorState();
    const resolvedPort = parseNumber(process.env.PORT, state?.backend?.port || 4310);
    process.stdout.write(formatStartSuccess({ state, exposeMode, port: resolvedPort }));
    if (fallbackNotice) {
      process.stdout.write(`\n${fallbackNotice}\n`);
    }
  } catch (error) {
    const state = await readSupervisorState().catch(() => null);
    const message = await buildStartFailureMessage({
      error,
      state,
      paths: launcherPaths,
    });
    throw new Error(message);
  }
}

async function handleStop(args) {
  const existingState = await readSupervisorState().catch(() => null);
  await stopLauncherManagedProcesses({
    existingState,
    stopAll: args.all,
  });
}

async function handleStatus(args) {
  const result = await runSupervisorCommand(
    supervisorScriptPath,
    ['status', ...(args.json ? ['--json'] : [])],
    { captureOutput: args.json },
  );
  if (args.json) {
    process.stdout.write(result.stdout);
  }
}

async function handleRestart() {
  const launcherPaths = getLauncherPaths();
  await ensureLaunchBuilds(launcherPaths.buildStamps);
  await runSupervisorCommand(supervisorScriptPath, ['restart']);
}

async function handleLogs(args) {
  const result = await runSupervisorCommand(
    supervisorScriptPath,
    ['logs', ...(args.json ? ['--json'] : [])],
    { captureOutput: args.json },
  );
  if (args.json) {
    process.stdout.write(result.stdout);
  }
}

function printHelp() {
  process.stdout.write(`My-Code-X launcher\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  npm start\n`);
  process.stdout.write(`  node scripts/my-code-x-launcher.mjs start [--expose=lan|tailscale|cloudflare]\n`);
  process.stdout.write(`  node scripts/my-code-x-launcher.mjs stop [--all]\n`);
  process.stdout.write(`  node scripts/my-code-x-launcher.mjs status [--json]\n`);
  process.stdout.write(`  node scripts/my-code-x-launcher.mjs restart\n`);
  process.stdout.write(`  node scripts/my-code-x-launcher.mjs logs [--json]\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(launcherScriptPath)) {
  try {
    loadMyCodeXUserEnv({
      installRoot: repoRoot,
      userDir: process.env.MY_CODE_X_USER_DIR || '',
    });
    applyEnvFileToEnv({
      filePath: path.join(repoRoot, '.env'),
    });
    const args = parseCliArgs(process.argv.slice(2));

    if (args.help) {
      printHelp();
    } else if (args.action === 'start') {
      await handleStart(args);
    } else if (args.action === 'stop') {
      await handleStop(args);
    } else if (args.action === 'status') {
      await handleStatus(args);
    } else if (args.action === 'restart') {
      await handleRestart();
    } else if (args.action === 'logs') {
      await handleLogs(args);
    } else {
      printHelp();
    }
  } catch (error) {
    printCliError(error);
    process.exitCode = 1;
  }
}

export { collectLanIpv4Addresses, parseCliArgs, resolveExposureSelection, resolveSpawnInvocation };
