import test from 'node:test';
import assert from 'node:assert/strict';

import { configureTailscaleServe } from './tailscale-serve.mjs';

test('configureTailscaleServe keeps serve setup interactive for first-run prompts', async () => {
  const calls = [];
  const runTailscaleCommand = async (args, options = {}) => {
    calls.push({ args, options });

    if (args[0] === 'status' && args[1] === '--json') {
      return {
        stdout: JSON.stringify({
          Self: {
            DNSName: 'my-code-x.test-tailnet.ts.net.',
            TailscaleIPs: ['100.64.0.10'],
          },
        }),
      };
    }

    if (args[0] === 'serve') {
      return { stdout: '', stderr: '' };
    }

    throw new Error(`Unexpected tailscale command: ${args.join(' ')}`);
  };

  const result = await configureTailscaleServe(4310, runTailscaleCommand);

  assert.equal(result.url, 'https://my-code-x.test-tailnet.ts.net/');
  assert.deepEqual(calls[1], {
    args: ['serve', '--bg', '--https=443', 'http://127.0.0.1:4310'],
    options: { stdio: 'inherit' },
  });
});
