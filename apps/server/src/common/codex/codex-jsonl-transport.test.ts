import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { startCodexJsonlTransport } from './codex-jsonl-transport.js';

type MutableChildProcess = ChildProcess & {
  exitCode: number | null;
  signalCode: string | null;
};

function createFakeChildProcess() {
  const child = new EventEmitter() as MutableChildProcess;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.emit('close', 0, null);
    return true;
  };
  return child;
}

test('startCodexJsonlTransport hides the Windows child console window', async () => {
  const child = createFakeChildProcess();
  const calls = [];

  const transport = await startCodexJsonlTransport({
    command: 'codex',
    args: ['app-server'],
    cwd: 'C:/workspaces/My-Code-X',
    env: { CODEX_ENV: '1' },
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      return child;
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'codex');
  assert.deepEqual(calls[0].args, ['app-server']);
  assert.equal(calls[0].options.windowsHide, true);

  await transport.close();
});
