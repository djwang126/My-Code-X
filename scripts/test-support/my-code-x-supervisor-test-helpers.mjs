import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
export const supervisorScriptPath = path.join(repoRoot, 'scripts', 'my-code-x-supervisor.mjs');
export const fakeBackendScriptPath = path.join(repoRoot, 'scripts', 'test-support', 'fake-managed-backend.mjs');
export const fakeProviderScriptPath = path.join(repoRoot, 'scripts', 'test-support', 'fake-cloudflare-provider.mjs');
export const fakeTailscaleScriptPath = path.join(repoRoot, 'scripts', 'test-support', 'fake-tailscale-cli.mjs');
export const launcherScriptPath = path.join(repoRoot, 'scripts', 'my-code-x-launcher.mjs');

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getFreePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function waitFor(check, { timeoutMs = 20_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await check();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

export async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

export async function runSupervisorCli(args, env, { timeoutMs = 20_000 } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [supervisorScriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `supervisor exited with code ${code}`));
    });

    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`supervisor cli timed out after ${timeoutMs}ms`));
    }, timeoutMs).unref();
  });
}

export async function runSupervisorLanCli(args, env, options) {
  const nextArgs = [...args];
  const shouldInjectExpose =
    nextArgs[0] === 'start' || nextArgs[0] === 'restart';

  if (shouldInjectExpose && !nextArgs.some(arg => typeof arg === 'string' && arg.startsWith('--expose='))) {
    nextArgs.push('--expose=lan');
  }

  return await runSupervisorCli(nextArgs, env, options);
}

export async function runSupervisorCliJson(args, env, options) {
  const result = await runSupervisorCli(args, env, options);
  const lines = result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const jsonLine = [...lines].reverse().find(line => line.startsWith('{') || line.startsWith('['));
  return {
    ...result,
    json: jsonLine ? JSON.parse(jsonLine) : null,
  };
}

export async function readStateOrThrow(stateFilePath) {
  const state = await readJsonIfExists(stateFilePath);
  if (!state) {
    throw new Error(`missing supervisor state at ${stateFilePath}`);
  }
  return state;
}

export async function requestSupervisorControl(state, pathname, { method = 'POST' } = {}) {
  if (!state?.control?.port || !state?.control?.token) {
    throw new Error('supervisor control channel unavailable');
  }

  const response = await fetch(`http://127.0.0.1:${state.control.port}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-My-Code-X-Control-Token': state.control.token,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `control request failed with status ${response.status}`);
  }

  return text.trim() ? JSON.parse(text) : {};
}

export async function stopSupervisorFromStateFile(stateFilePath, options) {
  const state = await readStateOrThrow(stateFilePath);
  await requestSupervisorControl(state, '/stop', options);
  return await waitFor(
    () => readJsonIfExists(stateFilePath).then(next => next?.status === 'stopped' ? next : null),
    { timeoutMs: 12_000, intervalMs: 50 },
  );
}

export function spawnNodeProcess(scriptPath, env) {
  return spawn(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
