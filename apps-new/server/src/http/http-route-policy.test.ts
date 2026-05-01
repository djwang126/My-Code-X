import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { classifyHttpRoute, isHttpApplicationRoute } from './http-route-policy.js';

describe('http route policy', () => {
  test('classifies application routes in one place', () => {
    assert.equal(classifyHttpRoute({ path: '/client' }), 'client');
    assert.equal(classifyHttpRoute({ path: '/health' }), 'health');
    assert.equal(isHttpApplicationRoute({ path: '/client' }), true);
    assert.equal(isHttpApplicationRoute({ path: '/health' }), true);
  });

  test('classifies app shell and assets as static routes', () => {
    assert.equal(classifyHttpRoute({ path: '/' }), 'static');
    assert.equal(classifyHttpRoute({ path: '/assets/index.js' }), 'static');
    assert.equal(classifyHttpRoute({ path: '/threads/thread-1' }), 'static');
    assert.equal(isHttpApplicationRoute({ path: '/assets/index.js' }), false);
  });
});
