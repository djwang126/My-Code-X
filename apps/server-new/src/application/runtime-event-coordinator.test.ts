import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRuntimeEventCoordinator } from './runtime-event-coordinator.js';
import type { ChatService } from '../features/chat/index.js';
import type { SessionService } from '../features/session/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { RuntimeEvent } from '../ports/index.js';

interface CoordinatorFixture {
  readonly chatEvents: readonly RuntimeEvent[];
  readonly sessionEvents: readonly RuntimeEvent[];
  readonly threadEvents: readonly RuntimeEvent[];
  readonly coordinator: ReturnType<typeof createRuntimeEventCoordinator>;
}

function createCoordinatorFixture(): CoordinatorFixture {
  const chatEvents: RuntimeEvent[] = [];
  const sessionEvents: RuntimeEvent[] = [];
  const threadEvents: RuntimeEvent[] = [];

  const chat: ChatService = {
    async send() {
      return {
        activeTurnId: null,
        lastError: null,
        latestText: '',
        status: 'idle',
        threadId: null,
      };
    },

    receiveRuntimeEvent(event) {
      chatEvents.push(event);
    },

    snapshot() {
      return {
        activeTurnId: null,
        lastError: null,
        latestText: '',
        status: 'idle',
        threadId: null,
      };
    },
  };

  const session: SessionService = {
    async open() {
      return {
        lastError: null,
        lastNotice: null,
        pendingInputCount: 0,
        sessionId: null,
      };
    },

    receiveRuntimeEvent(event) {
      sessionEvents.push(event);
    },

    snapshot() {
      return {
        lastError: null,
        lastNotice: null,
        pendingInputCount: 0,
        sessionId: null,
      };
    },

    async close() {},
  };

  const thread: ThreadService = {
    async start() {
      return {
        activeTurnId: null,
        currentThreadId: null,
        threads: [],
      };
    },

    receiveRuntimeEvent(event) {
      threadEvents.push(event);
    },

    snapshot() {
      return {
        activeTurnId: null,
        currentThreadId: null,
        threads: [],
      };
    },
  };

  return {
    chatEvents,
    coordinator: createRuntimeEventCoordinator({ chat, session, thread }),
    sessionEvents,
    threadEvents,
  };
}

describe('createRuntimeEventCoordinator', () => {
  test('routes runtime-turn-started events to chat and thread only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      kind: 'runtime-turn-started',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.chatEvents, [event]);
    assert.deepEqual(fixture.threadEvents, [event]);
    assert.deepEqual(fixture.sessionEvents, []);
  });

  test('routes runtime-output-updated events to chat only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      itemId: 'item-1',
      kind: 'runtime-output-updated',
      outputKind: 'text-delta',
      text: 'hello',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.chatEvents, [event]);
    assert.deepEqual(fixture.threadEvents, []);
    assert.deepEqual(fixture.sessionEvents, []);
  });

  test('routes runtime-turn-completed events to chat only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      error: null,
      kind: 'runtime-turn-completed',
      status: 'completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.chatEvents, [event]);
    assert.deepEqual(fixture.threadEvents, []);
    assert.deepEqual(fixture.sessionEvents, []);
  });

  test('routes runtime-input-requested events to chat and session only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      inputKind: 'approval',
      kind: 'runtime-input-requested',
      prompt: 'Approve?',
      requestId: 'request-1',
      threadId: 'thread-1',
      title: 'Approval',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.chatEvents, [event]);
    assert.deepEqual(fixture.sessionEvents, [event]);
    assert.deepEqual(fixture.threadEvents, []);
  });

  test('routes runtime-error events to session only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      error: {
        code: 'RUNTIME_FAILED',
        message: 'Runtime failed',
      },
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.sessionEvents, [event]);
    assert.deepEqual(fixture.chatEvents, []);
    assert.deepEqual(fixture.threadEvents, []);
  });

  test('routes runtime-system-notice events to session only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      kind: 'runtime-system-notice',
      level: 'warning',
      message: 'Low context',
      threadId: 'thread-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.sessionEvents, [event]);
    assert.deepEqual(fixture.chatEvents, []);
    assert.deepEqual(fixture.threadEvents, []);
  });
});
