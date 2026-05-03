import type { ClientConversationView, ClientOpenAction, ClientSnapshot } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import type { ThreadRecord, ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { RuntimeTimelineItem } from '../ports/index.js';
import { createClientSnapshot } from '../presenter/index.js';
import { BoundaryError } from '../shared/index.js';

export type OpenClientInput = ClientOpenAction;

export interface OpenClientDependencies {
  readonly conversation: ConversationService;
  readonly slot: SlotService;
  readonly thread: ThreadService;
  readonly threadActions: ThreadActionsService;
  readonly turn: TurnService;
  readonly workspace: WorkspaceService;
}

export interface OpenClientUseCaseInput {
  readonly input: OpenClientInput;
  readonly dependencies: OpenClientDependencies;
}

export async function openClient(useCase: OpenClientUseCaseInput): Promise<ClientSnapshot> {
  const slotId = readRequiredScopeValue(useCase.input.scope.slotId, 'slotId');
  const slot = useCase.dependencies.slot.open({
    slotId,
    workspace: useCase.input.scope.workspaceId,
    threadId: useCase.input.scope.threadId,
  });
  const workspace = await useCase.dependencies.workspace.inspect({
    kind: 'inspect-workspace',
    workspace: useCase.input.scope.workspaceId,
  });
  const openedThread = await openSelectedThread({
    threadId: slot.threadId,
    workspace: slot.workspace,
    thread: useCase.dependencies.thread,
    threadActions: useCase.dependencies.threadActions,
  });
  const selectedThread = openedThread.thread;
  const conversationView = restoreConversation({
    conversation: useCase.dependencies.conversation,
    openedThread,
  });

  return createClientSnapshot({
    revision: 'initial',
    slot,
    selectedThread,
    turn: useCase.dependencies.turn.snapshot(),
    conversation: useCase.dependencies.conversation.snapshot({ threadId: slot.threadId }),
    conversationView,
    workspace,
  });
}

interface OpenSelectedThreadInput {
  readonly threadId: string | null;
  readonly workspace: string | null;
  readonly thread: ThreadService;
  readonly threadActions: ThreadActionsService;
}

type OpenSelectedThreadResult = OpenSelectedThreadNoneResult | OpenSelectedThreadReadyResult | OpenSelectedThreadFailedResult;

interface OpenSelectedThreadNoneResult {
  readonly status: 'none';
  readonly thread: null;
}

interface OpenSelectedThreadReadyResult {
  readonly status: 'ready';
  readonly thread: ThreadRecord;
  readonly restoredItems: readonly RuntimeTimelineItem[];
}

interface OpenSelectedThreadFailedResult {
  readonly status: 'failed';
  readonly thread: null;
  readonly error: OpenSelectedThreadError;
}

interface OpenSelectedThreadError {
  readonly message: string;
}

async function openSelectedThread(input: OpenSelectedThreadInput): Promise<OpenSelectedThreadResult> {
  if (!input.threadId) {
    return {
      status: 'none',
      thread: null,
    };
  }

  if (!input.workspace) {
    throw new BoundaryError('client action scope.workspaceId is required when scope.threadId is provided');
  }

  const openedThread = await input.threadActions.open({
    threadId: input.threadId,
    workspace: input.workspace,
  });

  if (openedThread.status === 'failed') {
    return {
      status: 'failed',
      thread: null,
      error: openedThread.error,
    };
  }

  const thread = input.thread.remember({
    kind: 'remember-thread',
    thread: {
      threadId: openedThread.thread.threadId,
      workspace: openedThread.thread.workspace,
      title: openedThread.thread.title,
      updatedAt: openedThread.thread.updatedAt,
    },
  });

  return {
    status: 'ready',
    thread,
    restoredItems: openedThread.restoredItems,
  };
}

interface RestoreConversationInput {
  readonly conversation: ConversationService;
  readonly openedThread: OpenSelectedThreadResult;
}

function restoreConversation(input: RestoreConversationInput): ClientConversationView | undefined {
  switch (input.openedThread.status) {
    case 'none':
      return undefined;

    case 'ready':
      input.conversation.apply({
        kind: 'replace-runtime-conversation',
        threadId: input.openedThread.thread.threadId,
        items: input.openedThread.restoredItems,
      });
      return undefined;

    case 'failed':
      return {
        status: 'failed',
        error: input.openedThread.error,
      };
  }
}

function readRequiredScopeValue(value: string | null, fieldName: string): string {
  if (!value) {
    throw new BoundaryError(`client action scope.${fieldName} is required`);
  }

  return value;
}
