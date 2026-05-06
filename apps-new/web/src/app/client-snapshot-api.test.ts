import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { createClientSnapshotApiBoundary, type ClientEventSubscription } from './client-snapshot-api.js';
import type { ClientConversationView, ClientSnapshot } from '@my-code-x/contracts-new';

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
});

describe('client snapshot api boundary', () => {
  test('loads and validates the conversation snapshot from client bootstrap response', async () => {
    let requestBody: unknown = null;
    installFetch(async (_resource, init) => {
      requestBody = JSON.parse(String(init?.body));

      return new globalThis.Response(JSON.stringify(createClientSnapshot({
        status: 'ready',
        revision: 0,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **Codex**',
          },
          {
            id: 'item-2',
            kind: 'message',
            role: 'assistant',
            text: 'world',
          },
        ],
      })), {
        status: 200,
      });
    });

    const api = createClientSnapshotApiBoundary();
    const snapshot = await api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    });

    assert.deepEqual(requestBody, {
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    });
    assert.deepEqual(snapshot, {
      conversation: {
        status: 'ready',
        revision: 0,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **Codex**',
          },
          {
            id: 'item-2',
            kind: 'message',
            role: 'assistant',
            text: 'world',
          },
        ],
      },
    });
  });

  test('rejects invalid bootstrap response shape at the boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify({
      ...createClientSnapshot({
        status: 'ready',
        revision: 0,
        items: [],
      }),
      ignored: true,
    }), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    }));
  });

  test('rejects invalid message roles at the client boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify(createClientSnapshot({
      status: 'ready',
      revision: 0,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'system',
          text: 'not a conversation message role',
        },
      ],
    } as unknown as ClientConversationView)), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    }));
  });

  test('rejects rendered or trusted HTML at the client boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify(createClientSnapshot({
      status: 'ready',
      revision: 0,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: '<strong>hello</strong>',
          renderedHtml: '<strong>hello</strong>',
          trustedHtml: true,
        },
      ],
    } as unknown as ClientConversationView)), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    }));
  });

  test('rejects legacy bare text timeline items at the client boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify(createClientSnapshot({
      status: 'ready',
      revision: 0,
      items: [
        {
          id: 'item-1',
          text: 'legacy item',
        },
      ],
    } as unknown as ClientConversationView)), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    }));
  });

  test('sends and validates client action results', async () => {
    let requestBody: unknown = null;
    installFetch(async (_resource, init) => {
      requestBody = JSON.parse(String(init?.body));

      return new globalThis.Response(JSON.stringify({
        status: 'accepted',
        snapshot: null,
        events: [],
        workspacePanel: {
          status: 'ready',
          list: {
            persistence: {
              status: 'persistent',
            },
            selectedWorkspaceId: null,
            items: [],
          },
          page: {
            kind: 'workspace-list',
          },
        },
      }), {
        status: 200,
      });
    });

    const api = createClientSnapshotApiBoundary();
    const result = await api.sendAction({
      kind: 'open-workspace-panel',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    });

    assert.deepEqual(requestBody, {
      kind: 'open-workspace-panel',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    });
    assert.deepEqual(result, {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: {
        status: 'ready',
        list: {
          persistence: {
            status: 'persistent',
          },
          selectedWorkspaceId: null,
          items: [],
        },
        page: {
          kind: 'workspace-list',
        },
      },
    });
  });

  test('rejects invalid client action result shape at the boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify({
      status: 'accepted',
      snapshot: null,
      events: [],
    }), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.sendAction({
      kind: 'open-workspace-panel',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    }));
  });

  test('opens an event source for the current slot and thread', () => {
    const fixture = createSubscribedEventSourceFixture();

    assert.equal(fixture.source.url, '/client/events?slotId=slot-1&threadId=thread-1');
    fixture.subscription.close();
  });

  test('delivers valid client events from the stream', () => {
    const fixture = createSubscribedEventSourceFixture();

    fixture.source.emit(JSON.stringify({
      kind: 'conversation-item-upserted',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '1',
      item: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'hello',
      },
      position: { kind: 'append' },
    }));

    assert.deepEqual(fixture.received, [
      {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '1',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'hello',
        },
        position: { kind: 'append' },
      },
    ]);
    fixture.subscription.close();
  });

  test('reports malformed event stream messages at the client boundary', () => {
    const fixture = createSubscribedEventSourceFixture();

    fixture.source.emit('not json');
    fixture.source.emit(JSON.stringify({ kind: 'unknown-event' }));

    assert.deepEqual(fixture.received, []);
    assert.deepEqual(fixture.failures.map(error => error.message), [
      'Invalid client event payload',
      'Invalid client event payload',
    ]);
    fixture.subscription.close();
  });

  test('closes the event source subscription', () => {
    const fixture = createSubscribedEventSourceFixture();

    fixture.subscription.close();

    assert.equal(fixture.source.closed, true);
  });
});

type FetchReplacement = typeof window.fetch;

function installFetch(fetch: FetchReplacement): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      fetch,
    },
  });
}

function createClientSnapshot(conversation: ClientConversationView): ClientSnapshot {
  return {
    app: {
      status: 'ready',
    },
    identity: {
      slotId: 'slot-1',
    },
    selection: {
      workspaceId: null,
      threadId: null,
    },
    workspace: {
      status: 'none',
    },
    thread: {
      status: 'none',
      title: null,
    },
    turn: {
      current: null,
    },
    conversation,
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled',
      revision: 'initial',
    },
  };
}

type EventSourceFactory = (url: string) => TestEventSource;

function installEventSource(factory: EventSourceFactory): void {
  const EventSourceReplacement = function createEventSource(url: string) {
    return factory(url);
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      EventSource: EventSourceReplacement,
    },
  });
}

interface SubscribedEventSourceFixture {
  readonly source: TestEventSource;
  readonly received: readonly unknown[];
  readonly failures: readonly Error[];
  readonly subscription: ClientEventSubscription;
}

function createSubscribedEventSourceFixture(): SubscribedEventSourceFixture {
  const sources: TestEventSource[] = [];
  installEventSource(url => {
    const source = new TestEventSource(url);
    sources.push(source);
    return source;
  });
  const received: unknown[] = [];
  const failures: Error[] = [];
  const api = createClientSnapshotApiBoundary();
  const subscription = api.subscribeEvents({
    scope: {
      slotId: 'slot-1',
      workspaceId: null,
      threadId: 'thread-1',
      label: 'thread thread-1',
    },
    receive(event) {
      received.push(event);
    },
    fail(error) {
      failures.push(error);
    },
  });

  return {
    source: readOnlyEventSource({ sources }),
    received,
    failures,
    subscription,
  };
}

interface ReadOnlyEventSourceInput {
  readonly sources: readonly TestEventSource[];
}

function readOnlyEventSource(input: ReadOnlyEventSourceInput): TestEventSource {
  assert.equal(input.sources.length, 1);
  return input.sources[0] as TestEventSource;
}

interface TestMessageEvent {
  readonly data: string;
}

class TestEventSource {
  readonly url: string;
  closed = false;
  private messageHandler: ((event: TestMessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: (event: TestMessageEvent) => void): void {
    if (type === 'message') {
      this.messageHandler = handler;
    }
  }

  emit(data: string): void {
    this.messageHandler?.({ data });
  }

  close(): void {
    this.closed = true;
  }
}
