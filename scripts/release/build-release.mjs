import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { resolveSpawnInvocation } from '../shared/spawn-invocation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const portableEntryScriptPaths = [
  path.join('bin', 'start-my-code-x.cmd'),
  path.join('bin', 'start-my-code-x.sh'),
  path.join('bin', 'stop-my-code-x.cmd'),
  path.join('bin', 'stop-my-code-x.sh'),
];

const releaseCopySpecs = [
  'apps/server/package.json',
  'apps/server/dist',
  'apps/web/package.json',
  'apps/web/dist',
  'custom-harness',
  'packages/contracts/package.json',
  'packages/contracts/dist',
  'packages/contracts/codex-app-server-schema',
  'packages/utils/package.json',
  'packages/utils/dist',
  'scripts/launcher',
  'scripts/supervisor',
  'scripts/tailscale',
  'scripts/tailscale-serve.mjs',
  'scripts/my-code-x-exposure.mjs',
  'scripts/my-code-x-launcher.mjs',
  'scripts/my-code-x-managed-process.mjs',
  'scripts/my-code-x-process-tree.mjs',
  'scripts/my-code-x-retry.mjs',
  'scripts/my-code-x-runtime-paths.mjs',
  'scripts/my-code-x-runtime-state.mjs',
  'scripts/my-code-x-supervisor-config.mjs',
  'scripts/my-code-x-supervisor-health.mjs',
  'scripts/my-code-x-supervisor.mjs',
  'scripts/my-code-x-tailscale-owner.mjs',
  'scripts/shared/cli-error-output.mjs',
  'scripts/shared/spawn-invocation.mjs',
  '.env.example',
  'LICENSE',
  'README.md',
  'package.json',
  'package-lock.json',
];

function parseReleaseArgs(argv) {
  const parsed = {
    outputDir: path.join(repoRoot, 'output', 'release'),
    buildFrontend: true,
    installProdDependencies: true,
    archive: true,
  };

  for (const arg of argv) {
    if (arg === '--skip-build') {
      parsed.buildFrontend = false;
      continue;
    }

    if (arg === '--skip-install') {
      parsed.installProdDependencies = false;
      continue;
    }

    if (arg === '--no-archive') {
      parsed.archive = false;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      parsed.outputDir = path.resolve(repoRoot, arg.slice('--output-dir='.length));
    }
  }

  return parsed;
}

function normalizePlatform(platform = process.platform) {
  if (platform === 'win32') {
    return 'windows';
  }

  if (platform === 'darwin') {
    return 'macos';
  }

  return platform;
}

function buildReleaseMetadata({ version, platform = process.platform, arch = process.arch }) {
  const platformLabel = normalizePlatform(platform);
  const releaseName = `my-code-x-${platformLabel}-${arch}`;
  const archiveExtension = platform === 'win32' ? '.zip' : '.tar.gz';

  return {
    version,
    platform,
    platformLabel,
    arch,
    releaseName,
    archiveFileName: `${releaseName}${archiveExtension}`,
  };
}

async function runCommand({ command, args, cwd, env = process.env }) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
  });
}

async function runNpmCommand(args, cwd) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const invocation = resolveSpawnInvocation(npmCommand, args);
  await runCommand({
    command: invocation.command,
    args: invocation.args,
    cwd,
  });
}

async function copyReleaseFiles(releaseRoot) {
  for (const relativeSource of releaseCopySpecs) {
    const sourcePath = path.join(repoRoot, relativeSource);
    const targetPath = path.join(releaseRoot, relativeSource);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true });
  }

  for (const relativeSource of portableEntryScriptPaths) {
    const sourcePath = path.join(repoRoot, relativeSource);
    const targetPath = path.join(releaseRoot, path.basename(relativeSource));
    await fs.copyFile(sourcePath, targetPath);
  }
}

async function ensureFrontendDist() {
  const frontendDistDir = path.join(repoRoot, 'apps', 'web', 'dist');
  await fs.access(frontendDistDir);
}

function buildNodeRuntimeTarget(platform = process.platform) {
  return platform === 'win32' ? path.join('node', 'node.exe') : path.join('node', 'bin', 'node');
}

async function copyNodeRuntime(releaseRoot) {
  const relativeTarget = buildNodeRuntimeTarget();
  const targetPath = path.join(releaseRoot, relativeTarget);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(process.execPath, targetPath);

  if (process.platform !== 'win32') {
    await fs.chmod(targetPath, 0o755);
  }

  return relativeTarget;
}

async function writeReleaseManifest({ metadata, releaseRoot, nodeRuntimePath }) {
  const manifest = {
    name: metadata.releaseName,
    version: metadata.version,
    platform: metadata.platformLabel,
    arch: metadata.arch,
    nodeRuntimePath,
    builtAt: new Date().toISOString(),
    userDir: '~/.My-Code-X',
    runtimeDir: '~/.My-Code-X/runtime',
    defaultCodexWorkingDir: '~/.My-Code-X',
  };

  await fs.writeFile(
    path.join(releaseRoot, 'release-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function createArchive({ outputDir, releaseName, archiveFileName }) {
  const archivePath = path.join(outputDir, archiveFileName);
  await fs.rm(archivePath, { force: true });

  if (process.platform === 'win32') {
    await runCommand({
      command: 'powershell',
      args: [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${path.join(outputDir, releaseName)}' -DestinationPath '${archivePath}' -Force`,
      ],
      cwd: outputDir,
    });
    return archivePath;
  }

  await runCommand({
    command: 'tar',
    args: ['-czf', archivePath, '-C', outputDir, releaseName],
    cwd: outputDir,
  });
  return archivePath;
}

async function buildRelease(options) {
  const rootPackageJson = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const metadata = buildReleaseMetadata({ version: rootPackageJson.version });
  const releaseRoot = path.join(options.outputDir, metadata.releaseName);

  await fs.mkdir(options.outputDir, { recursive: true });
  await fs.rm(releaseRoot, { recursive: true, force: true });

  if (options.buildFrontend) {
    await runNpmCommand(['run', 'build:shared'], repoRoot);
    await runNpmCommand(['run', 'build', '--workspace', 'apps/web'], repoRoot);
    await runNpmCommand(['run', 'build', '--workspace', 'apps/server'], repoRoot);
  } else {
    await ensureFrontendDist();
  }

  await copyReleaseFiles(releaseRoot);

  if (options.installProdDependencies) {
    await runNpmCommand(
      ['ci', '--omit=dev', '--workspace', 'apps/server', '--include-workspace-root=false'],
      releaseRoot,
    );
  }

  const nodeRuntimePath = await copyNodeRuntime(releaseRoot);
  await writeReleaseManifest({ metadata, releaseRoot, nodeRuntimePath });

  const archivePath = options.archive
    ? await createArchive({
        outputDir: options.outputDir,
        releaseName: metadata.releaseName,
        archiveFileName: metadata.archiveFileName,
      })
    : '';

  return {
    ...metadata,
    releaseRoot,
    archivePath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseReleaseArgs(process.argv.slice(2));
    const result = await buildRelease(options);
    process.stdout.write(`release dir: ${result.releaseRoot}\n`);
    if (result.archivePath) {
      process.stdout.write(`archive: ${result.archivePath}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

export {
  buildNodeRuntimeTarget,
  buildRelease,
  buildReleaseMetadata,
  normalizePlatform,
  parseReleaseArgs,
  portableEntryScriptPaths,
  releaseCopySpecs,
};
