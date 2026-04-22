import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadMyCodeXUserEnv } from '@my-code-x/utils/my-code-x-user-env';
import { applyEnvFileToEnv } from '@my-code-x/utils/env-file';
import { parseCliArgs } from './my-code-x-supervisor-config.mjs';
import { buildRuntimePaths, repoRoot, resolveRuntimeDir } from './my-code-x-runtime-paths.mjs';
import {
  handleLogs,
  handleRestart,
  handleStart,
  handleStatus,
  handleStop,
  printHelp,
} from './supervisor/supervisor-cli-actions.mjs';
import { runSupervisor } from './supervisor/supervisor-runtime.mjs';
import { printCliError } from './shared/cli-error-output.mjs';

const supervisorScriptPath = fileURLToPath(import.meta.url);
const launcherScriptPath = path.join(repoRoot, 'scripts', 'my-code-x-launcher.mjs');

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(supervisorScriptPath)) {
  try {
    loadMyCodeXUserEnv({
      installRoot: repoRoot,
      userDir: process.env.MY_CODE_X_USER_DIR || '',
    });
    applyEnvFileToEnv({
      filePath: path.join(repoRoot, '.env'),
    });
    const parsed = parseCliArgs(process.argv.slice(2));
    const runtimeDir = resolveRuntimeDir();
    const paths = buildRuntimePaths(runtimeDir);

    if (parsed.help) {
      printHelp();
    } else if (parsed.action === 'start') {
      await handleStart({ parsed, paths, supervisorScriptPath });
    } else if (parsed.action === 'run') {
      await runSupervisor({ parsed, paths, launcherScriptPath });
    } else if (parsed.action === 'stop') {
      await handleStop(paths);
    } else if (parsed.action === 'status') {
      await handleStatus({ parsed, paths });
    } else if (parsed.action === 'restart') {
      await handleRestart(paths);
    } else if (parsed.action === 'logs') {
      await handleLogs({ parsed, paths });
    } else {
      printHelp();
    }
  } catch (error) {
    printCliError(error);
    process.exitCode = 1;
  }
}
