import { useCallback, useRef } from 'react';

import { postChatInterrupt, postChatMessage } from '../api/chat-turn-api';
import { normalizeCollaborationModeKind } from '../../../../shared/lib/collaboration-mode';
import {
  SLOT_DISPLACED_MESSAGE,
  isCurrentPageSlotOwner,
  useSessionDispatch as useSessionShellDispatch,
} from '../../../session';
import { useSessionSelection } from '../../../session/selection';
import {
  normalizeRuntimeSettings,
  readRuntimeOptions,
  readRuntimeSettings,
  validateRuntimeSettings,
} from '../../settings';
import { useChatRuntimeDispatch } from '../components/ChatRuntimeProvider';
import type { ChatRuntimeState } from '../state/chat-runtime-state';
import type { SessionSendInput } from '../session-types';
import type { SessionState as SessionShellState } from '../../../session/public-types';
import { canInterruptForRuntimeOperation, canSendForRuntimeOperation } from '../state/chat-turn-state';
import type { ThreadActionState } from '../../thread-actions';

function isClientSendDebugEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.localStorage.getItem('my-code-x-debug-stream-timing') === '1' ||
      window.sessionStorage.getItem('my-code-x-debug-stream-timing') === '1'
    );
  } catch {
    return false;
  }
}

function logClientSendDebug(stage: string, details: Record<string, unknown> = {}) {
  if (!isClientSendDebugEnabled()) {
    return;
  }

  console.info('[my-code-x-debug]', {
    ts: new Date().toISOString(),
    scope: 'client-send',
    stage,
    ...details,
  });
}

export function useChatSend(
  state: ChatRuntimeState,
  sessionState: SessionShellState,
  { threadAction = { status: 'idle' } }: { threadAction?: ThreadActionState } = {},
) {
  const dispatch = useChatRuntimeDispatch();
  const sessionDispatch = useSessionShellDispatch();
  const { selectThread } = useSessionSelection();
  const submitInFlightRef = useRef(false);
  const interruptInFlightRef = useRef(false);

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

  const sendMessage = useCallback(
    async (input: SessionSendInput, options?: { collaborationModeKind?: string }) => {
      const text = String(input.text || '').trim();
      const content = Array.isArray(input.content) ? input.content : undefined;
      const hasContent = Boolean(content?.length);

      if (sessionState.phase !== 'ready') return false;
      if (!sessionState.workspace) return false;
      if (threadAction.status !== 'idle') return false;
      if (!canSendForRuntimeOperation({ latestTurn: state.latestTurn, operations: state.operations })) return false;
      if (!text && !hasContent) return false;
      if (submitInFlightRef.current) return false;
      if (displaceIfSlotTakenOver()) return false;

      const runtimeSettings = readRuntimeSettings(state.preferences);
      const runtimeOptions = readRuntimeOptions(state.options);
      const runtimeValidationError = validateRuntimeSettings(runtimeSettings, runtimeOptions);

      if (runtimeValidationError) {
        dispatch({
          type: 'send/failed',
          errorMessage: runtimeValidationError,
        });
        return false;
      }

      submitInFlightRef.current = true;
      dispatch({ type: 'send/requested' });

      try {
        const startedAt = Date.now();
        logClientSendDebug('request_started', {
          slotId: sessionState.slotId,
          threadId: state.threadId,
          textLength: text.length,
        });
        const nextRuntimeSettings = runtimeSettings
          ? normalizeRuntimeSettings({
              ...runtimeSettings,
              ...(options && Object.prototype.hasOwnProperty.call(options, 'collaborationModeKind')
                ? {
                    collaborationModeKind: options.collaborationModeKind
                      ? normalizeCollaborationModeKind(options.collaborationModeKind)
                      : null,
                  }
                : {}),
            })
          : undefined;
        const payload = await postChatMessage({
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          workspace: sessionState.workspace,
          threadId: state.threadId || undefined,
          ...(hasContent ? { content } : { text }),
          runtimeSettings: nextRuntimeSettings,
        });
        selectThread({ workspace: sessionState.workspace, threadId: payload.threadId });
        dispatch({
          type: 'send/succeeded',
          payload,
          acceptedText: text,
        });
        logClientSendDebug('request_succeeded', {
          slotId: sessionState.slotId,
          threadId: payload.threadId,
          turnId: payload.turn.id,
          durationMs: Date.now() - startedAt,
        });
        return true;
      } catch (error) {
        logClientSendDebug('request_failed', {
          slotId: sessionState.slotId,
          threadId: state.threadId,
          error: error instanceof Error ? error.message : String(error),
        });
        dispatch({
          type: 'send/failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        return false;
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [
      dispatch,
      displaceIfSlotTakenOver,
      selectThread,
      sessionState.phase,
      sessionState.slotId,
      sessionState.viewerId,
      sessionState.workspace,
      state.options,
      state.operations,
      state.preferences,
      state.threadId,
      state.latestTurn,
      threadAction.status,
    ],
  );

  const interruptTurn = useCallback(async () => {
    if (sessionState.phase !== 'ready') return false;
    if (!state.threadId) return false;
    if (!canInterruptForRuntimeOperation({ latestTurn: state.latestTurn, operations: state.operations })) return false;
    if (interruptInFlightRef.current) return false;
    if (displaceIfSlotTakenOver()) return false;

    interruptInFlightRef.current = true;
    dispatch({ type: 'interrupt/requested' });

    try {
      const payload = await postChatInterrupt({
        slotId: sessionState.slotId,
        threadId: state.threadId,
      });
      dispatch({
        type: 'interrupt/succeeded',
        payload,
      });
      return true;
    } catch (error) {
      dispatch({
        type: 'interrupt/failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      interruptInFlightRef.current = false;
    }
  }, [
    dispatch,
    displaceIfSlotTakenOver,
    sessionState.phase,
    sessionState.slotId,
    state.latestTurn,
    state.operations,
    state.threadId,
  ]);

  return {
    interruptTurn,
    sendMessage,
  };
}
