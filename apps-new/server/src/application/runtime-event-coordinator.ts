import type { ConversationService } from '../features/conversation/index.js';
import type { RuntimeRequestKind, RuntimeRequestService } from '../features/runtime-request/index.js';
import type { ThreadRecord, ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { RuntimeEvent, RuntimeInputKind, RuntimeThread, RuntimeThreadItem } from '../ports/index.js';

export interface RuntimeEventCoordinatorInput {
  readonly conversation?: ConversationService;
  readonly runtimeRequests?: RuntimeRequestService;
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
          return;

        case 'runtime-input-requested':
          input.runtimeRequests?.apply({
            kind: 'open-runtime-request',
            request: {
              id: event.requestId,
              kind: mapRuntimeInputKind(event.inputKind),
              lifecycle: 'open',
              title: event.title,
              prompt: event.prompt,
              responseKind: mapRuntimeInputResponseKind(event.inputKind),
              data: event.data ?? {},
            },
          });
          return;

        case 'runtime-input-resolved':
          input.runtimeRequests?.apply({
            kind: 'resolve-runtime-request',
            requestId: event.requestId,
          });
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
          recordConversationItem({ conversation: input.conversation, threadId: event.threadId, item: event.item });
          return;

        case 'runtime-item-delta':
          recordConversationDelta({ conversation: input.conversation, threadId: event.threadId, event });
          return;

        case 'runtime-error':
          if (event.threadId && event.turnId) {
            input.turn.apply({
              kind: 'turn-completed',
              threadId: event.threadId,
              turnId: event.turnId,
              status: 'failed',
              error: event.error,
              completedAt: null,
              durationMs: null,
            });
          }
          return;

        case 'runtime-thread-status-changed':
        case 'runtime-thread-archived':
        case 'runtime-thread-unarchived':
        case 'runtime-thread-token-usage-updated':
        case 'runtime-turn-diff-updated':
        case 'runtime-turn-plan-updated':
        case 'runtime-codex-notification':
        case 'runtime-system-notice':
          return;
      }
    },
  };
}

function mapRuntimeInputKind(inputKind: RuntimeInputKind): RuntimeRequestKind {
  switch (inputKind) {
    case 'approval':
      return 'approval';
    case 'form':
      return 'form';
    case 'auth':
      return 'auth';
    case 'tool-response':
    case 'unknown':
      return 'tool-response';
  }
}

function mapRuntimeInputResponseKind(inputKind: RuntimeInputKind): 'decision' | 'form' | 'freeform' | 'structured' {
  switch (inputKind) {
    case 'approval':
      return 'decision';
    case 'form':
      return 'form';
    case 'auth':
      return 'freeform';
    case 'tool-response':
    case 'unknown':
      return 'structured';
  }
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
      title: name,
      updatedAt: existing?.updatedAt ?? null,
    },
  });
}

function mapRuntimeThreadRecord(thread: RuntimeThread): ThreadRecord {
  return {
    threadId: thread.threadId,
    workspace: thread.workspace,
    title: thread.title,
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
    itemId: input.event.itemId,
    deltaKind: input.event.deltaKind,
    text: input.event.text,
  });
}
