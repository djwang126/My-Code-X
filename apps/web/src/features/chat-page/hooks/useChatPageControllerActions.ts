import type { ReviewStartTarget } from '../../thread-actions';
import type { SessionSendInput } from '../../chat-runtime/public-types';
import type { UseChatPageControllerStateResult } from './useChatPageControllerState';
import { buildChatPageViewModel } from '../state/chat-page-view-model';
import type { ChatPageErrorKind, ChatPageOperationKey, ChatPageSessionSnapshot } from '../state/chat-page-state-types';

type OperationStateController = Pick<
  UseChatPageControllerStateResult,
  'operations' | 'setSessionErrorHint' | 'startOperation' | 'finishOperation' | 'clearError'
>;

export function useChatPageControllerActions({
  controllerState,
  currentError,
  baseSessionSnapshot,
  canInterrupt,
  canOpenExplorer,
  canSubmitPendingRequests,
  sendSessionMessage,
  interruptSessionTurn,
  submitSessionRequestResponse,
  workspaceExplorer,
}: {
  controllerState: OperationStateController;
  currentError: ReturnType<typeof buildChatPageViewModel>['currentError'];
  baseSessionSnapshot: ChatPageSessionSnapshot;
  canInterrupt: boolean;
  canOpenExplorer: boolean;
  canSubmitPendingRequests: boolean;
  sendSessionMessage: (input: SessionSendInput, options?: { collaborationModeKind?: string }) => Promise<boolean>;
  interruptSessionTurn: () => Promise<boolean>;
  submitSessionRequestResponse: (requestId: string, response: Record<string, unknown>) => Promise<boolean>;
  workspaceExplorer: {
    handleWorkspaceExplorerOpen: () => Promise<boolean>;
    handleWorkspaceExplorerNavigate: (path: string) => Promise<boolean>;
    handleWorkspaceFileOpen: (path: string) => Promise<boolean>;
    handleWorkspaceFileSave: () => Promise<boolean>;
    handleWorkspaceFileLinkOpen: (href: string) => Promise<boolean>;
  };
}) {
  const { operations, setSessionErrorHint, startOperation, finishOperation, clearError } = controllerState;

  function startAction(operation: ChatPageOperationKey, sessionErrorHint?: ChatPageErrorKind) {
    clearError();
    startOperation(operation);
    if (sessionErrorHint) {
      setSessionErrorHint(sessionErrorHint);
    }
  }

  function finishAction(operation: ChatPageOperationKey, clearSessionHint = false) {
    finishOperation(operation);
    if (clearSessionHint) {
      setSessionErrorHint(null);
    }
  }

  async function runAction(operation: ChatPageOperationKey, action: () => Promise<boolean>) {
    startAction(operation);
    try {
      return await action();
    } finally {
      finishAction(operation);
    }
  }

  async function sendMessage(input: SessionSendInput, options?: { collaborationModeKind?: string }) {
    const draft = String(input.text || '').trim() || (Array.isArray(input.content) && input.content.length ? '[image attachments]' : '');
    const sendViewModel = buildChatPageViewModel({
      currentError,
      draft,
      operations,
      session: baseSessionSnapshot,
    });

    if (!sendViewModel.guards.canSend) {
      return false;
    }

    startAction('send', 'send');
    try {
      const submitted = await sendSessionMessage(input, options);
      if (submitted) {
        setSessionErrorHint(null);
      }
      return submitted;
    } finally {
      finishAction('send');
    }
  }

  async function interruptTurn() {
    if (!canInterrupt) {
      return false;
    }

    startAction('interrupt', 'interrupt');
    try {
      const interrupted = await interruptSessionTurn();
      if (interrupted) {
        setSessionErrorHint(null);
      }
      return interrupted;
    } finally {
      finishAction('interrupt');
    }
  }

  async function submitRequestResponse(requestId: string, response: Record<string, unknown>) {
    if (!canSubmitPendingRequests) {
      return false;
    }

    startAction('pendingRequestSubmit', 'pending-request');
    try {
      const submitted = await submitSessionRequestResponse(requestId, response);
      if (submitted) {
        setSessionErrorHint(null);
      }
      return submitted;
    } finally {
      finishAction('pendingRequestSubmit');
    }
  }

  async function handleWorkspaceExplorerOpen() {
    if (!canOpenExplorer) {
      return false;
    }

    return runAction('workspaceFileOpen', workspaceExplorer.handleWorkspaceExplorerOpen);
  }

  return {
    runAction,
    sendMessage,
    interruptTurn,
    submitRequestResponse,
    handleWorkspaceExplorerOpen,
    handleWorkspaceExplorerNavigate: (path: string) =>
      runAction('workspaceFileOpen', () => workspaceExplorer.handleWorkspaceExplorerNavigate(path)),
    handleWorkspaceFileOpen: (path: string) =>
      runAction('workspaceFileOpen', () => workspaceExplorer.handleWorkspaceFileOpen(path)),
    handleWorkspaceFileSave: () => runAction('workspaceFileSave', workspaceExplorer.handleWorkspaceFileSave),
    handleWorkspaceFileLinkOpen: (href: string) =>
      runAction('workspaceFileOpen', () => workspaceExplorer.handleWorkspaceFileLinkOpen(href)),
  };
}

export type ChatPageControllerActionHandlers = ReturnType<typeof useChatPageControllerActions> & {
  handleReviewStart?: (payload: { delivery: 'inline' | 'detached'; target: ReviewStartTarget }) => Promise<boolean>;
};
