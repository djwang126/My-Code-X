import type { SessionAction, SessionState as SessionShellState } from '../../session/public-types';
import type { ChatPageRuntimeState } from '../types';
import type { ReviewStartTarget } from '../../thread-actions';
import { postAppRestart, waitForAppReady } from '../../app-control';
import { fetchTimelineItemContent } from '../../chat-transcript';
import { postReviewStart } from '../../thread-actions';
import { postThreadCompactStart, postThreadRollback } from '../../thread-actions';
import { isCurrentPageSlotOwner, SLOT_DISPLACED_MESSAGE } from '../../session';
import { reloadWindow } from '../../app-control';
import {
  createChatPageActionError,
  normalizeChatPageError,
} from '../state/chat-page-error-normalize';
import type { ChatPageErrorKind } from '../state/chat-page-state-types';
import type { Dispatch } from 'react';

type UseChatPageSessionActionsInput = {
  sessionDispatch: Dispatch<SessionAction>;
  sessionState: SessionShellState;
  state: ChatPageRuntimeState;
  resumeThread: (input: { workspace: string; threadId: string }) => void;
  forkFromMessage: (messageId: string) => Promise<string>;
  blockWorkspaceSwitchIfNeeded: () => boolean;
  reportError: (input: { kind: SessionActionErrorKind; message: string }) => boolean;
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
  resumeThread,
  forkFromMessage,
  blockWorkspaceSwitchIfNeeded,
  reportError,
}: UseChatPageSessionActionsInput) {
  function failSessionAction(input: { kind: SessionActionErrorKind; message: string }) {
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

        await postAppRestart({
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

        await postThreadCompactStart({
          slotId: sessionState.slotId,
          threadId: state.threadId,
          workspace: state.workspace,
        });
        return true;
      },
    });
  }

  async function handleReviewStart({
    delivery,
    target,
  }: {
    delivery: 'inline' | 'detached';
    target: ReviewStartTarget;
  }) {
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
          resumeThread({ workspace: state.workspace, threadId: result.reviewThreadId });
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

        const forkedThreadId = await forkFromMessage(messageId);

        if (!forkedThreadId) {
          return false;
        }

        resumeThread({ workspace: state.workspace, threadId: forkedThreadId });
        return true;
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

        await postThreadRollback({
          slotId: sessionState.slotId,
          threadId: state.threadId,
          workspace: state.workspace,
          numTurns: 1,
        });
        resumeThread({ workspace: state.workspace, threadId: state.threadId });
        return true;
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
