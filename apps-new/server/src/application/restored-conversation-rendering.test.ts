import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { ClientEvent } from '@my-code-x/contracts-new';
import { createClientEventStream } from './client-event-stream.js';
import { createApplication } from './create-application.js';
import { createConversationService, type ConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import { createThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
import { createTurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { ConversationItem } from '../features/conversation/index.js';
import type { DomainEvent, DomainEventHandler, EventBusPort, RuntimeCommand, RuntimeEventHandler, RuntimePort, RuntimeResult, Unsubscribe } from '../ports/index.js';

interface RuntimeBehavior {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
}

interface ApplicationFixtureOptions {
  readonly initialConversationItems?: readonly ConversationItem[];
}

interface ApplicationFixture {
  readonly application: ReturnType<typeof createApplication>;
  readonly conversation: ConversationService;
  readonly events: EventBusPort;
}

describe('restored conversation rendering application flow', () => {
  test('open-client returns the restored history for an existing thread', async () => {
    const application = createApplicationFixture({
      async send(input: RuntimeCommand): Promise<RuntimeResult> {
        if (input.kind !== 'resume-thread') {
          throw new Error(`unexpected runtime command: ${input.kind}`);
        }

        return {
          kind: 'thread-resumed',
          threadId: 'thread-1',
          snapshot: {
            threadId: 'thread-1',
            title: 'Restored thread',
            pendingInputs: [],
            items: [
              {
                itemId: 'user-1',
                itemKind: 'userMessage',
                status: 'completed',
                text: 'hello',
                content: [],
              },
              {
                itemId: 'assistant-1',
                itemKind: 'agentMessage',
                status: 'completed',
                text: 'hi',
                phase: null,
                memoryCitation: null,
              },
            ],
          },
        };
      },
    });

    const snapshot = await application.openClient({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:/workspace',
        threadId: 'thread-1',
      },
      payload: {},
    });

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'user-1',
          kind: 'message',
          role: 'user',
          text: 'hello',
        },
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'hi',
        },
      ],
    });
  });

  test('open-client reports restore failure as a conversation failed state', async () => {
    const application = createApplicationFixture({
      async send(input: RuntimeCommand): Promise<RuntimeResult> {
        if (input.kind !== 'resume-thread') {
          throw new Error(`unexpected runtime command: ${input.kind}`);
        }

        return { kind: 'ok' };
      },
    });

    const snapshot = await application.openClient({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:/workspace',
        threadId: 'thread-1',
      },
      payload: {},
    });

    assert.deepEqual(snapshot.conversation, {
      status: 'failed',
      error: {
        message: 'runtime did not open the requested thread',
      },
    });
  });

  test('open-client replaces old timeline items with the restored history', async () => {
    const application = createApplicationFixture(
      {
        async send(input: RuntimeCommand): Promise<RuntimeResult> {
          if (input.kind !== 'resume-thread') {
            throw new Error(`unexpected runtime command: ${input.kind}`);
          }

          return {
            kind: 'thread-resumed',
            threadId: 'thread-1',
            snapshot: {
              threadId: 'thread-1',
              title: 'Restored thread',
              pendingInputs: [],
              items: [
                {
                  itemId: 'restored-user',
                  itemKind: 'userMessage',
                  status: 'completed',
                  text: 'restored hello',
                  content: [],
                },
              ],
            },
          };
        },
      },
      {
        initialConversationItems: [
          {
            id: 'old-item',
            kind: 'message',
            role: 'assistant',
            text: 'old',
          },
        ],
      },
    );

    const snapshot = await application.openClient({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:/workspace',
        threadId: 'thread-1',
      },
      payload: {},
    });

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'restored-user',
          kind: 'message',
          role: 'user',
          text: 'restored hello',
        },
      ],
    });
  });

  test('restored in-progress thread continues sending later conversation updates', async () => {
    const fixture = createApplicationFixtureParts({
      async send(input: RuntimeCommand): Promise<RuntimeResult> {
        if (input.kind !== 'resume-thread') {
          throw new Error(`unexpected runtime command: ${input.kind}`);
        }

        return {
          kind: 'thread-resumed',
          threadId: 'thread-1',
          snapshot: {
            threadId: 'thread-1',
            title: 'Restored thread',
            pendingInputs: [],
            items: [
              {
                itemId: 'user-1',
                itemKind: 'userMessage',
                status: 'completed',
                text: 'hello',
                content: [],
              },
              {
                itemId: 'assistant-1',
                itemKind: 'agentMessage',
                status: 'completed',
                text: 'hi',
                phase: null,
                memoryCitation: null,
              },
            ],
          },
        };
      },
    });

    await fixture.application.openClient({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:/workspace',
        threadId: 'thread-1',
      },
      payload: {},
    });

    const stream = createClientEventStream({
      conversation: fixture.conversation,
      events: fixture.events,
    });
    const sent: ClientEvent[] = [];
    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    fixture.conversation.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-2',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'later update',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(sent, [
      {
        kind: 'conversation-replaced',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '1',
        conversation: {
          status: 'ready',
          revision: 1,
          items: [
            {
              id: 'user-1',
              kind: 'message',
              role: 'user',
              text: 'hello',
            },
            {
              id: 'assistant-1',
              kind: 'message',
              role: 'assistant',
              text: 'hi',
            },
          ],
        },
      },
      {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '2',
        item: {
          id: 'assistant-2',
          kind: 'message',
          role: 'assistant',
          text: 'later update',
        },
      },
    ]);
  });

  test('restored item identity can be updated by later runtime items', async () => {
    const fixture = createApplicationFixtureParts({
      async send(input: RuntimeCommand): Promise<RuntimeResult> {
        if (input.kind !== 'resume-thread') {
          throw new Error(`unexpected runtime command: ${input.kind}`);
        }

        return {
          kind: 'thread-resumed',
          threadId: 'thread-1',
          snapshot: {
            threadId: 'thread-1',
            title: 'Restored thread',
            pendingInputs: [],
            items: [
              {
                itemId: 'assistant-1',
                itemKind: 'agentMessage',
                status: 'in-progress',
                text: 'partial answer',
                phase: null,
                memoryCitation: null,
              },
            ],
          },
        };
      },
    });

    await fixture.application.openClient({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:/workspace',
        threadId: 'thread-1',
      },
      payload: {},
    });
    fixture.conversation.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'completed answer',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'completed answer',
        },
      ],
    });
  });
});

function createApplicationFixture(behavior: RuntimeBehavior, options: ApplicationFixtureOptions = {}) {
  return createApplicationFixtureParts(behavior, options).application;
}

function createApplicationFixtureParts(
  behavior: RuntimeBehavior,
  options: ApplicationFixtureOptions = {},
): ApplicationFixture {
  const events = createEventBus();
  const runtime = createRuntimePort(behavior);
  const conversation = createConversationService({ events });
  const slot = createSlotService({ events });
  const thread = createThreadService({ events });
  const threadActions = createThreadActionsService({ runtime, events });
  const turn = createTurnService({ events });
  const workspace = createWorkspaceService();

  if (options.initialConversationItems) {
    conversation.apply({
      kind: 'replace-conversation',
      threadId: 'thread-1',
      items: options.initialConversationItems,
    });
  }

  return {
    application: createApplication({
      conversation,
      runtime,
      slot,
      thread,
      threadActions,
      turn,
      workspace,
    }),
    conversation,
    events,
  };
}

function createRuntimePort(behavior: RuntimeBehavior): RuntimePort {
  return {
    send(input: RuntimeCommand): Promise<RuntimeResult> {
      return behavior.send(input);
    },

    subscribe(_handler: RuntimeEventHandler) {
      return () => {};
    },

    async close() {},
  };
}

function createWorkspaceService(): WorkspaceService {
  return {
    async inspectSavedWorkspace(command) {
      if (!command.workspaceId) { return { status: 'none' }; }
      return { status: 'available', workspaceId: command.workspaceId };
    },
    async openList(command) {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: command.selectedWorkspaceId,
        items: [],
      };
    },
    async add(command) {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: command.selectedWorkspaceId,
        items: [],
      };
    },
    async rename(command) {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: command.selectedWorkspaceId,
        items: [],
      };
    },
    async editCwd(command) {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: command.selectedWorkspaceId,
        items: [],
      };
    },
    async remove(command) {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: command.selectedWorkspaceId,
        items: [],
      };
    },
  };
}

function createEventBus(): EventBusPort {
  const handlers = new Set<DomainEventHandler>();

  return {
    publish(event: DomainEvent) {
      for (const handler of handlers) {
        handler(event);
      }
    },

    subscribe(handler: DomainEventHandler): Unsubscribe {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}
