import test from 'node:test';
import assert from 'node:assert/strict';

import { createCodexGatewayManager } from './codex-gateway-manager.js';

function createFakeClock() {
  let nowMs = 0;
  let nextTimerId = 1;
  const timers = new Map();

  function setTimeoutImpl(callback, delay) {
    const timerId = nextTimerId++;
    timers.set(timerId, {
      callback,
      runAt: nowMs + delay,
    });
    return timerId;
  }

  function clearTimeoutImpl(timerId) {
    timers.delete(timerId);
  }

  function advanceBy(ms) {
    nowMs += ms;
    const readyTimers = Array.from(timers.entries())
      .filter(([, timer]) => timer.runAt <= nowMs)
      .sort((left, right) => left[1].runAt - right[1].runAt);

    for (const [timerId, timer] of readyTimers) {
      timers.delete(timerId);
      timer.callback();
    }
  }

  return {
    now: () => nowMs,
    setTimeoutImpl,
    clearTimeoutImpl,
    advanceBy,
  };
}

function createFakeGateway(name) {
  const calls = [];

  return {
    calls,
    setNotificationHandler() {},
    async startThread(input) {
      calls.push({ method: 'startThread', input });
      return { threadId: `${name}-thread` };
    },
    async startTurn(input) {
      calls.push({ method: 'startTurn', input });
      return { turnId: `${name}-turn` };
    },
    async close() {
      calls.push({ method: 'close' });
    },
    getPreferences() {
      return { gateway: name };
    },
    getOptions() {
      return { models: [] };
    },
  };
}

test('createCodexGatewayManager exposes active-state transitions across idle shutdown and lazy restart', async () => {
  const clock = createFakeClock();
  const gateways = [createFakeGateway('gateway-1'), createFakeGateway('gateway-2')];
  let nextGatewayIndex = 0;

  const manager = createCodexGatewayManager({
    createGateway: async () => gateways[nextGatewayIndex++],
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  assert.equal(manager.hasActiveGateway(), false);

  await manager.initialize();
  assert.equal(manager.hasActiveGateway(), true);

  clock.advanceBy(100);
  assert.equal(manager.hasActiveGateway(), false);

  await manager.startTurn({
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    text: 'continue after idle shutdown',
  });

  assert.equal(manager.hasActiveGateway(), true);
});

test('createCodexGatewayManager increments the gateway generation only when a fresh gateway is created', async () => {
  const clock = createFakeClock();
  const gateways = [createFakeGateway('gateway-1'), createFakeGateway('gateway-2')];
  let nextGatewayIndex = 0;

  const manager = createCodexGatewayManager({
    createGateway: async () => gateways[nextGatewayIndex++],
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  assert.equal(manager.getGatewayGeneration(), 0);

  await manager.initialize();
  assert.equal(manager.getGatewayGeneration(), 1);

  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  assert.equal(manager.getGatewayGeneration(), 1);

  clock.advanceBy(100);
  assert.equal(manager.getGatewayGeneration(), 1);

  await manager.startTurn({
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    text: 'wake the next gateway',
  });

  assert.equal(manager.getGatewayGeneration(), 2);
});
