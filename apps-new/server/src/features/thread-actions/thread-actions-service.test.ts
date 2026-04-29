import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createThreadActionsService } from './thread-actions-service.js';
import type { DomainEvent, RuntimeCommand, RuntimeEventHandler, RuntimePort, RuntimeResult } from '../../ports/index.js';

interface RuntimeCall {
  readonly command: RuntimeCommand;
}

function createRuntime(results: readonly RuntimeResult[]): { readonly calls: RuntimeCall[]; readonly runtime: RuntimePort } {
  const calls: RuntimeCall[] = [];
  const pendingResults = [...results];

  return {
    calls,
    runtime: {
      async send(command: RuntimeCommand): Promise<RuntimeResult> {
        calls.push({ command });
        const result = pendingResults.shift();
        if (!result) {
          return { kind: 'ok' };
        }

        return result;
      },

      subscribe(_handler: RuntimeEventHandler) {
        return () => {};
      },

      async close() {},
    },
  };
}

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

describe('createThreadActionsService', () => {
  test('creates a thread without exposing runtime settings in the public command', async () => {
    const published = createPublishedEvents();
    const runtime = createRuntime([{ kind: 'thread-started', threadId: 'thread-1' }]);
    const service = createThreadActionsService({ events: published.bus, runtime: runtime.runtime });

    const thread = await service.create({ workspace: 'workspace-1' });

    assert.deepEqual(thread, {
      threadId: 'thread-1',
      workspace: 'workspace-1',
      title: null,
      updatedAt: null,
    });
    assert.deepEqual(runtime.calls, [
      {
        command: {
          kind: 'start-thread',
          workspace: 'workspace-1',
          runtimeSettings: null,
          baseInstructions: null,
        },
      },
    ]);
    assert.deepEqual(published.events, [{ kind: 'thread-created', thread }]);
  });

  test('opens a thread as an operation over a thread id without storing current thread state', async () => {
    const published = createPublishedEvents();
    const runtime = createRuntime([
      {
        kind: 'thread-resumed',
        threadId: 'thread-1',
        snapshot: {
          threadId: 'thread-1',
          title: 'Thread one',
          items: [],
          pendingInputs: [],
        },
      },
    ]);
    const service = createThreadActionsService({ events: published.bus, runtime: runtime.runtime });

    const thread = await service.open({ threadId: 'thread-1', workspace: 'workspace-1' });

    assert.deepEqual(thread, {
      threadId: 'thread-1',
      workspace: 'workspace-1',
      title: 'Thread one',
      updatedAt: null,
    });
    assert.deepEqual(runtime.calls, [
      {
        command: {
          kind: 'resume-thread',
          threadId: 'thread-1',
          workspace: 'workspace-1',
          runtimeSettings: null,
          baseInstructions: null,
        },
      },
    ]);
    assert.deepEqual(published.events, [{ kind: 'thread-opened', thread }]);
  });
});
