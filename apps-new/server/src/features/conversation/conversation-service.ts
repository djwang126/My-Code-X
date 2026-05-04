import { createConversationAggregation } from './conversation-aggregation.js';
import type {
  ConversationCommand,
  ConversationDomainEvent,
  ConversationSnapshot,
} from './conversation-events.js';
import { createTimeoutConversationScheduler, type ConversationDependencies } from './conversation-ports.js';
import { projectRuntimeThreadItem, projectRuntimeTimeline } from './conversation-runtime-projection.js';
import { applyConversationDomainEvent, createInitialConversationState, type ConversationState } from './conversation-state.js';

export interface ConversationService {
  apply(input: ConversationCommand): ConversationSnapshot;
  snapshot(input: ConversationSnapshotInput): ConversationSnapshot;
}

export interface ConversationSnapshotInput {
  readonly threadId: string | null;
}

const conversationAggregationDelayMs = 500;

type PublishableConversationDomainEvent =
  | Omit<Extract<ConversationDomainEvent, { readonly kind: 'conversation-replaced' }>, 'revision'>
  | Omit<Extract<ConversationDomainEvent, { readonly kind: 'conversation-item-upserted' }>, 'revision'>;

export function createConversationService(dependencies: ConversationDependencies): ConversationService {
  const states = new Map<string, ConversationState>();
  const aggregation = createConversationAggregation({
    delayMs: conversationAggregationDelayMs,
    scheduler: dependencies.scheduler ?? createTimeoutConversationScheduler(),
    flush(input) {
      publish({
        kind: 'conversation-item-upserted',
        threadId: input.threadId,
        item: input.item,
      });
    },
  });

  function readState(threadId: string): ConversationState {
    return states.get(threadId) ?? createInitialConversationState();
  }

  function writeState(threadId: string, state: ConversationState): void {
    states.set(threadId, state);
  }

  function publish(event: PublishableConversationDomainEvent): ConversationSnapshot {
    const currentState = readState(event.threadId);
    const eventForState = createStateEvent({ event, revision: currentState.revision + 1 });
    const nextState = applyConversationDomainEvent({ state: currentState, event: eventForState });

    if (nextState === currentState) {
      return createConversationSnapshot({ state: currentState });
    }

    const publishedEvent = createStateEvent({ event, revision: nextState.revision });
    writeState(event.threadId, nextState);
    dependencies.events.publish(publishedEvent);
    return createConversationSnapshot({ state: nextState });
  }

  function recordDelta(command: Extract<ConversationCommand, { readonly kind: 'record-runtime-item-delta' }>): ConversationSnapshot {
    const state = readState(command.threadId);

    if (command.deltaKind !== 'agent-message') {
      return createConversationSnapshot({ state });
    }

    if (command.text === null) {
      return createConversationSnapshot({ state });
    }

    aggregation.recordDelta({
      threadId: command.threadId,
      itemId: command.itemId,
      currentText: readCurrentItemText({
        state,
        itemId: command.itemId,
      }),
      deltaText: command.text,
    });

    return createConversationSnapshot({ state });
  }

  function applyCommand(input: ConversationCommand): ConversationSnapshot {
    switch (input.kind) {
      case 'record-runtime-item-delta':
        return recordDelta(input);

      case 'replace-conversation':
        aggregation.discardThread({ threadId: input.threadId });
        return publish({
          kind: 'conversation-replaced',
          threadId: input.threadId,
          items: input.items,
        });

      case 'replace-runtime-conversation':
        aggregation.discardThread({ threadId: input.threadId });
        return publish({
          kind: 'conversation-replaced',
          threadId: input.threadId,
          items: projectRuntimeTimeline({ items: input.items }),
        });

      case 'record-runtime-thread-item': {
        const item = projectRuntimeThreadItem({ item: input.item });

        if (!item) {
          return createConversationSnapshot({ state: readState(input.threadId) });
        }

        if (item.kind === 'message') {
          aggregation.discardItem({ threadId: input.threadId, itemId: item.id });
        }

        return publish({
          kind: 'conversation-item-upserted',
          threadId: input.threadId,
          item,
        });
      }
    }
  }

  return {
    apply(input: ConversationCommand): ConversationSnapshot {
      return applyCommand(input);
    },

    snapshot(input: ConversationSnapshotInput): ConversationSnapshot {
      if (!input.threadId) {
        return {
          revision: 0,
          items: [],
        };
      }

      return createConversationSnapshot({
        state: readState(input.threadId),
      });
    },
  };
}

interface CreateConversationSnapshotInput {
  readonly state: ConversationState;
}

function createConversationSnapshot(input: CreateConversationSnapshotInput): ConversationSnapshot {
  return {
    revision: input.state.revision,
    items: input.state.items,
  };
}

interface CreateStateEventInput {
  readonly event: PublishableConversationDomainEvent;
  readonly revision: number;
}

function createStateEvent(input: CreateStateEventInput): ConversationDomainEvent {
  switch (input.event.kind) {
    case 'conversation-replaced':
      return {
        ...input.event,
        revision: input.revision,
      };

    case 'conversation-item-upserted':
      return {
        ...input.event,
        revision: input.revision,
      };
  }
}

interface ReadCurrentItemTextInput {
  readonly state: ConversationState;
  readonly itemId: string;
}

function readCurrentItemText(input: ReadCurrentItemTextInput): string {
  const existingItem = input.state.items.find(item => item.id === input.itemId);

  if (existingItem?.kind === 'message') {
    return existingItem.text;
  }

  return '';
}
