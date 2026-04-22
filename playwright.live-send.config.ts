import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from '@playwright/test';

const noProxyHosts = '127.0.0.1,localhost';
const runRealCodexLive = process.env.RUN_REAL_CODEX_LIVE === '1';
const liveCodexHome = String(process.env.PLAYWRIGHT_LIVE_CODEX_HOME || '').trim();

if (runRealCodexLive && !liveCodexHome) {
  throw new Error('Set PLAYWRIGHT_LIVE_CODEX_HOME to an isolated Codex home before running the real live-send Playwright test.');
}

if (liveCodexHome) {
  fs.mkdirSync(liveCodexHome, { recursive: true });
}

function appendNoProxyHosts(value: string | undefined, hosts: string) {
  const mergedHosts = new Set(
    `${value || ''},${hosts}`
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  );

  return Array.from(mergedHosts).join(',');
}

const mergedNoProxy = appendNoProxyHosts(process.env.NO_PROXY ?? process.env.no_proxy, noProxyHosts);
process.env.NO_PROXY = mergedNoProxy;
process.env.no_proxy = mergedNoProxy;

export default defineConfig({
  testDir: './playwright',
  testMatch: /real-live-send\.spec\.ts/,
  use: {
    baseURL: 'http://127.0.0.1:4412',
    trace: 'on-first-retry',
  },
  webServer: runRealCodexLive
    ? {
        command: 'node scripts/playwright-web-server.mjs',
        url: 'http://127.0.0.1:4412/api/health',
        reuseExistingServer: false,
        env: {
          HOST: '127.0.0.1',
          PORT: '4412',
          MY_CODE_X_AUTH_TOKEN: '',
          MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: process.env.MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES || '0.03',
          CODEX_HOME: liveCodexHome,
        },
      }
    : undefined,
});
