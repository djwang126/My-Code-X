import type { ClientActionResult, ClientResumeThreadAction } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import { createClientSnapshot } from '../presenter/index.js';
import { workspaceUnavailableRejected } from './workspace-action-result.js';

export type ResumeClientThreadInput = ClientResumeThreadAction;

export interface ResumeClientThreadDependencies {
  readonly conversation: ConversationService;
  readonly slot: SlotService;
  readonly thread: ThreadService;
  readonly threadActions: ThreadActionsService;
  readonly turn: TurnService;
  readonly workspace: WorkspaceService;
}

export interface ResumeClientThreadUseCaseInput {
  readonly input: ResumeClientThreadInput;
  readonly dependencies: ResumeClientThreadDependencies;
}

export async function resumeClientThread(useCase: ResumeClientThreadUseCaseInput): Promise<ClientActionResult> {
  const scope = readResumeScope(useCase.input);
  if (scope.status === 'invalid') {
    return rejected({
      code: 'invalid-scope',
      message: 'Thread 恢复缺少必要 scope',
    });
  }

  const workspace = await useCase.dependencies.workspace.inspectSavedWorkspace({
    workspaceId: scope.workspaceId,
  });
  if (workspace.status !== 'available') {
    return workspaceUnavailableRejected();
  }

  const openedThread = await useCase.dependencies.threadActions.open({
    threadId: scope.threadId,
    workspace: workspace.workspaceId,
  });
  if (openedThread.status === 'failed') {
    return rejected({
      code: 'thread-resume-failed',
      message: 'Thread 恢复失败',
    });
  }

  const slot = useCase.dependencies.slot.selectThread({
    slotId: scope.slotId,
    workspace: workspace.workspaceId,
    threadId: openedThread.thread.threadId,
  });
  const selectedThread = useCase.dependencies.thread.remember({
    kind: 'remember-thread',
    thread: {
      threadId: openedThread.thread.threadId,
      workspace: openedThread.thread.workspace,
      name: openedThread.thread.name,
      updatedAt: openedThread.thread.updatedAt,
    },
  });
  useCase.dependencies.conversation.apply({
    kind: 'replace-runtime-conversation',
    threadId: openedThread.thread.threadId,
    items: openedThread.restoredItems,
  });

  return {
    status: 'accepted',
    snapshot: createClientSnapshot({
      revision: 'resume-thread',
      slot,
      selectedThread,
      turn: useCase.dependencies.turn.snapshot(),
      conversation: useCase.dependencies.conversation.snapshot({ threadId: openedThread.thread.threadId }),
      workspace,
    }),
    events: [],
    workspacePanel: null,
  };
}

type ResumeScope =
  | { readonly status: 'valid'; readonly slotId: string; readonly workspaceId: string; readonly threadId: string }
  | { readonly status: 'invalid' };

function readResumeScope(input: ResumeClientThreadInput): ResumeScope {
  if (!input.scope.slotId || !input.scope.workspaceId || !input.scope.threadId) {
    return {
      status: 'invalid',
    };
  }

  return {
    status: 'valid',
    slotId: input.scope.slotId,
    workspaceId: input.scope.workspaceId,
    threadId: input.scope.threadId,
  };
}

function rejected(error: { readonly code: string; readonly message: string }): ClientActionResult {
  return {
    status: 'rejected',
    error,
  };
}
