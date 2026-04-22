import { useEffect } from 'react';
import { isSessionExecutionTerminal } from '@my-code-x/contracts';

import { clearTranscriptCache, persistTranscriptCache } from '../lib/transcript-cache-storage';
import type { SessionState } from '../state/session-state';

export function useTranscriptCache(state: SessionState) {
  useEffect(() => {
    if (!state.threadId) {
      return;
    }

    if (isSessionExecutionTerminal(state.turnExecution)) {
      persistTranscriptCache({
        workspace: state.workspace,
        threadId: state.threadId,
        threadName: state.threadName,
        turnExecution: state.turnExecution,
        messages: state.messages,
      });
      return;
    }

    clearTranscriptCache(state.threadId);
  }, [state.messages, state.threadId, state.threadName, state.turnExecution, state.workspace]);
}
