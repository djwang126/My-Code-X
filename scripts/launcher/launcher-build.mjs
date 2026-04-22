import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { repoRoot } from '../my-code-x-runtime-paths.mjs';
import { ensureFileParent } from '../my-code-x-runtime-state.mjs';
import { runCommand } from './launcher-process.mjs';

const commonRootSources = ['package.json', 'package-lock.json'].map(filePath => path.join(repoRoot, filePath));

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function getLatestSourceTimestamp(targetPath) {
  let stat;
  try {
    stat = await fsp.stat(targetPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return 0;
    }

    throw error;
  }

  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let latest = stat.mtimeMs;
  const entries = await fsp.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    latest = Math.max(latest, await getLatestSourceTimestamp(path.join(targetPath, entry.name)));
  }

  return latest;
}

async function getOldestOutputTimestamp(outputPaths) {
  let oldestTimestamp = Number.POSITIVE_INFINITY;

  for (const outputPath of outputPaths) {
    let stat;
    try {
      stat = await fsp.stat(outputPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }

    oldestTimestamp = Math.min(oldestTimestamp, stat.mtimeMs);
  }

  return Number.isFinite(oldestTimestamp) ? oldestTimestamp : null;
}

async function touchBuildStamp(stampPath) {
  await ensureFileParent(stampPath);
  await fsp.writeFile(stampPath, `${new Date().toISOString()}\n`, 'utf8');
}

async function ensureWorkspaceBuild({ label, workspace, outputPaths, sourcePaths, stampPath }) {
  let latestSourceTimestamp = 0;
  for (const sourcePath of sourcePaths) {
    latestSourceTimestamp = Math.max(latestSourceTimestamp, await getLatestSourceTimestamp(sourcePath));
  }

  const oldestOutputTimestamp = await getOldestOutputTimestamp(outputPaths);
  if (oldestOutputTimestamp !== null && oldestOutputTimestamp >= latestSourceTimestamp) {
    process.stdout.write(`${label} build is up to date; skipping build.\n`);
    await touchBuildStamp(stampPath);
    return;
  }

  process.stdout.write(`Building ${workspace} before launch...\n`);
  await runCommand(getNpmCommand(), ['run', 'build', '--workspace', workspace]);
  await touchBuildStamp(stampPath);
}

function buildWorkspaceSpecs(buildStamps) {
  const sharedSources = [
    path.join(repoRoot, 'packages', 'contracts', 'src'),
    path.join(repoRoot, 'packages', 'contracts', 'package.json'),
    path.join(repoRoot, 'packages', 'contracts', 'tsconfig.json'),
    path.join(repoRoot, 'packages', 'utils', 'src'),
    path.join(repoRoot, 'packages', 'utils', 'package.json'),
    path.join(repoRoot, 'packages', 'utils', 'tsconfig.json'),
    ...commonRootSources,
  ];

  return [
    {
      label: 'Contracts',
      workspace: '@my-code-x/contracts',
      outputPaths: [path.join(repoRoot, 'packages', 'contracts', 'dist', 'index.js')],
      sourcePaths: [
        path.join(repoRoot, 'packages', 'contracts', 'src'),
        path.join(repoRoot, 'packages', 'contracts', 'package.json'),
        path.join(repoRoot, 'packages', 'contracts', 'tsconfig.json'),
        ...commonRootSources,
      ],
      stampPath: buildStamps.contracts,
    },
    {
      label: 'Utils',
      workspace: '@my-code-x/utils',
      outputPaths: [path.join(repoRoot, 'packages', 'utils', 'dist', 'my-code-x-user-env.js')],
      sourcePaths: [
        path.join(repoRoot, 'packages', 'utils', 'src'),
        path.join(repoRoot, 'packages', 'utils', 'package.json'),
        path.join(repoRoot, 'packages', 'utils', 'tsconfig.json'),
        ...commonRootSources,
      ],
      stampPath: buildStamps.utils,
    },
    {
      label: 'Frontend',
      workspace: 'apps/web',
      outputPaths: [path.join(repoRoot, 'apps', 'web', 'dist', 'index.html')],
      sourcePaths: [
        path.join(repoRoot, 'apps', 'web', 'src'),
        path.join(repoRoot, 'apps', 'web', 'index.html'),
        path.join(repoRoot, 'apps', 'web', 'package.json'),
        path.join(repoRoot, 'apps', 'web', 'tsconfig.json'),
        path.join(repoRoot, 'apps', 'web', 'tsconfig.app.json'),
        path.join(repoRoot, 'apps', 'web', 'vite.config.ts'),
        ...sharedSources,
      ],
      stampPath: buildStamps.frontend,
    },
    {
      label: 'Backend',
      workspace: 'apps/server',
      outputPaths: [path.join(repoRoot, 'apps', 'server', 'dist', 'app', 'index.js')],
      sourcePaths: [
        path.join(repoRoot, 'apps', 'server', 'src'),
        path.join(repoRoot, 'apps', 'server', 'package.json'),
        path.join(repoRoot, 'apps', 'server', 'tsconfig.json'),
        path.join(repoRoot, 'apps', 'server', 'tsconfig.build.json'),
        ...sharedSources,
      ],
      stampPath: buildStamps.backend,
    },
  ];
}

export async function ensureLaunchBuilds(buildStamps) {
  const workspaceSpecs = buildWorkspaceSpecs(buildStamps);
  for (const workspaceSpec of workspaceSpecs) {
    await ensureWorkspaceBuild(workspaceSpec);
  }
}
