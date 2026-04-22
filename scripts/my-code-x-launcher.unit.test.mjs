import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  collectLanIpv4Addresses,
  extractCloudflareQuickTunnelUrl,
  getBindHost,
  parseCliArgs,
  resolveExposureSelection,
  resolveSpawnInvocation,
} from './my-code-x-launcher.mjs';
import { buildLogExcerpt, buildStartFailureMessage, formatStartSuccess } from './launcher/launcher-output.mjs';
import { buildRuntimePaths, resolveRuntimeDir } from './my-code-x-runtime-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('parseCliArgs understands action and exposure mode', () => {
  assert.deepEqual(parseCliArgs(['stop', '--expose=cloudflare', '--no-build']), {
    action: 'stop',
    expose: 'cloudflare',
    all: false,
    noBuild: true,
    restart: false,
    json: false,
    help: false,
  });
});

test('parseCliArgs understands restart/status helpers', () => {
  assert.deepEqual(parseCliArgs(['status', '--json']), {
    action: 'status',
    expose: '',
    all: false,
    noBuild: false,
    restart: false,
    json: true,
    help: false,
  });
});

test('parseCliArgs understands stop --all', () => {
  assert.deepEqual(parseCliArgs(['stop', '--all']), {
    action: 'stop',
    expose: '',
    all: true,
    noBuild: false,
    restart: false,
    json: false,
    help: false,
  });
});

test('resolveExposureSelection tracks whether exposure mode came from cli, env, or default', () => {
  assert.deepEqual(resolveExposureSelection(parseCliArgs(['start', '--expose=lan'])), {
    mode: 'lan',
    source: 'cli',
  });

  assert.deepEqual(resolveExposureSelection(parseCliArgs(['start']), { MY_CODE_X_EXPOSE_MODE: 'cloudflare' }), {
    mode: 'cloudflare',
    source: 'env',
  });

  assert.deepEqual(resolveExposureSelection(parseCliArgs(['start']), {}), {
    mode: 'tailscale',
    source: 'default',
  });
});

test('getBindHost keeps cloudflare on loopback by default and LAN on all interfaces', () => {
  assert.equal(getBindHost('cloudflare', ''), '127.0.0.1');
  assert.equal(getBindHost('lan', ''), '0.0.0.0');
  assert.equal(getBindHost('tailscale', ''), '127.0.0.1');
  assert.equal(getBindHost('lan', '192.168.1.20'), '192.168.1.20');
});

test('extractCloudflareQuickTunnelUrl reads trycloudflare URLs from logs', () => {
  const logText = 'INF +--------------------------------------------------------------------------------------------+\nINF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |\nINF |  https://example-name.trycloudflare.com                                                    |\nINF +--------------------------------------------------------------------------------------------+';
  assert.equal(extractCloudflareQuickTunnelUrl(logText), 'https://example-name.trycloudflare.com');
});

test('collectLanIpv4Addresses only returns external IPv4 addresses without duplicates', () => {
  const addresses = collectLanIpv4Addresses({
    Ethernet: [
      { address: '192.168.1.8', family: 'IPv4', internal: false },
      { address: '10.10.0.5', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '192.168.1.8', family: 'IPv4', internal: false },
    ],
    Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    Tailscale: [{ address: '100.64.0.2', family: 'IPv4', internal: false }],
    Public: [{ address: '8.8.8.8', family: 'IPv4', internal: false }],
  });

  assert.deepEqual(addresses, ['192.168.1.8', '10.10.0.5']);
});

test('formatStartSuccess prints a concise cross-platform startup summary', () => {
  const message = formatStartSuccess({
    state: {
      localUrl: 'http://127.0.0.1:4310/',
      exposureUrls: ['https://demo.ts.net/'],
    },
    exposeMode: 'tailscale',
    port: 4310,
  });

  assert.equal(
    message,
    'My-Code-X started successfully.\nmode: tailscale\nlocal: http://127.0.0.1:4310/\nremote: https://demo.ts.net/\n',
  );
});

test('buildLogExcerpt keeps the latest non-empty stderr lines', () => {
  const excerpt = buildLogExcerpt('\nfirst line\n\nsecond line\nthird line\n', 2);

  assert.equal(excerpt, 'second line\nthird line');
});

test('buildStartFailureMessage prefers state.lastError and appends stderr excerpts', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-output-'));
  const supervisorErrLog = path.join(runtimeDir, 'supervisor.err.log');
  const backendErrLog = path.join(runtimeDir, 'backend.err.log');

  try {
    await fs.writeFile(supervisorErrLog, 'supervisor line 1\nsupervisor line 2\n', 'utf8');
    await fs.writeFile(backendErrLog, 'backend line 1\nbackend line 2\n', 'utf8');

    const message = await buildStartFailureMessage({
      error: new Error('fallback error'),
      state: {
        lastError: 'backend failed to bind port',
      },
      paths: {
        supervisorErrLog,
        backendErrLog,
      },
    });

    assert.equal(
      message,
      [
        'My-Code-X failed to start.',
        'error: backend failed to bind port',
        '',
        'supervisor stderr:',
        'supervisor line 1\nsupervisor line 2',
        '',
        'backend stderr:',
        'backend line 1\nbackend line 2',
      ].join('\n'),
    );
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('resolveSpawnInvocation wraps Windows cmd/bat launches through cmd.exe', () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });

  try {
    assert.deepEqual(resolveSpawnInvocation('npm.cmd', ['run', 'build', '--workspace', 'apps/web']), {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd run build --workspace apps/web'],
    });
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});

test('resolveRuntimeDir defaults to ~/.My-Code-X/runtime and keeps runtime files under that directory', () => {
  const previousRuntimeDir = process.env.MY_CODE_X_RUNTIME_DIR;
  const previousUserDir = process.env.MY_CODE_X_USER_DIR;
  delete process.env.MY_CODE_X_RUNTIME_DIR;
  delete process.env.MY_CODE_X_USER_DIR;

  try {
    const runtimeDir = resolveRuntimeDir();
    const runtimePaths = buildRuntimePaths(runtimeDir);
    const expectedUserDir = path.join(os.homedir(), '.My-Code-X');
    const expectedRuntimeDir = path.join(expectedUserDir, 'runtime');

    assert.equal(runtimeDir, expectedRuntimeDir);
    assert.equal(runtimePaths.runtimeDir, expectedRuntimeDir);
    assert.equal(runtimePaths.stateFile, path.join(expectedRuntimeDir, 'my-code-x-state.json'));
  } finally {
    if (previousRuntimeDir === undefined) {
      delete process.env.MY_CODE_X_RUNTIME_DIR;
    } else {
      process.env.MY_CODE_X_RUNTIME_DIR = previousRuntimeDir;
    }

    if (previousUserDir === undefined) {
      delete process.env.MY_CODE_X_USER_DIR;
    } else {
      process.env.MY_CODE_X_USER_DIR = previousUserDir;
    }
  }
});

test('resolveRuntimeDir resolves relative runtime overrides beneath MY_CODE_X_USER_DIR', () => {
  const previousRuntimeDir = process.env.MY_CODE_X_RUNTIME_DIR;
  const previousUserDir = process.env.MY_CODE_X_USER_DIR;
  process.env.MY_CODE_X_USER_DIR = path.join(os.tmpdir(), 'my-code-x-launcher-user-dir');
  process.env.MY_CODE_X_RUNTIME_DIR = 'runtime-child';

  try {
    assert.equal(resolveRuntimeDir(), path.join(process.env.MY_CODE_X_USER_DIR, 'runtime-child'));
  } finally {
    if (previousRuntimeDir === undefined) {
      delete process.env.MY_CODE_X_RUNTIME_DIR;
    } else {
      process.env.MY_CODE_X_RUNTIME_DIR = previousRuntimeDir;
    }

    if (previousUserDir === undefined) {
      delete process.env.MY_CODE_X_USER_DIR;
    } else {
      process.env.MY_CODE_X_USER_DIR = previousUserDir;
    }
  }
});

test('resolveRuntimeDir preserves Windows absolute runtime overrides on any platform', () => {
  const previousRuntimeDir = process.env.MY_CODE_X_RUNTIME_DIR;
  const previousUserDir = process.env.MY_CODE_X_USER_DIR;
  process.env.MY_CODE_X_USER_DIR = '/home/example/.My-Code-X';
  process.env.MY_CODE_X_RUNTIME_DIR = 'D:/users/example/.My-Code-X/runtime';

  try {
    assert.equal(resolveRuntimeDir(), 'D:/users/example/.My-Code-X/runtime');
  } finally {
    if (previousRuntimeDir === undefined) {
      delete process.env.MY_CODE_X_RUNTIME_DIR;
    } else {
      process.env.MY_CODE_X_RUNTIME_DIR = previousRuntimeDir;
    }

    if (previousUserDir === undefined) {
      delete process.env.MY_CODE_X_USER_DIR;
    } else {
      process.env.MY_CODE_X_USER_DIR = previousUserDir;
    }
  }
});

test('package remote scripts point at the maintained launcher entrypoint', async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts.start, 'node scripts/my-code-x-launcher.mjs start');
  assert.equal(
    packageJson.scripts['start:remote'],
    'node scripts/my-code-x-launcher.mjs start --expose=tailscale',
  );
  assert.equal(packageJson.scripts['stop:remote'], 'node scripts/my-code-x-launcher.mjs stop');
});

test('portable start and stop scripts invoke the maintained launcher entrypoint', async () => {
  const [startCmd, stopCmd, startSh, stopSh] = await Promise.all([
    fs.readFile(path.join(repoRoot, 'bin', 'start-my-code-x.cmd'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'bin', 'stop-my-code-x.cmd'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'bin', 'start-my-code-x.sh'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'bin', 'stop-my-code-x.sh'), 'utf8'),
  ]);

  assert.match(startCmd, /scripts\\my-code-x-launcher\.mjs" start/);
  assert.match(startCmd, /pause/i);
  assert.match(stopCmd, /scripts\\my-code-x-launcher\.mjs" stop/);
  assert.match(stopCmd, /pause/i);
  assert.match(startSh, /scripts\/my-code-x-launcher\.mjs" start/);
  assert.match(startSh, /Press Enter to close\.\.\./);
  assert.match(startSh, /read -r _/);
  assert.match(stopSh, /scripts\/my-code-x-launcher\.mjs" stop/);
  assert.match(stopSh, /Press Enter to close\.\.\./);
  assert.match(stopSh, /read -r _/);
});
