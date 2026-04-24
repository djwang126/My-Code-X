import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useThreadActions } from './useThreadActions';

const postThreadStart = vi.hoisted(() => vi.fn());
const postThreadResume = vi.hoisted(() => vi.fn());
const postThreadCompactStart = vi.hoisted(() => vi.fn());
const postThreadFork = vi.hoisted(() => vi.fn());
const postThreadRollback = vi.hoisted(() => vi.fn());
const useChatRuntimeDispatch = vi.hoisted(() => vi.fn());
const useSessionShellDispatch = vi.hoisted(() => vi.fn());
const isCurrentPageSlotOwner = vi.hoisted(() => vi.fn());
const useSessionSelection = vi.hoisted(() => vi.fn());

vi.mock('./thread-action-api', () => ({
  postThreadStart,
  postThreadResume,
  postThreadCompactStart,
  postThreadFork,
  postThreadRollback,
}));

vi.mock('../runtime/components/ChatRuntimeProvider', () => ({
  useChatRuntimeDispatch,
}));

vi.mock('../settings', () => ({
  normalizeRuntimeSettings: vi.fn(value => value),
  readRuntimeOptions: vi.fn(() => null),
  readRuntimeSettings: vi.fn(() => null),
  validateRuntimeSettings: vi.fn(() => null),
}));

vi.mock('../../session', () => ({
  SLOT_DISPLACED_MESSAGE: 'slot displaced',
  isCurrentPageSlotOwner,
  useSessionDispatch: useSessionShellDispatch,
}));

vi.mock('../../session/selection', () => ({
  useSessionSelection,
}));

describe('useThreadActions', () => {
  it('blocks duplicate fork submissions while the first fork request is still in flight', async () => {
    const dispatch = vi.fn();
    const sessionDispatch = vi.fn();
    const selectThread = vi.fn();
    let resolveFork:
      | ((value: { threadId: string; snapshot: { threadId: string; latestTurn: null; messages: never[] } }) => void)
      | null = null;

    useChatRuntimeDispatch.mockReturnValue(dispatch);
    useSessionShellDispatch.mockReturnValue(sessionDispatch);
    useSessionSelection.mockReturnValue({ selectThread });
    isCurrentPageSlotOwner.mockReturnValue(true);
    postThreadFork.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFork = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useThreadActions({
        state: {
          threadId: 'thread-1',
          latestTurn: null,
          operations: {
            send: 'idle',
            interrupt: 'idle',
          },
          messages: [
            {
              id: 'user-1',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'hello',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
            {
              id: 'assistant-1',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'hi',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
          ],
          notices: [],
          errorDetail: null,
          pendingRequests: [],
          preferences: {},
          options: {},
        } as never,
        sessionState: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'slot-1',
          workspace: 'D:/workspace/example-app',
        } as never,
      }),
    );

    let firstForkPromise = Promise.resolve('');
    await act(async () => {
      firstForkPromise = result.current.forkFromMessage('assistant-1');
    });

    let secondForkResult = '';
    await act(async () => {
      secondForkResult = await result.current.forkFromMessage('assistant-1');
    });

    expect(secondForkResult).toBe('');
    expect(postThreadFork).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFork?.({
        threadId: 'thread-forked',
        snapshot: {
          threadId: 'thread-forked',
          latestTurn: null,
          messages: [],
        },
      });
      await firstForkPromise;
    });

    expect(selectThread).toHaveBeenCalledWith({
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-forked',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-forked',
        latestTurn: null,
        messages: [],
      },
    });
  });

  it('starts a real thread and applies the returned snapshot', async () => {
    const dispatch = vi.fn();
    const sessionDispatch = vi.fn();
    const selectThread = vi.fn();

    useChatRuntimeDispatch.mockReturnValue(dispatch);
    useSessionShellDispatch.mockReturnValue(sessionDispatch);
    useSessionSelection.mockReturnValue({ selectThread });
    isCurrentPageSlotOwner.mockReturnValue(true);
    postThreadStart.mockResolvedValue({
      kind: 'threadStarted',
      threadId: 'thread-started',
      snapshot: {
        threadId: 'thread-started',
        latestTurn: null,
        messages: [],
      },
    });

    const { result } = renderHook(() =>
      useThreadActions({
        state: {
          threadId: '',
          latestTurn: null,
          operations: {
            send: 'idle',
            interrupt: 'idle',
          },
          messages: [],
          notices: [],
          errorDetail: null,
          pendingRequests: [],
          preferences: {},
          options: {},
        } as never,
        sessionState: {
          phase: 'ready',
          viewerId: 'viewer-1',
          slotId: 'slot-1',
          workspace: 'D:/workspace/example-app',
        } as never,
      }),
    );

    await act(async () => {
      await result.current.startThread({ workspace: 'D:/workspace/example-app' });
    });

    expect(postThreadStart).toHaveBeenCalledWith({
      viewerId: 'viewer-1',
      slotId: 'slot-1',
      workspace: 'D:/workspace/example-app',
      runtimeSettings: undefined,
    });
    expect(selectThread).toHaveBeenCalledWith({
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-started',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-started',
        latestTurn: null,
        messages: [],
      },
    });
  });
});
