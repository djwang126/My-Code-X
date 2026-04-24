import type { SessionAction, SessionState as SessionShellState } from '../../../features/session';
import type { ChatPageRuntimeState, ChatReviewStartInput } from '../types';
import { requestAppRestart, waitForAppReady } from '../../../features/tools/restart';
import { fetchTimelineItemContent } from '../../../features/chat/transcript';
import { postReviewStart } from '../../../features/tools/review';
import { isCurrentPageSlotOwner, SLOT_DISPLACED_MESSAGE } from '../../../features/session';
import { reloadWindow } from '../../../features/tools/restart';
import {
  createChatPageActionError,
  normalizeChatPageError,
} from '../state/error-normalize';
import type { ChatPageErrorKind } from '../state/page-state-types';
import type { Dispatch } from 'react';

type SessionActionErrorInput = {
  kind: SessionActionErrorKind;
  message: string;
};

type UseChatPageSessionActionsInput = {
  sessionDispatch: Dispatch<SessionAction>;
  sessionState: SessionShellState;
  state: ChatPageRuntimeState;
  threadActions: {
    resumeExistingThread: (input: { workspace: string; threadId: string }) => Promise<boolean>;
    compactThread: () => Promise<boolean>;
    forkFromMessage: (messageId: string) => Promise<string>;
    rollbackThread: () => Promise<boolean>;
  };
  blockWorkspaceSwitchIfNeeded: () => boolean;
  reportError: (input: SessionActionErrorInput) => boolean;
};

type SessionActionRequirement = {
  kind: SessionActionErrorKind;
  message: string;
};

type RunSessionActionInput = {
  action: () => Promise<boolean>;
  fallbackMessage: string;
  kind: SessionActionErrorKind;
};

export function useChatPageSessionActions({
  sessionDispatch,
  sessionState,
  state,
  threadActions,
  blockWorkspaceSwitchIfNeeded,
  reportError,
}: UseChatPageSessionActionsInput) {
  function failSessionAction(input: SessionActionErrorInput) {
    return reportError(input);
  }

  function assertSlotOwnership() {
    if (isCurrentPageSlotOwner(sessionState.slotId)) {
      return;
    }

    sessionDispatch({
      type: 'slot/displaced',
      viewerId: sessionState.viewerId,
      slotId: sessionState.slotId,
      errorMessage: SLOT_DISPLACED_MESSAGE,
    });
    throw createChatPageActionError({ kind: 'unknown', message: SLOT_DISPLACED_MESSAGE });
  }

  function assertWorkspace(input: SessionActionRequirement) {
    if (state.workspace.trim()) {
      return;
    }

    throw createChatPageActionError(input);
  }

  function assertThread(input: SessionActionRequirement) {
    if (state.threadId) {
      return;
    }

    throw createChatPageActionError(input);
  }

  async function runSessionAction(input: RunSessionActionInput) {
    try {
      return await input.action();
    } catch (error) {
      return failSessionAction(
        normalizeChatPageError({
          kind: input.kind,
          error,
          fallbackMessage: input.fallbackMessage,
        }),
      );
    }
  }

  async function handleRestart() {
    return runSessionAction({
      kind: 'restart',
      fallbackMessage: 'Failed to restart My-Code-X.',
      action: async () => {
        assertSlotOwnership();
        assertWorkspace({ kind: 'restart', message: 'Select a workspace before restarting.' });

        await requestAppRestart({
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          workspace: state.workspace,
          threadId: state.threadId,
        });
        await waitForAppReady({
          previousServerInstanceId: sessionState.serverInstanceId,
        });
        reloadWindow();
        return true;
      },
    });
  }

  async function handleCompact() {
    return runSessionAction({
      kind: 'compact',
      fallbackMessage: 'Failed to compact the thread.',
      action: async () => {
        assertSlotOwnership();
        assertThread({ kind: 'compact', message: 'No active thread to compact.' });

        return threadActions.compactThread();
      },
    });
  }

  async function handleReviewStart({ delivery, target }: ChatReviewStartInput) {
    return runSessionAction({
      kind: 'review-start',
      fallbackMessage: 'Failed to start the review.',
      action: async () => {
        assertSlotOwnership();
        assertThread({ kind: 'review-start', message: 'No active thread to review.' });

        const result = await postReviewStart({
          slotId: sessionState.slotId,
          threadId: state.threadId,
          workspace: state.workspace,
          delivery,
          target,
        });

        if (delivery === 'detached' && result.reviewThreadId) {
          return threadActions.resumeExistingThread({
            workspace: state.workspace,
            threadId: result.reviewThreadId,
          });
        }

        return true;
      },
    });
  }

  async function handleMessageFork(messageId: string) {
    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    return runSessionAction({
      kind: 'message-fork',
      fallbackMessage: 'Failed to fork from the selected message.',
      action: async () => {
        assertSlotOwnership();
        assertThread({ kind: 'message-fork', message: 'No active thread to fork.' });

        return Boolean(await threadActions.forkFromMessage(messageId));
      },
    });
  }

  async function handleTimelineItemContentLoad(itemId: string) {
    if (!state.threadId) {
      throw createChatPageActionError({ kind: 'unknown', message: 'No active thread.' });
    }

    const payload = await fetchTimelineItemContent({
      slotId: sessionState.slotId,
      threadId: state.threadId,
      itemId,
    });

    return payload;
  }

  async function handleRollback() {
    return runSessionAction({
      kind: 'rollback',
      fallbackMessage: 'Failed to roll back the active thread.',
      action: async () => {
        assertSlotOwnership();
        assertThread({ kind: 'rollback', message: 'No active thread to rollback.' });

        return threadActions.rollbackThread();
      },
    });
  }

  return {
    failSessionAction,
    handleRestart,
    handleCompact,
    handleReviewStart,
    handleMessageFork,
    handleTimelineItemContentLoad,
    handleRollback,
  };
}

type SessionActionErrorKind =
  Extract<ChatPageErrorKind, 'restart' | 'compact' | 'review-start' | 'rollback' | 'message-fork' | 'unknown'>;
