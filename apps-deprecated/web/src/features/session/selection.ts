import { useCallback } from 'react';

import { rememberWorkspaceThread } from '../workspace/bookmarks';
import { useSessionDispatch, useSessionState } from './context';
import { setActiveWorkspacePath, synchronizeStoredThreadId } from './lib/session-selection-storage';

type SessionSelectionInput = {
  workspace: string;
  threadId: string;
};

export function useSessionSelection() {
  const dispatch = useSessionDispatch();
  const state = useSessionState();

  const updateSelection = useCallback(
    ({ workspace, threadId }: SessionSelectionInput) => {
      setActiveWorkspacePath(state.slotId, workspace);
      synchronizeStoredThreadId(state.slotId, threadId);
      dispatch({ type: 'selection/updated', workspace, threadId });

      if (workspace.trim() && threadId.trim()) {
        rememberWorkspaceThread({ path: workspace, threadId });
      }
    },
    [dispatch, state.slotId],
  );

  const selectWorkspace = useCallback(
    (workspace: string) => {
      updateSelection({ workspace, threadId: '' });
    },
    [updateSelection],
  );

  const selectThread = useCallback(
    ({ workspace, threadId }: SessionSelectionInput) => {
      updateSelection({ workspace, threadId });
    },
    [updateSelection],
  );

  const clearThread = useCallback(() => {
    updateSelection({ workspace: state.workspace, threadId: '' });
  }, [state.workspace, updateSelection]);

  return {
    updateSelection,
    selectWorkspace,
    selectThread,
    clearThread,
  };
}
