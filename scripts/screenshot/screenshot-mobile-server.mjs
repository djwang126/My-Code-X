import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import { resolveSpawnInvocation } from '../shared/spawn-invocation.mjs';
import { buildPageUrl, getHealthUrl } from './screenshot-mobile-cli.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function isServerHealthy(baseUrl) {
  try {
    const response = await fetch(getHealthUrl(baseUrl));
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.ok === true;
  } catch {
    return false;
  }
}

export async function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerHealthy(baseUrl)) {
      return;
    }
    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${getHealthUrl(baseUrl)}.`);
}

export function spawnServer(baseUrl, { repoRoot, defaultCodexHome }) {
  const url = new URL(baseUrl);
  const port = url.port || '80';
  const host = url.hostname;
  const invocation = resolveSpawnInvocation(process.execPath, [path.join(repoRoot, 'scripts', 'playwright-web-server.mjs')]);
  return spawn(invocation.command, invocation.args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      MY_CODE_X_AUTH_TOKEN: '',
      CODEX_HOME: defaultCodexHome,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
}

export async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore shutdown races
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    await sleep(100);
  }

  try {
    child.kill('SIGKILL');
  } catch {
    // ignore shutdown races
  }

  await once(child, 'exit').catch(() => {});
}

async function ensureOutputDirectory(outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
}

export async function prepareServerForScreenshot(options, { defaultCodexHome, repoRoot }) {
  let serverChild = null;
  if (!(await isServerHealthy(options.url))) {
    await fs.mkdir(defaultCodexHome, { recursive: true });
    serverChild = spawnServer(options.url, { repoRoot, defaultCodexHome });
    await waitForServer(options.url, 60_000);
  }

  return {
    pageUrl: buildPageUrl(options.url, options.path),
    serverChild,
    ensureOutputDirectory,
  };
}
