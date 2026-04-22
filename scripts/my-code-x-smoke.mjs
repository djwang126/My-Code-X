import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildBackendRuntime, resolveBackendDistEntry } from './shared/backend-runtime.mjs';
import { resolveSpawnInvocation } from './shared/spawn-invocation.mjs';
import { verifySessionBootstrapProbe, waitForHealthyServer } from './shared/smoke-probes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const [action = 'run', firstArg = '', secondArg = ''] = argv;
  return {
    action,
    port: Number.parseInt(firstArg || '', 10) || null,
    authToken: secondArg,
  };
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getPowerShellCommand() {
  return process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;

      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error('Failed to allocate an available smoke port.'));
          return;
        }

        resolve(port);
      });
    });
  });
}

function getSmokePaths(port) {
  return {
    outLog: path.join(repoRoot, `.tmp_smoke_${port}.out.log`),
    errLog: path.join(repoRoot, `.tmp_smoke_${port}.err.log`),
    pidFile: path.join(repoRoot, `.tmp_smoke_${port}.pid`),
  };
}

async function readTextIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function removeIfExists(filePath) {
  await fsp.rm(filePath, { force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}

async function readPidFile(pidFilePath) {
  const text = (await readTextIfExists(pidFilePath)).trim();
  if (!text) {
    return null;
  }

  const pid = Number.parseInt(text, 10);
  return Number.isFinite(pid) ? pid : null;
}

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await sleep(250);
  }
  return !isProcessRunning(pid);
}

async function runCommand(command, args, options = {}) {
  const { cwd = repoRoot, env = process.env, captureOutput = false } = options;

  return await new Promise((resolve, reject) => {
    const invocation = resolveSpawnInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr?.on('data', chunk => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          captureOutput && (stderr || stdout)
            ? (stderr || stdout).trim()
            : `${command} exited with code ${code}`,
        ),
      );
    });
  });
}

async function startDetachedProcess({ port, authToken, smokePaths }) {
  const stdoutFd = fs.openSync(smokePaths.outLog, 'a');
  const stderrFd = fs.openSync(smokePaths.errLog, 'a');
  const backendEntry = resolveBackendDistEntry(repoRoot);

  try {
    const child = spawn(process.execPath, [backendEntry], {
      cwd: repoRoot,
      detached: true,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        MY_CODE_X_AUTH_TOKEN: authToken,
      },
      stdio: ['ignore', stdoutFd, stderrFd],
    });

    child.unref();
    await fsp.writeFile(smokePaths.pidFile, `${child.pid}\n`, 'utf8');
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

async function stopSmokeProcess(port) {
  const smokePaths = getSmokePaths(port);
  const pid = await readPidFile(smokePaths.pidFile);
  if (pid && isProcessRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore
    }

    const exited = await waitForProcessExit(pid, 5_000);
    if (!exited && isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
      await waitForProcessExit(pid, 5_000);
    }
  }

  if (process.platform === 'win32') {
    const psCommand = [
      `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue;`,
      `if ($connections) {`,
      `  $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {`,
      `    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue`,
      `  }`,
      `}`,
    ].join(' ');

    await runCommand(getPowerShellCommand(), ['-NoProfile', '-Command', psCommand]).catch(() => {});
  }

  await Promise.all([
    removeIfExists(smokePaths.pidFile),
    removeIfExists(smokePaths.outLog),
    removeIfExists(smokePaths.errLog),
  ]);
}

async function verifyFrontendServing(port) {
  const shellResponse = await fetch(`http://127.0.0.1:${port}/`);
  if (!shellResponse.ok) {
    throw new Error(`Smoke shell check failed with status ${shellResponse.status}.`);
  }

  const html = await shellResponse.text();
  if (!html.includes('<div id="root"></div>')) {
    throw new Error('Smoke shell check failed: missing root mount.');
  }

  if (!/My Code X/i.test(html)) {
    throw new Error('Smoke shell check failed: missing app title.');
  }

  const match = html.match(/\/assets\/([^"'`\s>]+)/);
  if (!match) {
    throw new Error('Smoke shell check failed: missing built asset reference.');
  }

  const assetResponse = await fetch(`http://127.0.0.1:${port}/assets/${match[1]}`);
  if (!assetResponse.ok) {
    throw new Error(`Smoke asset check failed with status ${assetResponse.status}.`);
  }

  const contentType = String(assetResponse.headers.get('content-type') || '');
  if (!/javascript|ecmascript|css/i.test(contentType)) {
    throw new Error(`Smoke asset check failed: bad content type ${contentType}.`);
  }
}

async function runSmokeChecks({ port, authToken, smokePaths }) {
  await stopSmokeProcess(port);
  await buildBackendRuntime({ runCommand, npmCommand: getNpmCommand() });
  await runCommand(getNpmCommand(), ['run', 'build', '--workspace', 'apps/web']);
  await startDetachedProcess({ port, authToken, smokePaths });
  await waitForHealthyServer({ port, authToken });
  await verifySessionBootstrapProbe({ port, authToken });
  await verifyFrontendServing(port);
}

async function printFailureLogs(smokePaths) {
  process.stdout.write('Smoke check failed. Recent logs:\n');
  process.stdout.write(await readTextIfExists(smokePaths.outLog));
  process.stdout.write(await readTextIfExists(smokePaths.errLog));
}

async function handleRun({ port, authToken }) {
  const smokePaths = getSmokePaths(port);

  try {
    await runSmokeChecks({ port, authToken, smokePaths });
  } catch (error) {
    await printFailureLogs(smokePaths);
    throw error;
  }

  process.stdout.write('\nSmoke test passed.\n');
  process.stdout.write(`URL  : http://127.0.0.1:${port}/\n`);
  process.stdout.write(`Token: ${authToken}\n`);
  process.stdout.write(`PID  : ${smokePaths.pidFile}\n`);
  process.stdout.write(`Logs : ${smokePaths.outLog}\n`);
  process.stdout.write(`       ${smokePaths.errLog}\n`);
}

async function handleCheck({ port, authToken }) {
  const smokePaths = getSmokePaths(port);

  try {
    await runSmokeChecks({ port, authToken, smokePaths });
    process.stdout.write(`Smoke test passed on http://127.0.0.1:${port}/ and cleaned up.\n`);
  } catch (error) {
    await printFailureLogs(smokePaths);
    throw error;
  } finally {
    await stopSmokeProcess(port);
  }
}

async function handleClear({ port }) {
  await stopSmokeProcess(port);
  process.stdout.write(`Cleared smoke artifacts for port ${port}.\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = args.port ?? (args.action === 'check' ? await findAvailablePort() : 3211);

  if (args.action === 'clear') {
    await handleClear({ ...args, port });
    return;
  }

  if (args.action === 'check') {
    await handleCheck({ ...args, port });
    return;
  }

  await handleRun({ ...args, port });
}

await main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
