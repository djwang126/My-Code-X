import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { useChatPageControllerActions } from './useChatPageControllerActions';
import { useChatPageControllerState } from './useChatPageControllerState';

describe('useChatPageControllerActions pending request error routing', () => {
  it('keeps pending-request submission failures typed as shared chatpage errors', async () => {
    const submitSessionRequestResponse = vi.fn().mockResolvedValue(false);

    const { result, rerender } = renderHook(
      ({ sessionErrorMessage }) => {
        const controllerState = useChatPageControllerState({
          interactionState: 'awaiting-requests',
          sessionErrorMessage,
        });
        const actions = useChatPageControllerActions({
          controllerState,
          currentError: controllerState.currentError,
          baseSessionSnapshot: {
            phase: 'ready',
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-user-input',
            latestTurn: parseChatTurn({
              turnId: 'turn-user-input',
              status: 'inProgress',
            }),
            pendingRequests: [
              {
                id: 'req-input',
                method: 'item/tool/requestUserInput',
                kind: 'user_input',
                threadId: 'thread-user-input',
                turnId: 'turn-user-input',
                title: 'Answer 1 question',
                prompt: '',
                submitState: 'idle',
              },
            ],
          },
          canInterrupt: false,
          canOpenExplorer: false,
          canSubmitPendingRequests: true,
          sendSessionMessage: async () => false,
          interruptChatTurn: async () => false,
          submitSessionRequestResponse,
          workspaceExplorer: {
            handleWorkspaceExplorerOpen: async () => false,
            handleWorkspaceExplorerNavigate: async () => false,
            handleWorkspaceFileOpen: async () => false,
            handleWorkspaceTextEditStart: async () => false,
            handleWorkspaceFileSave: async () => false,
            handleWorkspaceFileLinkOpen: async () => false,
          },
        });

        return {
          currentError: controllerState.currentError,
          submitRequestResponse: actions.submitRequestResponse,
        };
      },
      {
        initialProps: {
          sessionErrorMessage: '',
        },
      },
    );

    await act(async () => {
      const submitted = await result.current.submitRequestResponse('req-input', { environment: 'staging' });
      expect(submitted).toBe(false);
    });

    expect(submitSessionRequestResponse).toHaveBeenCalledWith('req-input', { environment: 'staging' });
    expect(result.current.currentError).toBeNull();

    rerender({ sessionErrorMessage: 'request not found' });

    expect(result.current.currentError).toEqual({
      kind: 'pending-request',
      message: 'request not found',
    });
  });
});
