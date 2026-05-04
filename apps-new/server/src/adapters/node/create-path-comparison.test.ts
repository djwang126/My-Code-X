import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createNodePathComparison } from './create-path-comparison.js';

describe('node path comparison', () => {
  test('compares paths case-insensitively on win32', () => {
    const comparison = createNodePathComparison({ platform: 'win32' });

    assert.equal(comparison.samePath({
      left: 'D:\\Workspaces\\Demo',
      right: 'd:\\workspaces\\demo',
    }), true);
    assert.equal(comparison.samePath({
      left: '\\\\Server\\Share\\Repo',
      right: '\\\\server\\share\\repo',
    }), true);
  });

  test('compares paths case-sensitively on linux', () => {
    const comparison = createNodePathComparison({ platform: 'linux' });

    assert.equal(comparison.samePath({
      left: '/workspaces/Demo',
      right: '/workspaces/demo',
    }), false);
    assert.equal(comparison.samePath({
      left: '/workspaces/demo',
      right: '/workspaces/demo',
    }), true);
  });

  test('compares paths case-sensitively on darwin', () => {
    const comparison = createNodePathComparison({ platform: 'darwin' });

    assert.equal(comparison.samePath({
      left: '/Users/david/Repo',
      right: '/Users/david/repo',
    }), false);
  });
});
