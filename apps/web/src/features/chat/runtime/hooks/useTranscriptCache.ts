import { useEffect } from 'react';
import { isChatTurnTerminal } from '@my-code-x/contracts';

import { clearTranscriptCache, persistTranscriptCache } from '../lib/transcript-cache-storage';
import type { ChatRuntimeState } from '../state/chat-runtime-state';

export function useTranscriptCache(state: ChatRuntimeState) {
  useEffect(() => {
    if (!state.threadId) {
      return;
    }

    if (isChatTurnTerminal(state.latestTurn)) {
      persistTranscriptCache({
        workspace: state.workspace,
        threadId: state.threadId,
        threadName: state.threadName,
        latestTurn: state.latestTurn,
        messages: state.messages,
      });
      return;
    }

    clearTranscriptCache(state.threadId);
  }, [state.latestTurn, state.messages, state.threadId, state.threadName, state.workspace]);
}
