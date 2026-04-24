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

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createFakeGateway(name, options = { models: [] }) {
  const calls = [];
  let notificationHandler: (event: unknown) => void = () => {};

  return {
    name,
    calls,
    setNotificationHandler(handler) {
      notificationHandler = handler;
    },
    emitNotification(event) {
      notificationHandler(event);
    },
    async startThread(input) {
      calls.push({ method: 'startThread', input });
      return { threadId: `${name}-thread` };
    },
    async resumeThread(input) {
      calls.push({ method: 'resumeThread', input });
      return {
        threadId: input.threadId,
        turnId: null,
        status: 'completed',
        messages: [],
        notices: [],
        pendingRequests: [],
      };
    },
    async listThreads(input) {
      calls.push({ method: 'listThreads', input });
      return [];
    },
    async startTurn(input) {
      calls.push({ method: 'startTurn', input });
      return { turnId: `${name}-turn` };
    },
    async interruptTurn(input) {
      calls.push({ method: 'interruptTurn', input });
      return { ok: true };
    },
    async compactThread(input) {
      calls.push({ method: 'compactThread', input });
      return { ok: true, threadId: input.threadId };
    },
    async forkThread(input) {
      calls.push({ method: 'forkThread', input });
      return { threadId: `${name}-forked-thread` };
    },
    async rollbackThread(input) {
      calls.push({ method: 'rollbackThread', input });
      return { ok: true, threadId: input.threadId };
    },
    async startReview(input) {
      calls.push({ method: 'startReview', input });
      return { reviewThreadId: `${name}-review-thread` };
    },
    async respondToRequest(input) {
      calls.push({ method: 'respondToRequest', input });
      return { ok: true, requestId: input.requestId };
    },
    async close() {
      calls.push({ method: 'close' });
    },
    getPreferences() {
      return { gateway: name };
    },
    getOptions() {
      return options;
    },
  };
}

test('createCodexGatewayManager eagerly starts Codex during initialize and reuses it for requests', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway('gateway-1');
  const createGatewayCalls = [];

  const manager = createCodexGatewayManager({
    createGateway: async () => {
      createGatewayCalls.push('create');
      return gateway;
    },
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 60_000,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  assert.deepEqual(createGatewayCalls, []);

  await manager.initialize();

  assert.deepEqual(createGatewayCalls, ['create']);

  const result = await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });

  assert.deepEqual(createGatewayCalls, ['create']);
  assert.deepEqual(result, { threadId: 'gateway-1-thread' });
  assert.deepEqual(gateway.calls, [
    {
      method: 'startThread',
      input: { workspace: 'D:/workspaces/My-Code-X' },
    },
  ]);
});

test('createCodexGatewayManager closes an idle gateway after the timeout and starts a fresh one on the next request', async () => {
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

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  clock.advanceBy(100);

  assert.deepEqual(gateways[0].calls, [
    {
      method: 'startThread',
      input: { workspace: 'D:/workspaces/My-Code-X' },
    },
    {
      method: 'close',
    },
  ]);

  const turnResult = await manager.startTurn({
    threadId: 'thr-resume',
    workspace: 'D:/workspaces/My-Code-X',
    text: 'continue',
  });

  assert.deepEqual(turnResult, { turnId: 'gateway-2-turn' });
  assert.deepEqual(gateways[1].calls, [
    {
      method: 'startTurn',
      input: {
        threadId: 'thr-resume',
        workspace: 'D:/workspaces/My-Code-X',
        text: 'continue',
      },
    },
  ]);
});

test('createCodexGatewayManager preserves discovered model options after an idle restart returns a smaller model list', async () => {
  const clock = createFakeClock();
  const gateways = [
    createFakeGateway('gateway-1', {
      models: [
        { value: 'gpt-5.4', label: 'GPT-5.4', description: '' },
        { value: 'gpt-5.5', label: 'GPT-5.5', description: '' },
      ],
    }),
    createFakeGateway('gateway-2', {
      models: [{ value: 'gpt-5.4', label: 'GPT-5.4', description: '' }],
    }),
  ];
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

  await manager.initialize();
  assert.deepEqual(
    manager.getOptions().models.map(option => option.value),
    ['gpt-5.4', 'gpt-5.5'],
  );

  clock.advanceBy(100);

  await manager.startTurn({
    threadId: 'thr-resume',
    workspace: 'D:/workspaces/My-Code-X',
    text: 'continue after idle restart',
  });

  assert.deepEqual(
    manager.getOptions().models.map(option => option.value),
    ['gpt-5.4', 'gpt-5.5'],
  );
});

test('createCodexGatewayManager defers idle shutdown while the runtime is not safe to close', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway('gateway-1');
  let safeToShutdown = false;

  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => safeToShutdown,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  clock.advanceBy(100);

  assert.deepEqual(gateway.calls, [
    {
      method: 'startThread',
      input: { workspace: 'D:/workspaces/My-Code-X' },
    },
  ]);

  safeToShutdown = true;
  clock.advanceBy(100);

  assert.deepEqual(gateway.calls, [
    {
      method: 'startThread',
      input: { workspace: 'D:/workspaces/My-Code-X' },
    },
    {
      method: 'close',
    },
  ]);
});

test('createCodexGatewayManager does not close the gateway while a gateway request is still in flight', async () => {
  const clock = createFakeClock();
  const resumeDeferred = createDeferred<{
    threadId: string;
    turnId: null;
    status: string;
    messages: unknown[];
    notices: unknown[];
    pendingRequests: unknown[];
  }>();
  const gateway = createFakeGateway('gateway-1');
  gateway.resumeThread = async input => {
    gateway.calls.push({ method: 'resumeThread', input });
    return resumeDeferred.promise;
  };

  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  const resumePromise = manager.resumeThread({
    threadId: 'thr-1',
    workspace: 'D:/workspaces/My-Code-X',
  });

  clock.advanceBy(100);

  assert.equal(gateway.calls.some(call => call.method === 'close'), false);

  resumeDeferred.resolve({
    threadId: 'thr-1',
    turnId: null,
    status: 'completed',
    messages: [],
    notices: [],
    pendingRequests: [],
  });

  await resumePromise;
});

test('createCodexGatewayManager can close the gateway after an in-flight request finishes and the next idle deadline passes', async () => {
  const clock = createFakeClock();
  const resumeDeferred = createDeferred<{
    threadId: string;
    turnId: null;
    status: string;
    messages: unknown[];
    notices: unknown[];
    pendingRequests: unknown[];
  }>();
  const gateway = createFakeGateway('gateway-1');
  gateway.resumeThread = async input => {
    gateway.calls.push({ method: 'resumeThread', input });
    return resumeDeferred.promise;
  };

  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  const resumePromise = manager.resumeThread({
    threadId: 'thr-1',
    workspace: 'D:/workspaces/My-Code-X',
  });

  clock.advanceBy(100);
  resumeDeferred.resolve({
    threadId: 'thr-1',
    turnId: null,
    status: 'completed',
    messages: [],
    notices: [],
    pendingRequests: [],
  });
  await resumePromise;

  clock.advanceBy(99);
  assert.equal(gateway.calls.some(call => call.method === 'close'), false);

  clock.advanceBy(1);
  assert.equal(gateway.calls.at(-1)?.method, 'close');
});

test('createCodexGatewayManager keeps the notification handler across an idle restart', async () => {
  const clock = createFakeClock();
  const gateways = [createFakeGateway('gateway-1'), createFakeGateway('gateway-2')];
  let nextGatewayIndex = 0;
  const receivedEvents = [];

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

  manager.setNotificationHandler(event => {
    receivedEvents.push(event);
  });

  await manager.initialize();
  await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });
  gateways[0].emitNotification({ type: 'turn_started', threadId: 'thr-1' });
  clock.advanceBy(100);

  await manager.resumeThread({
    threadId: 'thr-1',
    workspace: 'D:/workspaces/My-Code-X',
  });
  gateways[1].emitNotification({ type: 'turn_completed', threadId: 'thr-1' });

  assert.deepEqual(receivedEvents, [
    { type: 'turn_started', threadId: 'thr-1' },
    { type: 'turn_completed', threadId: 'thr-1' },
  ]);
});

test('createCodexGatewayManager leaves the manager retryable after an on-demand startup failure', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway('gateway-2');
  let attemptCount = 0;

  const manager = createCodexGatewayManager({
    createGateway: async () => {
      attemptCount += 1;
      if (attemptCount === 1) {
        throw new Error('codex startup failed');
      }

      return gateway;
    },
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await assert.rejects(
    () => manager.initialize(),
    error => error instanceof Error && error.message === 'codex startup failed',
  );

  await manager.initialize();
  const result = await manager.startThread({ workspace: 'D:/workspaces/My-Code-X' });

  assert.equal(attemptCount, 2);
  assert.deepEqual(result, { threadId: 'gateway-2-thread' });
});

test('createCodexGatewayManager proxies thread action methods through the active gateway', async () => {
  const clock = createFakeClock();
  const gateway = createFakeGateway('gateway-1');
  const manager = createCodexGatewayManager({
    createGateway: async () => gateway,
    idleShutdownConfig: {
      kind: 'enabled',
      idleTimeoutMs: 100,
    },
    isSafeToShutdown: () => true,
    now: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
  });

  await manager.initialize();
  await manager.interruptTurn({ threadId: 'thr-1', turnId: 'turn-1' });
  await manager.compactThread({ threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X' });
  await manager.forkThread({ threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X' });
  await manager.rollbackThread({ threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X', numTurns: 1 });
  await manager.startReview({ threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X', delivery: 'inline' });

  assert.deepEqual(gateway.calls, [
    {
      method: 'interruptTurn',
      input: { threadId: 'thr-1', turnId: 'turn-1' },
    },
    {
      method: 'compactThread',
      input: { threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X' },
    },
    {
      method: 'forkThread',
      input: { threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X' },
    },
    {
      method: 'rollbackThread',
      input: { threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X', numTurns: 1 },
    },
    {
      method: 'startReview',
      input: { threadId: 'thr-1', workspace: 'D:/workspaces/My-Code-X', delivery: 'inline' },
    },
  ]);
});
