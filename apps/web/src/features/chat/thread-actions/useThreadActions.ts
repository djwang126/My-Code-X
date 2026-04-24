import { useCallback, useEffect, useReducer } from 'react';

import {
  postThreadCompactStart,
  postThreadFork,
  postThreadResume,
  postThreadRollback,
  postThreadStart,
} from './thread-action-api';
import { observeCompactThreadAction } from './compact-state';
import { useChatRuntimeDispatch } from '../runtime/components/ChatRuntimeProvider';
import { canSendForRuntimeOperation } from '../runtime/state/chat-turn-state';
import {
  normalizeRuntimeSettings,
  readRuntimeOptions,
  readRuntimeSettings,
  validateRuntimeSettings,
} from '../settings';
import {
  useSessionDispatch as useSessionShellDispatch,
  SLOT_DISPLACED_MESSAGE,
  isCurrentPageSlotOwner,
} from '../../session';
import { useSessionSelection } from '../../session/selection';
import { getPreservedTurnCountForForkTarget } from './fork-turn-count';
import type { ChatRuntimeState, SessionStreamSnapshot } from '../runtime';
import type { SessionState as SessionShellState } from '../../session/public-types';
import {
  createIdleThreadActionState,
  type ThreadActionState,
} from './thread-action-state';

type StartThreadInput = {
  workspace: string;
};

type ResumeThreadInput = {
  workspace: string;
  threadId: string;
};

type UseThreadActionsInput = {
  state: ChatRuntimeState;
  sessionState: SessionShellState;
};

type ThreadActionReducerAction =
  | { type: 'threadAction/set'; state: ThreadActionState }
  | { type: 'threadAction/reset' };

function threadActionReducer(state: ThreadActionState, action: ThreadActionReducerAction): ThreadActionState {
  if (action.type === 'threadAction/reset') {
    return createIdleThreadActionState();
  }

  return action.state;
}

export function useThreadActions({ state, sessionState }: UseThreadActionsInput) {
  const dispatch = useChatRuntimeDispatch();
  const sessionDispatch = useSessionShellDispatch();
  const { selectThread } = useSessionSelection();
  const [threadAction, dispatchThreadAction] = useReducer(
    threadActionReducer,
    undefined,
    createIdleThreadActionState,
  );

  const setThreadAction = useCallback((nextThreadAction: ThreadActionState) => {
    dispatchThreadAction({ type: 'threadAction/set', state: nextThreadAction });
  }, []);

  const resetThreadActionState = useCallback(() => {
    dispatchThreadAction({ type: 'threadAction/reset' });
  }, []);

  const beginThreadAction = useCallback(
    (nextThreadAction: Exclude<ThreadActionState, { status: 'idle' }>) => {
      if (threadAction.status !== 'idle') {
        return false;
      }

      setThreadAction(nextThreadAction);
      return true;
    },
    [setThreadAction, threadAction.status],
  );

  const displaceIfSlotTakenOver = useCallback(() => {
    if (isCurrentPageSlotOwner(sessionState.slotId)) {
      return false;
    }

    sessionDispatch({
      type: 'slot/displaced',
      viewerId: sessionState.viewerId,
      slotId: sessionState.slotId,
      errorMessage: SLOT_DISPLACED_MESSAGE,
    });
    return true;
  }, [sessionDispatch, sessionState.slotId, sessionState.viewerId]);

  const applySnapshot = useCallback(
    (snapshot: SessionStreamSnapshot) => {
      dispatch({ type: 'stream/snapshot', payload: snapshot });
    },
    [dispatch],
  );

  const readValidatedRuntimeSettings = useCallback(() => {
    const runtimeSettings = readRuntimeSettings(state.preferences);
    const runtimeOptions = readRuntimeOptions(state.options);
    const runtimeValidationError = validateRuntimeSettings(runtimeSettings, runtimeOptions);

    if (runtimeValidationError) {
      throw new Error(runtimeValidationError);
    }

    return runtimeSettings ? normalizeRuntimeSettings(runtimeSettings) : undefined;
  }, [state.options, state.preferences]);

  useEffect(() => {
    if (threadAction.status !== 'compacting-thread') {
      return;
    }

    const nextThreadAction = observeCompactThreadAction({
      action: threadAction,
      errorDetail: state.errorDetail,
      latestTurn: state.latestTurn,
      messages: state.messages,
      notices: state.notices,
      threadId: state.threadId,
    });

    if (nextThreadAction !== threadAction) {
      setThreadAction(nextThreadAction);
    }
  }, [setThreadAction, state.errorDetail, state.latestTurn, state.messages, state.notices, state.threadId, threadAction]);

  const canRunThreadAction = useCallback(() => {
    if (sessionState.phase !== 'ready') return false;
    if (!sessionState.workspace) return false;
    if (threadAction.status !== 'idle') return false;
    if ((state.pendingRequests?.length ?? 0) > 0) return false;
    if (!canSendForRuntimeOperation({ latestTurn: state.latestTurn, operations: state.operations })) return false;
    if (displaceIfSlotTakenOver()) return false;
    return true;
  }, [
    displaceIfSlotTakenOver,
    sessionState.phase,
    sessionState.workspace,
    state.latestTurn,
    state.operations,
    state.pendingRequests,
    threadAction.status,
  ]);

  const startThread = useCallback(
    async ({ workspace }: StartThreadInput) => {
      const nextWorkspace = workspace.trim();
      if (!nextWorkspace) return false;
      if (!canRunThreadAction()) return false;
      if (!beginThreadAction({ status: 'starting-thread' })) {
        return false;
      }

      try {
        const payload = await postThreadStart({
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          workspace: nextWorkspace,
          runtimeSettings: readValidatedRuntimeSettings(),
        });
        selectThread({ workspace: nextWorkspace, threadId: payload.threadId });
        applySnapshot(payload.snapshot);
        return true;
      } finally {
        resetThreadActionState();
      }
    },
    [
      applySnapshot,
      beginThreadAction,
      canRunThreadAction,
      readValidatedRuntimeSettings,
      resetThreadActionState,
      selectThread,
      sessionState.slotId,
      sessionState.viewerId,
    ],
  );

  const compactThread = useCallback(async () => {
    if (!state.threadId) return false;
    if (!canRunThreadAction()) return false;
    if (
      !beginThreadAction({
        status: 'compacting-thread',
        threadId: state.threadId,
        observedTurnId: null,
        observedCompactionSignal: false,
      })
    ) {
      return false;
    }

    try {
      await postThreadCompactStart({
        slotId: sessionState.slotId,
        threadId: state.threadId,
        workspace: sessionState.workspace,
      });
      return true;
    } catch (error) {
      resetThreadActionState();
      throw error;
    }
  }, [
    beginThreadAction,
    canRunThreadAction,
    resetThreadActionState,
    sessionState.slotId,
    sessionState.workspace,
    state.threadId,
  ]);

  const rollbackThread = useCallback(async () => {
    if (!state.threadId) return false;
    if (!canRunThreadAction()) return false;

    const targetThreadId = state.threadId;
    if (!beginThreadAction({ status: 'rolling-back-thread', threadId: targetThreadId })) {
      return false;
    }

    try {
      const payload = await postThreadRollback({
        slotId: sessionState.slotId,
        threadId: targetThreadId,
        workspace: sessionState.workspace,
        numTurns: 1,
      });
      applySnapshot(payload.snapshot);
      return true;
    } finally {
      resetThreadActionState();
    }
  }, [
    applySnapshot,
    beginThreadAction,
    canRunThreadAction,
    resetThreadActionState,
    sessionState.slotId,
    sessionState.workspace,
    state.threadId,
  ]);

  const forkFromMessage = useCallback(
    async (messageId: string) => {
      if (!state.threadId) return '';
      if (!canRunThreadAction()) return '';

      const preservedTurnCount = getPreservedTurnCountForForkTarget(state.messages, messageId);
      if (!preservedTurnCount) return '';

      const sourceThreadId = state.threadId;
      if (!beginThreadAction({ status: 'forking-thread', threadId: sourceThreadId })) {
        return '';
      }

      try {
        const payload = await postThreadFork({
          slotId: sessionState.slotId,
          threadId: sourceThreadId,
          workspace: sessionState.workspace,
          preservedTurnCount,
        });
        selectThread({ workspace: sessionState.workspace, threadId: payload.threadId });
        applySnapshot(payload.snapshot);
        return payload.threadId;
      } finally {
        resetThreadActionState();
      }
    },
    [
      applySnapshot,
      beginThreadAction,
      canRunThreadAction,
      resetThreadActionState,
      selectThread,
      sessionState.slotId,
      sessionState.workspace,
      state.messages,
      state.threadId,
    ],
  );

  const resumeExistingThread = useCallback(
    async ({ workspace, threadId }: ResumeThreadInput) => {
      const nextWorkspace = workspace.trim();
      if (!threadId) return false;
      if (!nextWorkspace) return false;
      if (!canRunThreadAction()) return false;
      if (!beginThreadAction({ status: 'resuming-thread', threadId })) return false;

      try {
        const payload = await postThreadResume({
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          threadId,
          workspace: nextWorkspace,
          runtimeSettings: readValidatedRuntimeSettings(),
        });
        selectThread({ workspace: nextWorkspace, threadId: payload.threadId });
        applySnapshot(payload.snapshot);
        return true;
      } finally {
        resetThreadActionState();
      }
    },
    [
      applySnapshot,
      beginThreadAction,
      canRunThreadAction,
      readValidatedRuntimeSettings,
      resetThreadActionState,
      selectThread,
      sessionState.slotId,
      sessionState.viewerId,
    ],
  );

  return {
    startThread,
    compactThread,
    forkFromMessage,
    resumeExistingThread,
    rollbackThread,
    threadAction,
  };
}
