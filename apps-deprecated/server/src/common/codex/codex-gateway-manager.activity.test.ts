import test from 'node:test';
import assert from 'node:assert/strict';

import { createCodexGatewayManager } from './codex-gateway-manager.js';

function createFakeClock() {
  let nowMs = 0;
  let nextTimerId = 1;
  const timers = new Map();

  function setTimeoutImpl(callback, delay) {
    const timerId = nextTimerId++;
    timers.set(timerId, { callback, runAt: nowMs + delay });
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

function createFakeGateway() {
  const calls = [];
  let notificationHandler: (event: unknown) => void = () => {};

  return {
    calls,
    setNotificationHandler(handler) {
      notificationHandler = handler;
    },
    emitNotification(event) {
      notificationHandler(event);
    },
    async startThread(input) {
      calls.push({ method: 'startThread', input });
      return { threadId: 'thr-1' };
    },
    async startTurn(input) {
      calls.push({ method: 'startTurn', input });
      return { turnId: 'turn-1' };
    },
    async close() {
      calls.push({ method: 'close' });
    },
  };
}

test('createCodexGatewayManager resets the idle deadline after each gateway-backed request', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway();
  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: { kind: 'enabled', idleTimeoutMs: 100 },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  clock.advanceBy(50);
  await manager.startTurn({ threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X', text: 'continue' });
  clock.advanceBy(99);

  assert.equal(gateway.calls.some(call => call.method === 'close'), false);

  clock.advanceBy(1);

  assert.equal(gateway.calls.at(-1)?.method, 'close');
});

test('createCodexGatewayManager treats Codex notifications as activity that postpone idle shutdown', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway();
  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: { kind: 'enabled', idleTimeoutMs: 100 },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  clock.advanceBy(50);
  gateway.emitNotification({ type: 'turn_progress', threadId: 'thr-1' });
  clock.advanceBy(99);

  assert.equal(gateway.calls.some(call => call.method === 'close'), false);

  clock.advanceBy(1);

  assert.equal(gateway.calls.at(-1)?.method, 'close');
});

test('createCodexGatewayManager keeps the gateway alive when idle shutdown is disabled', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway();
  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: { kind: 'disabled' },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  clock.advanceBy(10_000);

  assert.equal(gateway.calls.some(call => call.method === 'close'), false);
});
