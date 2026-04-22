import { useCallback, useRef } from 'react';

import type { SessionStreamAssistantDelta } from '../../session-types';
import type { SessionAction } from '../../state/session-state';

const ASSISTANT_DELTA_BATCH_MS = 32;

export function useAssistantDeltaBatcher(dispatch: React.Dispatch<SessionAction>) {
  const assistantDeltaBufferRef = useRef(new Map<string, SessionStreamAssistantDelta>());
  const latestAssistantDeltaRef = useRef<SessionStreamAssistantDelta | null>(null);
  const assistantDeltaFlushTimerRef = useRef<number | null>(null);

  const clearAssistantDeltaFlushTimer = useCallback(() => {
    if (assistantDeltaFlushTimerRef.current === null) {
      return;
    }

    window.clearTimeout(assistantDeltaFlushTimerRef.current);
    assistantDeltaFlushTimerRef.current = null;
  }, []);

  const flushAssistantDeltas = useCallback(() => {
    clearAssistantDeltaFlushTimer();

    const payloads = Array.from(assistantDeltaBufferRef.current.values());
    const latestPayload = latestAssistantDeltaRef.current;
    assistantDeltaBufferRef.current.clear();
    latestAssistantDeltaRef.current = null;

    if (!payloads.length || !latestPayload) {
      return;
    }

    dispatch({ type: 'stream/assistant-deltas', payloads, latestPayload });
  }, [clearAssistantDeltaFlushTimer, dispatch]);

  const scheduleAssistantDeltaFlush = useCallback(() => {
    if (assistantDeltaFlushTimerRef.current !== null) {
      return;
    }

    assistantDeltaFlushTimerRef.current = window.setTimeout(() => {
      assistantDeltaFlushTimerRef.current = null;
      flushAssistantDeltas();
    }, ASSISTANT_DELTA_BATCH_MS);
  }, [flushAssistantDeltas]);

  const bufferAssistantDelta = useCallback(
    (payload: SessionStreamAssistantDelta) => {
      latestAssistantDeltaRef.current = payload;
      assistantDeltaBufferRef.current.set(payload.messageId, payload);
      scheduleAssistantDeltaFlush();
    },
    [scheduleAssistantDeltaFlush],
  );

  const resetAssistantDeltaBuffer = useCallback(() => {
    assistantDeltaBufferRef.current.clear();
    latestAssistantDeltaRef.current = null;
    clearAssistantDeltaFlushTimer();
  }, [clearAssistantDeltaFlushTimer]);

  return {
    bufferAssistantDelta,
    clearAssistantDeltaFlushTimer,
    flushAssistantDeltas,
    resetAssistantDeltaBuffer,
  };
}

