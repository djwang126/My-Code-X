import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createThreadService } from './thread-service.js';
import type { DomainEvent } from '../../ports/index.js';

function createPublishedEvents() {
  const events: DomainEvent[] = [];

  return {
    events,
    bus: {
      publish(event: DomainEvent) {
        events.push(event);
      },

      subscribe() {
        return () => {};
      },
    },
  };
}

describe('createThreadService', () => {
  test('remembers thread metadata without storing current thread selection', () => {
    const published = createPublishedEvents();
    const service = createThreadService({ events: published.bus });
    const thread = {
      threadId: 'thread-1',
      workspace: 'workspace-1',
      title: 'Thread one',
      updatedAt: '2026-04-29T00:00:00.000Z',
    };

    const remembered = service.remember({
      kind: 'remember-thread',
      thread,
    });

    assert.deepEqual(remembered, thread);
    assert.deepEqual(service.get('thread-1'), thread);
    assert.deepEqual(service.snapshot(), { threads: [thread] });
    assert.deepEqual(published.events, [{ kind: 'thread-remembered', thread }]);
  });

  test('forgets thread metadata by thread id', () => {
    const published = createPublishedEvents();
    const service = createThreadService({ events: published.bus });

    service.remember({
      kind: 'remember-thread',
      thread: {
        threadId: 'thread-1',
        workspace: 'workspace-1',
        title: null,
        updatedAt: null,
      },
    });
    service.forget({
      kind: 'forget-thread',
      threadId: 'thread-1',
    });

    assert.equal(service.get('thread-1'), null);
    assert.deepEqual(service.snapshot(), { threads: [] });
  });
});
