import { useCallback } from 'react';

import { postServerRequestResponse } from '../api/session-request-api';
import { useSessionDispatch } from '../components/SessionProvider';
import { SLOT_DISPLACED_MESSAGE, isCurrentPageSlotOwner, useSessionDispatch as useSessionShellDispatch } from '../../session';
import type { SessionState } from '../state/session-state';
import type { SessionState as SessionShellState } from '../../session/public-types';

export function useSessionRequests(state: SessionState, sessionState: SessionShellState) {
  const dispatch = useSessionDispatch();
  const sessionDispatch = useSessionShellDispatch();

  const submitRequestResponse = useCallback(
    async (requestId: string, response: Record<string, unknown>) => {
      if (sessionState.phase !== 'ready') return false;

      const pendingRequest = state.pendingRequests.find(request => request.id === requestId);

      if (!pendingRequest) return false;
      if (pendingRequest.submitState === 'submitting') return false;
      if (!isCurrentPageSlotOwner(sessionState.slotId)) {
        sessionDispatch({
          type: 'slot/displaced',
          viewerId: sessionState.viewerId,
          slotId: sessionState.slotId,
          errorMessage: SLOT_DISPLACED_MESSAGE,
        });
        return false;
      }

      dispatch({ type: 'request/submission-started', requestId });

      try {
        await postServerRequestResponse({
          slotId: sessionState.slotId,
          threadId: pendingRequest.threadId,
          requestId,
          response,
        });
        return true;
      } catch (error) {
        dispatch({
          type: 'request/submission-failed',
          requestId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    [dispatch, sessionDispatch, sessionState.phase, sessionState.slotId, sessionState.viewerId, state.pendingRequests],
  );

  return {
    submitRequestResponse,
  };
}
