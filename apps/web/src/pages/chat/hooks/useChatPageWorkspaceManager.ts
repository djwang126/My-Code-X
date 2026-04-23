import { useEffect, useMemo, useState } from 'react';

import { fetchWorkspaceThreads, type WorkspaceThreadEntry } from '../../../features/workspace/threads';
import { listSavedWorkspaces, removeSavedWorkspace, saveWorkspace, type WorkspaceDraft } from '../../../features/workspace/bookmarks';
import type { ChatPageRuntimeState } from '../types';
import { normalizeChatPageError } from '../state/error-normalize';

type ResumeThreadInput = {
  workspace: string;
  threadId: string;
};

type WorkspaceSwitchErrorInput = {
  kind: 'workspace-switch';
  message: string;
};

type SessionBootstrapControls = {
  startFresh: () => void;
  openWorkspace: (workspacePath: string) => void;
  resumeWorkspace: (workspacePath: string) => void;
  resumeThread: (input: ResumeThreadInput) => void;
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
      resumeThread({ workspace: workspacePath, threadId: savedWorkspace.lastThreadId });
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

    startFresh();
    return true;
  }

  async function handleWorkspaceThreadOpen(threadId: string) {
    if (!state.workspace.trim()) {
      return reportError({ kind: 'workspace-switch', message: 'Select a workspace before switching threads.' });
    }

    if (blockWorkspaceSwitchIfNeeded()) {
      return false;
    }

    resumeThread({ workspace: state.workspace, threadId });
    return true;
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
