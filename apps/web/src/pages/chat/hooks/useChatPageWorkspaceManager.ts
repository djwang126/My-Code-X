import { useEffect, useMemo, useState } from 'react';

import { fetchWorkspaceThreads, type WorkspaceThreadEntry } from '../../../features/workspace/threads';
import { listSavedWorkspaces, removeSavedWorkspace, saveWorkspace, type WorkspaceDraft } from '../../../features/workspace/bookmarks';
import type { ChatPageRuntimeState } from '../types';
import { normalizeChatPageError } from '../state/error-normalize';

type ResumeThreadInput = {
  workspace: string;
  threadId: string;
};

type StartThreadInput = {
  workspace: string;
};

type WorkspaceSwitchErrorInput = {
  kind: 'workspace-switch';
  message: string;
};

type RunWorkspaceActionInput = {
  action: () => Promise<boolean>;
  fallbackMessage: string;
};

type SessionBootstrapControls = {
  startFresh: () => void;
  startThread: (input: StartThreadInput) => Promise<boolean> | boolean;
  openWorkspace: (workspacePath: string) => void;
  resumeWorkspace: (workspacePath: string) => void;
  resumeThread: (input: ResumeThreadInput) => Promise<boolean> | boolean;
};

type UseChatPageWorkspaceManagerInput = {
  state: ChatPageRuntimeState;
  workspaceSwitchReason: string;
  reportError: (input: WorkspaceSwitchErrorInput) => boolean;
} & SessionBootstrapControls;

export function useChatPageWorkspaceManager({
  state,
  workspaceSwitchReason,
  startFresh,
  startThread,
  openWorkspace,
  resumeWorkspace,
  resumeThread,
  reportError,
}: UseChatPageWorkspaceManagerInput) {
  const [workspaceListRevision, setWorkspaceListRevision] = useState(0);
  const [workspaceThreads, setWorkspaceThreads] = useState<WorkspaceThreadEntry[]>([]);
  const [workspaceThreadsLoading, setWorkspaceThreadsLoading] = useState(false);
  const [workspaceThreadsError, setWorkspaceThreadsError] = useState('');

  const savedWorkspaces = useMemo(
    () => listSavedWorkspaces(),
    [workspaceListRevision, state.threadId, state.workspace],
  );

  useEffect(() => {
    let cancelled = false;

    if (!state.workspace.trim()) {
      setWorkspaceThreads([]);
      setWorkspaceThreadsLoading(false);
      setWorkspaceThreadsError('');
      return () => {
        cancelled = true;
      };
    }

    setWorkspaceThreadsLoading(true);
    setWorkspaceThreadsError('');

    fetchWorkspaceThreads({ workspace: state.workspace })
      .then(threads => {
        if (cancelled) return;
        setWorkspaceThreads(threads);
      })
      .catch(error => {
        if (cancelled) return;
        const workspaceThreadsFailure = normalizeChatPageError({
          kind: 'workspace-threads',
          error,
          fallbackMessage: 'Failed to load workspace threads.',
        });
        setWorkspaceThreads([]);
        setWorkspaceThreadsError(workspaceThreadsFailure.message);
      })
      .finally(() => {
        if (cancelled) return;
        setWorkspaceThreadsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state.workspace]);

  function refreshSavedWorkspaces() {
    setWorkspaceListRevision(current => current + 1);
  }

  function blockWorkspaceSwitchIfNeeded() {
    if (!workspaceSwitchReason) {
      return false;
    }

    return reportError({ kind: 'workspace-switch', message: workspaceSwitchReason });
  }

  async function runWorkspaceAction(input: RunWorkspaceActionInput) {
    try {
      return await input.action();
    } catch (error) {
      return reportError(
        normalizeChatPageError({
          kind: 'workspace-switch',
          error,
          fallbackMessage: input.fallbackMessage,
        }),
      );
    }
  }

  async function handleWorkspaceSave(nextWorkspace: WorkspaceDraft) {
    saveWorkspace(nextWorkspace);
    refreshSavedWorkspaces();
    return true;
  }

  async function handleWorkspaceOpen(workspacePath: string) {
    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    openWorkspace(workspacePath);
    refreshSavedWorkspaces();
    return true;
  }

  async function handleWorkspaceResume(workspacePath: string) {
    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    const savedWorkspace = listSavedWorkspaces().find(workspace => workspace.path === workspacePath) ?? null;

    if (savedWorkspace?.lastThreadId) {
      const resumed =
        (await runWorkspaceAction({
          action: () => Promise.resolve(resumeThread({ workspace: workspacePath, threadId: savedWorkspace.lastThreadId })),
          fallbackMessage: 'Failed to resume the saved workspace thread.',
        })) !== false;
      refreshSavedWorkspaces();
      return resumed;
    } else {
      resumeWorkspace(workspacePath);
    }

    refreshSavedWorkspaces();
    return true;
  }

  async function handleWorkspaceRemove(workspacePath: string) {
    removeSavedWorkspace(workspacePath);
    refreshSavedWorkspaces();

    if (state.workspace === workspacePath) {
      startFresh();
    }

    return true;
  }

  async function handleNewThread() {
    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    return runWorkspaceAction({
      action: () => Promise.resolve(startThread({ workspace: state.workspace })),
      fallbackMessage: 'Failed to start a new thread.',
    });
  }

  async function handleWorkspaceThreadOpen(threadId: string) {
    if (!state.workspace.trim()) {
      return reportError({ kind: 'workspace-switch', message: 'Select a workspace before switching threads.' });
    }

    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    return (
      await runWorkspaceAction({
        action: () => Promise.resolve(resumeThread({ workspace: state.workspace, threadId })),
        fallbackMessage: 'Failed to open the selected thread.',
      })
    ) !== false;
  }

  return {
    savedWorkspaces,
    workspaceThreads,
    workspaceThreadsLoading,
    workspaceThreadsError,
    blockWorkspaceSwitchIfNeeded,
    handleWorkspaceSave,
    handleWorkspaceOpen,
    handleWorkspaceResume,
    handleWorkspaceRemove,
    handleNewThread,
    handleWorkspaceThreadOpen,
  };
}
