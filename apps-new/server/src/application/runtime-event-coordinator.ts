import type { ConversationService } from '../features/conversation/index.js';
import type { ThreadRecord, ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { RuntimeErrorInfo, RuntimeEvent, RuntimeThread, RuntimeThreadItem } from '../ports/index.js';
import { assertNever } from '../shared/index.js';

export interface RuntimeEventCoordinatorInput {
  readonly conversation?: ConversationService;
  readonly thread?: ThreadService;
  readonly turn: TurnService;
}

export interface RuntimeEventCoordinator {
  receive(event: RuntimeEvent): void;
}

export function createRuntimeEventCoordinator(input: RuntimeEventCoordinatorInput): RuntimeEventCoordinator {
  return {
    receive(event: RuntimeEvent) {
      switch (event.kind) {
        case 'runtime-turn-started':
          input.turn.apply({
            kind: 'turn-started',
            threadId: event.threadId,
            turnId: event.turnId,
            startedAt: event.turn?.startedAt ?? null,
          });
          return;

        case 'runtime-turn-completed':
          input.turn.apply({
            kind: 'turn-completed',
            threadId: event.threadId,
            turnId: event.turnId,
            status: event.status,
            error: event.error,
            completedAt: event.turn?.completedAt ?? null,
            durationMs: event.turn?.durationMs ?? null,
          });
          if (event.status === 'failed' && event.error) {
            recordConversationError({
              conversation: input.conversation,
              threadId: event.threadId,
              turnId: event.turnId,
              error: event.error,
            });
          }
          return;

        case 'runtime-host-requested':
        case 'runtime-host-request-resolved':
          return;

        case 'runtime-thread-started':
          rememberRuntimeThread(input.thread, event.thread);
          return;

        case 'runtime-thread-name-updated':
          rememberThreadName(input.thread, event.threadId, event.name ?? null);
          return;

        case 'runtime-thread-closed':
          input.thread?.forget({
            kind: 'forget-thread',
            threadId: event.threadId,
          });
          return;

        case 'runtime-item-started':
        case 'runtime-item-completed':
          recordConversationItem({
            conversation: input.conversation,
            threadId: event.threadId,
            item: event.item,
          });
          return;

        case 'runtime-item-delta':
          recordConversationDelta({ conversation: input.conversation, threadId: event.threadId, event });
          return;

        case 'runtime-turn-plan-updated':
          recordConversationTurnPlan({ conversation: input.conversation, event });
          return;

        case 'runtime-turn-diff-updated':
          recordConversationTurnDiff({ conversation: input.conversation, event });
          return;

        case 'runtime-error':
          if (event.threadId && event.turnId) {
            recordConversationError({
              conversation: input.conversation,
              threadId: event.threadId,
              turnId: event.turnId,
              error: event.error,
            });
          }
          return;

        case 'runtime-thread-status-changed':
        case 'runtime-thread-archived':
        case 'runtime-thread-unarchived':
        case 'runtime-thread-token-usage-updated':
        case 'runtime-system-notice':
          return;
      }

      return assertNever(event, 'Unsupported runtime event');
    },
  };
}

function rememberRuntimeThread(thread: ThreadService | undefined, runtimeThread: RuntimeThread): void {
  if (!thread) {
    return;
  }

  thread.remember({
    kind: 'remember-thread',
    thread: mapRuntimeThreadRecord(runtimeThread),
  });
}

function rememberThreadName(thread: ThreadService | undefined, threadId: string, name: string | null): void {
  if (!thread) {
    return;
  }

  const existing = thread.get(threadId);
  thread.remember({
    kind: 'remember-thread',
    thread: {
      threadId,
      workspace: existing?.workspace ?? null,
      name,
      updatedAt: existing?.updatedAt ?? null,
    },
  });
}

function mapRuntimeThreadRecord(thread: RuntimeThread): ThreadRecord {
  return {
    threadId: thread.threadId,
    workspace: thread.workspace,
    name: thread.name,
    updatedAt: thread.updatedAt,
  };
}

interface RecordConversationItemInput {
  readonly conversation: ConversationService | undefined;
  readonly threadId: string;
  readonly item: RuntimeThreadItem;
}

function recordConversationItem(input: RecordConversationItemInput): void {
  if (!input.conversation) {
    return;
  }

  input.conversation.apply({
    kind: 'record-runtime-thread-item',
    threadId: input.threadId,
    item: input.item,
  });
}

interface RecordConversationDeltaInput {
  readonly conversation: ConversationService | undefined;
  readonly threadId: string;
  readonly event: Extract<RuntimeEvent, { readonly kind: 'runtime-item-delta' }>;
}

function recordConversationDelta(input: RecordConversationDeltaInput): void {
  if (!input.conversation) {
    return;
  }

  input.conversation.apply({
    kind: 'record-runtime-item-delta',
    threadId: input.threadId,
    turnId: input.event.turnId,
    itemId: input.event.itemId,
    deltaKind: input.event.deltaKind,
    text: input.event.text,
    data: input.event.data ?? null,
  });
}

interface RecordConversationTurnPlanInput {
  readonly conversation: ConversationService | undefined;
  readonly event: Extract<RuntimeEvent, { readonly kind: 'runtime-turn-plan-updated' }>;
}

function recordConversationTurnPlan(input: RecordConversationTurnPlanInput): void {
  if (!input.conversation) {
    return;
  }

  input.conversation.apply({
    kind: 'record-runtime-turn-plan',
    threadId: input.event.threadId,
    turnId: input.event.turnId,
    explanation: input.event.explanation,
    plan: input.event.plan,
  });
}

interface RecordConversationTurnDiffInput {
  readonly conversation: ConversationService | undefined;
  readonly event: Extract<RuntimeEvent, { readonly kind: 'runtime-turn-diff-updated' }>;
}

function recordConversationTurnDiff(input: RecordConversationTurnDiffInput): void {
  if (!input.conversation) {
    return;
  }

  input.conversation.apply({
    kind: 'record-runtime-turn-diff',
    threadId: input.event.threadId,
    turnId: input.event.turnId,
    diff: input.event.diff,
  });
}

interface RecordConversationErrorInput {
  readonly conversation: ConversationService | undefined;
  readonly threadId: string;
  readonly turnId: string;
  readonly error: RuntimeErrorInfo;
}

function recordConversationError(input: RecordConversationErrorInput): void {
  if (!input.conversation) {
    return;
  }

  input.conversation.apply({
    kind: 'record-runtime-error',
    threadId: input.threadId,
    turnId: input.turnId,
    error: input.error,
  });
}
