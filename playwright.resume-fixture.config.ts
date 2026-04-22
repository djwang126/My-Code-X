import path from 'node:path';

import { defineConfig } from '@playwright/test';
import { prepareRealResumeFixture } from './playwright/fixtures/real-resume-fixture';

const noProxyHosts = '127.0.0.1,localhost';
const fixtureCodexHome = path.join(process.cwd(), 'playwright', '.tmp', 'real-resume-codex-home');

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

prepareRealResumeFixture(fixtureCodexHome);

export default defineConfig({
  testDir: './playwright',
  testMatch: /real-rollout-resume\.spec\.ts/,
  use: {
    baseURL: 'http://127.0.0.1:4411',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node scripts/playwright-web-server.mjs',
    url: 'http://127.0.0.1:4411/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      HOST: '127.0.0.1',
      PORT: '4411',
      MY_CODE_X_AUTH_TOKEN: '',
      CODEX_HOME: fixtureCodexHome,
    },
  },
});
