import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionApiError } from '../../../shared/lib/app-api-client';
import { useChatPageControllerState } from './useChatPageControllerState';
import { useChatPageSessionActions } from './useChatPageSessionActions';

describe('useChatPageSessionActions error routing', () => {
  it('keeps message fork failures typed as message-fork errors', async () => {
    const forkFromMessage = vi.fn().mockRejectedValue(new Error('fork request failed'));
    const resumeExistingThread = vi.fn();

    const { result } = renderHook(() => {
      const controllerState = useChatPageControllerState({
        interactionState: 'ready-idle',
        sessionErrorMessage: '',
      });
      const actions = useChatPageSessionActions({
        sessionDispatch: vi.fn(),
        sessionState: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'tab-1',
          workspace: 'D:/workspace/example-app',
          threadId: 'thread-1',
          serverInstanceId: 'server-1',
          statusMessage: 'Session synced',
          errorMessage: '',
        },
        state: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'tab-1',
          workspace: 'D:/workspace/example-app',
          threadId: 'thread-1',
          serverInstanceId: 'server-1',
          statusMessage: 'Session synced',
          errorMessage: '',
          latestTurn: null,
          threadName: '',
          threadStatusText: '',
          tokenUsageText: '',
          notices: [],
          pendingRequests: [],
          messages: [],
          preferences: {},
          options: {},
        },
        threadActions: {
          resumeExistingThread,
          compactThread: vi.fn(),
          forkFromMessage,
          rollbackThread: vi.fn(),
        },
        blockWorkspaceSwitchIfNeeded: () => false,
        reportError: controllerState.recordError,
      });

      return {
        currentError: controllerState.currentError,
        handleMessageFork: actions.handleMessageFork,
      };
    });

    await act(async () => {
      const handled = await result.current.handleMessageFork('message-1');
      expect(handled).toBe(false);
    });

    expect(forkFromMessage).toHaveBeenCalledWith('message-1');
    expect(resumeExistingThread).not.toHaveBeenCalled();
    expect(result.current.currentError).toEqual({
      kind: 'message-fork',
      message: 'fork request failed',
    });
  });

  it('preserves session api messages for typed action failures', async () => {
    const { result } = renderHook(() => {
      const controllerState = useChatPageControllerState({
        interactionState: 'ready-idle',
        sessionErrorMessage: '',
      });
      const actions = useChatPageSessionActions({
        sessionDispatch: vi.fn(),
        sessionState: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'tab-1',
          workspace: 'D:/workspace/example-app',
          threadId: 'thread-1',
          serverInstanceId: 'server-1',
          statusMessage: 'Session synced',
          errorMessage: '',
        },
        state: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'tab-1',
          workspace: 'D:/workspace/example-app',
          threadId: 'thread-1',
          serverInstanceId: 'server-1',
          statusMessage: 'Session synced',
          errorMessage: '',
          latestTurn: null,
          threadName: '',
          threadStatusText: '',
          tokenUsageText: '',
          notices: [],
          pendingRequests: [],
          messages: [],
          preferences: {},
          options: {},
        },
        threadActions: {
          resumeExistingThread: vi.fn(),
          compactThread: vi.fn(),
          forkFromMessage: vi.fn().mockRejectedValue(
            new SessionApiError({
              message: 'fork service unavailable',
              code: 'service_unavailable',
              status: 503,
            }),
          ),
          rollbackThread: vi.fn(),
        },
        blockWorkspaceSwitchIfNeeded: () => false,
        reportError: controllerState.recordError,
      });

      return {
        currentError: controllerState.currentError,
        handleMessageFork: actions.handleMessageFork,
      };
    });

    await act(async () => {
      const handled = await result.current.handleMessageFork('message-2');
      expect(handled).toBe(false);
    });

    expect(result.current.currentError).toEqual({
      kind: 'message-fork',
      message: 'fork service unavailable',
    });
  });
});

