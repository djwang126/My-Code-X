import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionApiError } from '../../../shared/lib/app-api-client';
import { useChatPageWorkspaceManager } from './useChatPageWorkspaceManager';

const fetchWorkspaceThreads = vi.hoisted(() => vi.fn());

vi.mock('../../../features/workspace/threads', () => ({
  fetchWorkspaceThreads,
}));

describe('useChatPageWorkspaceManager', () => {
  it('preserves the workspace threads error message returned by the session api without reporting page feedback', async () => {
    const reportError = vi.fn().mockReturnValue(false);

    fetchWorkspaceThreads.mockRejectedValueOnce(
      new SessionApiError({
        message: 'workspace threads service unavailable',
        code: 'service_unavailable',
        status: 503,
      }),
    );

    const { result } = renderHook(() =>
      useChatPageWorkspaceManager({
        state: {
          workspace: 'D:/workspace/example-app',
          threadId: 'thread-1',
        } as never,
        workspaceSwitchReason: '',
        startFresh: vi.fn(),
        openWorkspace: vi.fn(),
        resumeWorkspace: vi.fn(),
        resumeThread: vi.fn(),
        reportError,
      }),
    );

    await waitFor(() => {
      expect(result.current.workspaceThreadsError).toBe('workspace threads service unavailable');
    });

    expect(reportError).not.toHaveBeenCalled();
  });
});
