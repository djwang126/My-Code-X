import { useEffect, useMemo, useState } from 'react';

import type { ChatPageRuntimeState } from '../types';
import { fetchThreadHistory, type SessionThreadHistoryItem } from '../../thread-history';
import { listSavedWorkspaces, removeSavedWorkspace, saveWorkspace } from '../../workspace-bookmarks';
import { normalizeChatPageError } from '../state/chat-page-error-normalize';

type SessionBootstrapControls = {
  startFresh: () => void;
  openWorkspace: (workspacePath: string) => void;
  resumeWorkspace: (workspacePath: string) => void;
  resumeThread: (input: { workspace: string; threadId: string }) => void;
};

type UseChatPageWorkspaceManagerInput = {
  state: ChatPageRuntimeState;
  workspaceSwitchReason: string;
  reportError: (input: { kind: 'workspace-switch'; message: string }) => boolean;
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
  const [threadHistory, setThreadHistory] = useState<SessionThreadHistoryItem[]>([]);
  const [threadHistoryLoading, setThreadHistoryLoading] = useState(false);
  const [threadHistoryError, setThreadHistoryError] = useState('');

  const savedWorkspaces = useMemo(
    () => listSavedWorkspaces(),
    [workspaceListRevision, state.threadId, state.workspace],
  );

  useEffect(() => {
    let cancelled = false;

    if (!state.workspace.trim()) {
      setThreadHistory([]);
      setThreadHistoryLoading(false);
      setThreadHistoryError('');
      return () => {
        cancelled = true;
      };
    }

    setThreadHistoryLoading(true);
    setThreadHistoryError('');

    fetchThreadHistory({ workspace: state.workspace })
      .then(history => {
        if (cancelled) return;
        setThreadHistory(history);
      })
      .catch(error => {
        if (cancelled) return;
        const threadHistoryFailure = normalizeChatPageError({
          kind: 'thread-history',
          error,
          fallbackMessage: 'Failed to load thread history.',
        });
        setThreadHistory([]);
        setThreadHistoryError(threadHistoryFailure.message);
      })
      .finally(() => {
        if (cancelled) return;
        setThreadHistoryLoading(false);
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

  async function handleWorkspaceSave(nextWorkspace: { path: string; label: string }) {
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

  async function handleThreadHistoryOpen(threadId: string) {
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
    threadHistory,
    threadHistoryLoading,
    threadHistoryError,
    blockWorkspaceSwitchIfNeeded,
    handleWorkspaceSave,
    handleWorkspaceOpen,
    handleWorkspaceResume,
    handleWorkspaceRemove,
    handleNewThread,
    handleThreadHistoryOpen,
  };
}
