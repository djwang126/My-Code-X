import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from '@playwright/test';

const noProxyHosts = '127.0.0.1,localhost';
const isolatedCodexHome = path.join(process.cwd(), 'playwright', '.tmp', 'default-codex-home');
fs.mkdirSync(isolatedCodexHome, { recursive: true });

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
  testIgnore: /real-(rollout-resume|live-send)\.spec\.ts/,
  use: {
    baseURL: 'http://127.0.0.1:4410',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node scripts/playwright-web-server.mjs',
    url: 'http://127.0.0.1:4410/api/health',
    reuseExistingServer: false,
    env: {
      HOST: '127.0.0.1',
      PORT: '4410',
      MY_CODE_X_AUTH_TOKEN: '',
      CODEX_HOME: isolatedCodexHome,
    },
  },
});
