import { createConversationAggregation } from './conversation-aggregation.js';
import { createConversationDeltaAccumulator } from './conversation-delta-accumulator.js';
import type {
  ConversationCommand,
  ConversationDomainEvent,
  ConversationFailedSnapshot,
  ConversationItem,
  ConversationReadySnapshot,
  ConversationSnapshot,
} from './conversation-events.js';
import { createConversationOrderRegistry } from './conversation-order.js';
import { createTimeoutConversationScheduler, type ConversationDependencies } from './conversation-ports.js';
import {
  createRuntimeTurnConversationOrder,
  projectRuntimeError,
  projectRuntimeDeltaState,
  projectRuntimeThreadItem,
  projectRuntimeTimeline,
  projectRuntimeTurnDiff,
  projectRuntimeTurnPlan,
  projectRuntimeTurns,
} from './conversation-runtime-projection.js';
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
  | Omit<Extract<ConversationDomainEvent, { readonly kind: 'conversation-replaced' }>, 'revision' | 'conversation'> & {
    readonly conversation: ConversationReplacement;
  }
  | Omit<Extract<ConversationDomainEvent, { readonly kind: 'conversation-item-upserted' }>, 'revision'>;

type ConversationReplacement =
  | Omit<ConversationReadySnapshot, 'revision'>
  | Omit<ConversationFailedSnapshot, 'revision'>;

export function createConversationService(dependencies: ConversationDependencies): ConversationService {
  const states = new Map<string, ConversationState>();
  const order = createConversationOrderRegistry();
  const deltaAccumulator = createConversationDeltaAccumulator();
  const aggregation = createConversationAggregation({
    delayMs: conversationAggregationDelayMs,
    scheduler: dependencies.scheduler ?? createTimeoutConversationScheduler(),
    flush(input) {
      publishItem({
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

  interface PublishItemInput {
    readonly threadId: string;
    readonly item: ConversationItem;
  }

  function publishItem(input: PublishItemInput): ConversationSnapshot {
    const state = readState(input.threadId);
    const currentItems = state.status === 'ready' ? state.items : [];

    return publish({
      kind: 'conversation-item-upserted',
      threadId: input.threadId,
      item: input.item,
      position: order.locateItem({
        threadId: input.threadId,
        itemId: input.item.id,
        currentItems,
      }),
    });
  }

  function recordDelta(command: Extract<ConversationCommand, { readonly kind: 'record-runtime-item-delta' }>): ConversationSnapshot {
    const state = readState(command.threadId);

    if (state.status !== 'ready') {
      return createConversationSnapshot({ state });
    }

    order.recordItem({
      threadId: command.threadId,
      itemId: command.itemId,
    });

    const deltaState = deltaAccumulator.record({
      threadId: command.threadId,
      itemId: command.itemId,
      deltaKind: command.deltaKind,
      text: command.text,
      data: command.data ?? null,
      currentItem: readCurrentItem({
        state,
        itemId: command.itemId,
      }),
    });
    const item = projectRuntimeDeltaState({ state: deltaState });

    aggregation.recordPendingItem({
      threadId: command.threadId,
      turnId: command.turnId,
      item,
    });

    return createConversationSnapshot({ state });
  }

  function applyCommand(input: ConversationCommand): ConversationSnapshot {
    switch (input.kind) {
      case 'record-runtime-item-delta':
        return recordDelta(input);

      case 'replace-conversation':
        aggregation.discardThread({ threadId: input.threadId });
        deltaAccumulator.discardThread({ threadId: input.threadId });
        order.replaceThread({
          threadId: input.threadId,
          itemIds: input.items.map(item => item.id),
        });
        return publish({
          kind: 'conversation-replaced',
          threadId: input.threadId,
          conversation: {
            status: 'ready',
            items: input.items,
          },
        });

      case 'replace-runtime-conversation': {
        aggregation.discardThread({ threadId: input.threadId });
        deltaAccumulator.discardThread({ threadId: input.threadId });
        const items = input.turns
          ? projectRuntimeTurns({ turns: input.turns })
          : projectRuntimeTimeline({ items: input.items });
        order.replaceThread({
          threadId: input.threadId,
          itemIds: input.turns
            ? createRuntimeTurnConversationOrder({ turns: input.turns })
            : input.items.map(item => item.itemId),
        });
        return publish({
          kind: 'conversation-replaced',
          threadId: input.threadId,
          conversation: {
            status: 'ready',
            items,
          },
        });
      }

      case 'fail-conversation':
        aggregation.discardThread({ threadId: input.threadId });
        deltaAccumulator.discardThread({ threadId: input.threadId });
        order.discardThread({ threadId: input.threadId });
        return publish({
          kind: 'conversation-replaced',
          threadId: input.threadId,
          conversation: {
            status: 'failed',
            error: input.error,
          },
        });

      case 'record-runtime-thread-item': {
        order.recordItem({
          threadId: input.threadId,
          itemId: input.item.itemId,
        });
        const item = projectRuntimeThreadItem({ item: input.item });

        if (!item) {
          return createConversationSnapshot({ state: readState(input.threadId) });
        }

        aggregation.discardItem({ threadId: input.threadId, itemId: item.id });
        deltaAccumulator.discardItem({ threadId: input.threadId, itemId: item.id });
        return publishItem({
          threadId: input.threadId,
          item,
        });
      }

      case 'record-runtime-turn-plan': {
        const item = projectRuntimeTurnPlan({
          turnId: input.turnId,
          explanation: input.explanation,
          plan: input.plan,
        });
        order.recordItem({
          threadId: input.threadId,
          itemId: item.id,
        });
        return publishItem({
          threadId: input.threadId,
          item,
        });
      }

      case 'record-runtime-turn-diff': {
        const item = projectRuntimeTurnDiff({
          turnId: input.turnId,
          diff: input.diff,
        });
        order.recordItem({
          threadId: input.threadId,
          itemId: item.id,
        });
        return publishItem({
          threadId: input.threadId,
          item,
        });
      }

      case 'record-runtime-error': {
        aggregation.flushTurn({ threadId: input.threadId, turnId: input.turnId });
        const item = projectRuntimeError({
          turnId: input.turnId,
          error: input.error,
        });
        order.recordItem({
          threadId: input.threadId,
          itemId: item.id,
        });
        return publishItem({
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
          status: 'ready',
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
  return input.state;
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
        conversation: {
          ...input.event.conversation,
          revision: input.revision,
        },
        revision: input.revision,
      };

    case 'conversation-item-upserted':
      return {
        ...input.event,
        revision: input.revision,
      };
  }
}

interface ReadCurrentItemInput {
  readonly state: ConversationState;
  readonly itemId: string;
}

function readCurrentItem(input: ReadCurrentItemInput): ConversationItem | null {
  if (input.state.status !== 'ready') {
    return null;
  }

  return input.state.items.find(item => item.id === input.itemId) ?? null;
}

