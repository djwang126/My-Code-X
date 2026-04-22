import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { parseArgs } from './screenshot/screenshot-mobile-cli.mjs';
import { prepareServerForScreenshot, stopServer } from './screenshot/screenshot-mobile-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultOutputPath = path.join(repoRoot, 'output', 'playwright', 'mobile-screenshot.png');
const defaultCodexHome = path.join(repoRoot, 'playwright', '.tmp', 'screenshot-codex-home');

async function takeScreenshot(options) {
  const { ensureOutputDirectory, pageUrl, serverChild } = await prepareServerForScreenshot(options, {
    defaultCodexHome,
    repoRoot,
  });

  const browser = await chromium.launch({ headless: !options.headed });

  try {
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: options.scale,
      isMobile: true,
      hasTouch: true,
    });

    if (options.sessionStorageEntries.length || options.localStorageEntries.length) {
      await context.addInitScript(
        ({ sessionStorageEntries, localStorageEntries }) => {
          for (const entry of sessionStorageEntries) {
            globalThis.sessionStorage.setItem(entry.key, entry.value);
          }

          for (const entry of localStorageEntries) {
            globalThis.localStorage.setItem(entry.key, entry.value);
          }
        },
        {
          sessionStorageEntries: options.sessionStorageEntries,
          localStorageEntries: options.localStorageEntries,
        },
      );
    }

    const page = await context.newPage();

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    await page.locator('.app-shell').first().waitFor({ state: 'visible', timeout: options.timeoutMs });

    for (const label of options.clickLabels) {
      await page.getByLabel(label, { exact: true }).click({ timeout: options.timeoutMs });
      await page.waitForTimeout(options.settleMs);
    }

    for (const selector of options.clickSelectors) {
      await page.locator(selector).first().click({ timeout: options.timeoutMs });
      await page.waitForTimeout(options.settleMs);
    }

    for (const selector of options.waitFor) {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout: options.timeoutMs });
    }

    await page.waitForTimeout(options.settleMs);
    await ensureOutputDirectory(options.output);

    if (options.captureSelector) {
      await page.locator(options.captureSelector).first().screenshot({ path: options.output });
    } else {
      await page.screenshot({
        path: options.output,
        fullPage: options.fullPage,
      });
    }

    await context.close();
  } finally {
    await browser.close();
    await stopServer(serverChild);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2), { repoRoot, defaultOutputPath });
  await takeScreenshot(options);
  process.stdout.write(`Saved screenshot to ${options.output}\n`);
}

await main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
