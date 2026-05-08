import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
const configModuleUrl = pathToFileURL(path.join(__dirname, 'config.ts')).href;

function probeConfig(envOverrides = {}) {
  const script = `
    const config = await import(${JSON.stringify(configModuleUrl)});
    process.stdout.write(JSON.stringify({
      myCodeXUserDir: config.myCodeXUserDir,
      myCodeXCustomHarnessDir: config.myCodeXCustomHarnessDir,
      codexWorkingDir: config.codexWorkingDir,
    }));
  `;
  const result = spawnSync(process.execPath, ['--import', tsxLoaderPath, '--input-type=module', '--eval', script], {
    env: {
      ...process.env,
      ...envOverrides,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('config defaults the My-Code-X user dir and Codex working dir to ~/.My-Code-X', () => {
  const config = probeConfig({
    CODEX_WORKING_DIR: '',
    MY_CODE_X_USER_DIR: '',
  });
  const expectedUserDir = path.join(os.homedir(), '.My-Code-X');
  const expectedCustomHarnessDir = path.join(expectedUserDir, 'custom-harness');

  assert.equal(config.myCodeXUserDir, expectedUserDir);
  assert.equal(config.myCodeXCustomHarnessDir, expectedCustomHarnessDir);
  assert.equal(config.codexWorkingDir, expectedUserDir);
});

test('config keeps an explicit CODEX_WORKING_DIR override', () => {
  const customUserDir = path.join(os.tmpdir(), 'my-code-x-config-user-dir');
  const explicitWorkspace = path.join(os.tmpdir(), 'my-code-x-explicit-workspace');
  const config = probeConfig({
    MY_CODE_X_USER_DIR: customUserDir,
    CODEX_WORKING_DIR: explicitWorkspace,
  });

  assert.equal(config.myCodeXUserDir, customUserDir);
  assert.equal(config.myCodeXCustomHarnessDir, path.join(customUserDir, 'custom-harness'));
  assert.equal(config.codexWorkingDir, explicitWorkspace);
});
