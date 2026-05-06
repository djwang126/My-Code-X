import type { ClientOpenAction, ClientSnapshot } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import type { ThreadRecord, ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { RuntimeTimelineItem, RuntimeTurn } from '../ports/index.js';
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
  const workspace = await useCase.dependencies.workspace.inspectSavedWorkspace({
    workspaceId: useCase.input.scope.workspaceId,
  });
  const usableWorkspace = workspace.status === 'available' ? workspace.workspaceId : null;
  const openedThread = await openSelectedThread({
    threadId: slot.threadId,
    workspace: usableWorkspace,
    thread: useCase.dependencies.thread,
    threadActions: useCase.dependencies.threadActions,
  });
  const selectedThread = openedThread.thread;
  restoreConversation({
    conversation: useCase.dependencies.conversation,
    openedThread,
  });

  return createClientSnapshot({
    revision: 'initial',
    slot,
    selectedThread,
    turn: useCase.dependencies.turn.snapshot(),
    conversation: useCase.dependencies.conversation.snapshot({ threadId: slot.threadId }),
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
  readonly restoredTurns: readonly RuntimeTurn[] | null;
}

interface OpenSelectedThreadFailedResult {
  readonly status: 'failed';
  readonly threadId: string;
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
    return {
      status: 'failed',
      thread: null,
      error: {
        message: 'Workspace 不可用或未保存，无法打开对话',
      },
    };
  }

  const openedThread = await input.threadActions.open({
    threadId: input.threadId,
    workspace: input.workspace,
  });

  if (openedThread.status === 'failed') {
    return {
      status: 'failed',
      threadId: input.threadId,
      thread: null,
      error: openedThread.error,
    };
  }

  const thread = input.thread.remember({
    kind: 'remember-thread',
    thread: {
      threadId: openedThread.thread.threadId,
      workspace: openedThread.thread.workspace,
      name: openedThread.thread.name,
      updatedAt: openedThread.thread.updatedAt,
    },
  });

  return {
    status: 'ready',
    thread,
    restoredItems: openedThread.restoredItems,
    restoredTurns: openedThread.restoredTurns,
  };
}

interface RestoreConversationInput {
  readonly conversation: ConversationService;
  readonly openedThread: OpenSelectedThreadResult;
}

function restoreConversation(input: RestoreConversationInput): void {
  switch (input.openedThread.status) {
    case 'none':
      return;

    case 'ready':
      input.conversation.apply({
        kind: 'replace-runtime-conversation',
        threadId: input.openedThread.thread.threadId,
        items: input.openedThread.restoredItems,
        turns: input.openedThread.restoredTurns,
      });
      return;

    case 'failed':
      input.conversation.apply({
        kind: 'fail-conversation',
        threadId: input.openedThread.threadId,
        error: input.openedThread.error,
      });
      return;
  }
}

function readRequiredScopeValue(value: string | null, fieldName: string): string {
  if (!value) {
    throw new BoundaryError(`client action scope.${fieldName} is required`);
  }

  return value;
}
