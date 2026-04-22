import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { parseArgs } from './screenshot-mobile-cli.mjs';

test('parseArgs preserves Windows absolute output paths on any platform', () => {
  const options = parseArgs(['--output', 'D:/captures/mobile.png'], {
    repoRoot: '/home/example/my-code-x',
    defaultOutputPath: '/home/example/my-code-x/output/default.png',
  });

  assert.equal(options.output, 'D:/captures/mobile.png');
});

test('parseArgs resolves relative output paths beneath repoRoot', () => {
  const repoRoot = path.join(path.sep, 'home', 'example', 'my-code-x');
  const options = parseArgs(['--output', 'output/mobile.png'], {
    repoRoot,
    defaultOutputPath: path.join(repoRoot, 'output', 'default.png'),
  });

  assert.equal(options.output, path.join(repoRoot, 'output', 'mobile.png'));
});
