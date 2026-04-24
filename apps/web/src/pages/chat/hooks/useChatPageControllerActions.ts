import type { SessionSendInput } from '../../../features/chat/runtime';
import type { ChatReviewStartInput } from '../types';
import type { UseChatPageControllerStateResult } from './useChatPageControllerState';
import { buildChatPageViewModel } from '../state/view-model';
import type { ChatPageErrorKind, ChatPageOperationKey, ChatPageSessionSnapshot } from '../state/page-state-types';

type OperationStateController = Pick<
  UseChatPageControllerStateResult,
  'operations' | 'setSessionErrorHint' | 'startOperation' | 'finishOperation' | 'clearError'
>;

type UseChatPageControllerActionsInput = {
  controllerState: OperationStateController;
  currentError: ReturnType<typeof buildChatPageViewModel>['currentError'];
  baseSessionSnapshot: ChatPageSessionSnapshot;
  canInterrupt: boolean;
  canOpenExplorer: boolean;
  canSubmitPendingRequests: boolean;
  sendSessionMessage: (input: SessionSendInput, options?: { collaborationModeKind?: string }) => Promise<boolean>;
  interruptChatTurn: () => Promise<boolean>;
  submitSessionRequestResponse: (requestId: string, response: Record<string, unknown>) => Promise<boolean>;
  workspaceExplorer: {
    handleWorkspaceExplorerOpen: () => Promise<boolean>;
    handleWorkspaceExplorerNavigate: (path: string) => Promise<boolean>;
    handleWorkspaceFileOpen: (path: string) => Promise<boolean>;
    handleWorkspaceTextEditStart: () => Promise<boolean>;
    handleWorkspaceFileSave: () => Promise<boolean>;
    handleWorkspaceFileLinkOpen: (href: string) => Promise<boolean>;
  };
};

export function useChatPageControllerActions({
  controllerState,
  currentError,
  baseSessionSnapshot,
  canInterrupt,
  canOpenExplorer,
  canSubmitPendingRequests,
  sendSessionMessage,
  interruptChatTurn,
  submitSessionRequestResponse,
  workspaceExplorer,
}: UseChatPageControllerActionsInput) {
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
    let interruptAccepted = false;
    try {
      const interrupted = await interruptChatTurn();
      if (interrupted) {
        interruptAccepted = true;
        setSessionErrorHint(null);
        return true;
      }
      return false;
    } finally {
      if (!interruptAccepted) {
        finishAction('interrupt');
      }
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
    handleWorkspaceTextEditStart: () => runAction('workspaceFileOpen', workspaceExplorer.handleWorkspaceTextEditStart),
    handleWorkspaceFileSave: () => runAction('workspaceFileSave', workspaceExplorer.handleWorkspaceFileSave),
    handleWorkspaceFileLinkOpen: (href: string) =>
      runAction('workspaceFileOpen', () => workspaceExplorer.handleWorkspaceFileLinkOpen(href)),
  };
}

export type ChatPageControllerActionHandlers = ReturnType<typeof useChatPageControllerActions> & {
  handleReviewStart?: (payload: ChatReviewStartInput) => Promise<boolean>;
};
