import { useEffect, useMemo } from 'react';

import {
  useCollaborationModeController,
  useChatEventStream,
  useChatRequests,
  useChatRuntimeDispatch,
  useChatRuntimeState,
  useChatSend,
  useTranscriptCache,
} from '../../chat-runtime';
import { uploadImageAttachment } from '../../chat-attachments';
import { useWorkspaceFileExplorer } from '../../workspace-files';
import type { ReviewStartTarget } from '../../thread-actions';
import {
  SLOT_DISPLACED_MESSAGE,
  isCurrentPageSlotOwner,
  useSessionBootstrap,
  useSessionDispatch,
  useSessionState,
} from '../../session';
import { useChatPageControllerActions } from './useChatPageControllerActions';
import { useChatPageControllerState } from './useChatPageControllerState';
import { useChatPageRuntimeViewModel, useChatPageSessionSnapshot } from './useChatPageControllerViewModel';
import { useChatPageRuntimeSettings } from './useChatPageRuntimeSettings';
import { useChatPageSessionActions } from './useChatPageSessionActions';
import { useChatPageWorkspaceManager } from './useChatPageWorkspaceManager';
import type { ChatPageRuntimeState } from '../types';
import type { ChatPageErrorKind } from '../state/chat-page-state-types';

export function useChatPageController() {
  const { startFresh, retryBootstrap, openWorkspace, resumeWorkspace, resumeThread } = useSessionBootstrap({ autoStart: false });
  const sessionState = useSessionState();
  const sessionDispatch = useSessionDispatch();
  const chatState = useChatRuntimeState();
  const chatDispatch = useChatRuntimeDispatch();
  const { sendMessage: sendSessionMessage, interruptTurn: interruptSessionTurn, forkFromMessage } = useChatSend(chatState, sessionState);
  const { submitRequestResponse: submitSessionRequestResponse } = useChatRequests(chatState, sessionState);

  useChatEventStream(chatState, sessionState);
  useTranscriptCache(chatState);

  const state = useMemo<ChatPageRuntimeState>(() => {
    const activeThreadId = chatState.threadId || sessionState.threadId;
    const ready = sessionState.phase === 'ready';

    return {
      phase: sessionState.phase,
      viewerId: sessionState.viewerId,
      slotId: sessionState.slotId,
      workspace: sessionState.workspace,
      threadId: activeThreadId,
      serverInstanceId: sessionState.serverInstanceId,
      statusMessage: ready ? chatState.threadStatusText || chatState.statusMessage : sessionState.statusMessage,
      errorMessage: ready ? chatState.errorMessage : sessionState.errorMessage,
      turnExecution: chatState.turnExecution,
      threadName: chatState.threadName,
      threadStatusText: chatState.threadStatusText,
      tokenUsageText: chatState.tokenUsageText,
      notices: chatState.notices,
      pendingRequests: chatState.pendingRequests,
      messages: chatState.messages,
      preferences: chatState.preferences,
      options: chatState.options,
    };
  }, [chatState, sessionState]);

  const { runtimeSettings, runtimeOptions, handleRuntimeSettingsChange } = useChatPageRuntimeSettings({
    sessionState,
    chatState,
    chatDispatch,
    sessionDispatch,
  });
  const { baseSessionSnapshot, baseInteractionState } = useChatPageSessionSnapshot(state);
  const controllerState = useChatPageControllerState({
    interactionState: baseInteractionState,
    sessionErrorMessage: state.errorMessage,
  });
  const { operations, currentError, setOperationPending, recordError } = controllerState;
  const controllerViewModel = useChatPageRuntimeViewModel({
    currentError,
    operations,
    session: baseSessionSnapshot,
  });

  useEffect(() => {
    setOperationPending('bootstrap', sessionState.phase === 'loading');
  }, [sessionState.phase, setOperationPending]);

  function reportError(input: { kind: ChatPageErrorKind; message: string }) {
    return recordError(input);
  }

  const workspaceManager = useChatPageWorkspaceManager({
    state,
    workspaceSwitchReason: controllerViewModel.workspaceSwitchReason,
    startFresh,
    openWorkspace,
    resumeWorkspace,
    resumeThread,
    reportError,
  });
  const sessionActions = useChatPageSessionActions({
    sessionDispatch,
    sessionState,
    state,
    resumeThread,
    forkFromMessage,
    blockWorkspaceSwitchIfNeeded: workspaceManager.blockWorkspaceSwitchIfNeeded,
    reportError,
  });
  const workspaceExplorer = useWorkspaceFileExplorer({
    workspace: state.workspace,
    onError: (message, kind = 'workspace-file-open') => reportError({ kind, message }),
  });

  useEffect(() => {
    setOperationPending('threadHistoryLoad', workspaceManager.threadHistoryLoading);
  }, [setOperationPending, workspaceManager.threadHistoryLoading]);

  const actionHandlers = useChatPageControllerActions({
    controllerState,
    currentError,
    baseSessionSnapshot,
    canInterrupt: controllerViewModel.runtimeViewModel.guards.canInterrupt,
    canOpenExplorer: controllerViewModel.runtimeViewModel.guards.canOpenExplorer,
    canSubmitPendingRequests: controllerViewModel.runtimeViewModel.guards.canSubmitPendingRequests,
    sendSessionMessage,
    interruptSessionTurn,
    submitSessionRequestResponse,
    workspaceExplorer,
  });
  const {
    canCycleCollaborationMode,
    collaborationModeLabel,
    handleCycleCollaborationMode,
    handleConfirmProposedPlanAction,
    handleDismissProposedPlanAction,
  } = useCollaborationModeController({
    state: chatState,
    sendMessage: actionHandlers.sendMessage,
    onRuntimeSettingsChange: handleRuntimeSettingsChange,
  });

  return {
    state,
    retryBootstrap,
    runtimeSettings,
    runtimeOptions,
    savedWorkspaces: workspaceManager.savedWorkspaces,
    threadHistory: workspaceManager.threadHistory,
    threadHistoryLoading: workspaceManager.threadHistoryLoading,
    threadHistoryError: workspaceManager.threadHistoryError,
    isRestarting: operations.restart === 'pending',
    interruptPending: operations.interrupt === 'pending',
    interactionState: controllerViewModel.runtimeViewModel.interactionState,
    actionBlocked: controllerViewModel.runtimeViewModel.actionBlocked,
    inputDisabled: controllerViewModel.runtimeViewModel.inputDisabled,
    sendButtonDisabled: controllerViewModel.runtimeViewModel.sendButtonDisabled || operations.interrupt === 'pending',
    currentError: controllerViewModel.runtimeViewModel.currentError,
    workspaceSwitchReason: controllerViewModel.workspaceSwitchReason,
    workspaceExplorerOpen: workspaceExplorer.workspaceExplorerOpen,
    workspaceExplorerLoading: workspaceExplorer.workspaceExplorerLoading,
    workspaceExplorerError: workspaceExplorer.workspaceExplorerError,
    workspaceExplorerNotice: workspaceExplorer.workspaceExplorerNotice,
    workspaceExplorerPath: workspaceExplorer.workspaceExplorerPath,
    workspaceExplorerEntries: workspaceExplorer.workspaceExplorerEntries,
    workspaceFileDetail: workspaceExplorer.workspaceFileDetail,
    workspaceFileDraft: workspaceExplorer.workspaceFileDraft,
    workspaceFileDirty: workspaceExplorer.workspaceFileDirty,
    workspaceFileSaving: workspaceExplorer.workspaceFileSaving,
    canCycleCollaborationMode,
    collaborationModeLabel,
    setWorkspaceFileDraft: workspaceExplorer.setWorkspaceFileDraft,
    interruptTurn: actionHandlers.interruptTurn,
    submitRequestResponse: actionHandlers.submitRequestResponse,
    handleCompact: () => actionHandlers.runAction('compact', sessionActions.handleCompact),
    handleConfirmProposedPlanAction,
    handleCycleCollaborationMode,
    handleDismissProposedPlanAction,
    handleMessageFork: sessionActions.handleMessageFork,
    handleNewThread: () => actionHandlers.runAction('workspaceSwitch', workspaceManager.handleNewThread),
    handleRestart: () => actionHandlers.runAction('restart', sessionActions.handleRestart),
    handleReviewStart: (payload: { delivery: 'inline' | 'detached'; target: ReviewStartTarget }) =>
      actionHandlers.runAction('reviewStart', () => sessionActions.handleReviewStart(payload)),
    handleRollback: () => actionHandlers.runAction('rollback', sessionActions.handleRollback),
    handleRuntimeSettingsChange,
    handleThreadHistoryOpen: (threadId: string) =>
      actionHandlers.runAction('workspaceSwitch', () => workspaceManager.handleThreadHistoryOpen(threadId)),
    handleTimelineItemContentLoad: sessionActions.handleTimelineItemContentLoad,
    handleWorkspaceExplorerClose: workspaceExplorer.handleWorkspaceExplorerClose,
    handleWorkspaceExplorerNavigate: actionHandlers.handleWorkspaceExplorerNavigate,
    handleWorkspaceExplorerOpen: actionHandlers.handleWorkspaceExplorerOpen,
    handleWorkspaceFileLinkOpen: actionHandlers.handleWorkspaceFileLinkOpen,
    isWorkspaceFileLink: workspaceExplorer.isWorkspaceFileLink,
    handleWorkspaceFileOpen: actionHandlers.handleWorkspaceFileOpen,
    handleWorkspaceFileSave: actionHandlers.handleWorkspaceFileSave,
    handleWorkspaceOpen: (workspacePath: string) =>
      actionHandlers.runAction('workspaceSwitch', () => workspaceManager.handleWorkspaceOpen(workspacePath)),
    handleWorkspaceRemove: workspaceManager.handleWorkspaceRemove,
    handleWorkspaceResume: (workspacePath: string) =>
      actionHandlers.runAction('workspaceSwitch', () => workspaceManager.handleWorkspaceResume(workspacePath)),
    handleWorkspaceSave: workspaceManager.handleWorkspaceSave,
    handleAttachmentUpload: (file: File) => {
      if (!isCurrentPageSlotOwner(sessionState.slotId)) {
        sessionDispatch({
          type: 'slot/displaced',
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          errorMessage: SLOT_DISPLACED_MESSAGE,
        });
        return Promise.reject(new Error(SLOT_DISPLACED_MESSAGE));
      }

      return uploadImageAttachment({
        file,
        slotId: sessionState.slotId,
        threadId: state.threadId || undefined,
      });
    },
    sendMessage: actionHandlers.sendMessage,
  };
}
