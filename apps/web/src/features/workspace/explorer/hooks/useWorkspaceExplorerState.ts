import { useEffect, useRef, useState } from 'react';

import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../public-types';

export type WorkspaceExplorerErrorKind = 'workspace-file-open' | 'workspace-file-save';

export type WorkspaceExplorerActionGuard = {
  nextActionId: () => number;
  isCurrentAction: (actionId: number) => boolean;
};

export type WorkspaceExplorerMutators = {
  setWorkspaceExplorerEntries: (entries: WorkspaceFileEntry[]) => void;
  setWorkspaceExplorerPath: (path: string) => void;
  setWorkspaceExplorerOpen: (open: boolean) => void;
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceFileDetail: (detail: WorkspaceFileDetail | null) => void;
  setWorkspaceFileDraft: (draft: string) => void;
  clearWorkspaceEditor: () => void;
};

type UseWorkspaceExplorerStateInput = {
  workspace: string;
};

export function useWorkspaceExplorerState({ workspace }: UseWorkspaceExplorerStateInput) {
  const [workspaceExplorerOpen, setWorkspaceExplorerOpen] = useState(false);
  const [workspaceExplorerLoading, setWorkspaceExplorerLoading] = useState(false);
  const [workspaceExplorerError, setWorkspaceExplorerError] = useState('');
  const [workspaceExplorerNotice, setWorkspaceExplorerNotice] = useState('');
  const [workspaceExplorerPath, setWorkspaceExplorerPath] = useState('');
  const [workspaceExplorerEntries, setWorkspaceExplorerEntries] = useState<WorkspaceFileEntry[]>([]);
  const [workspaceFileDetail, setWorkspaceFileDetail] = useState<WorkspaceFileDetail | null>(null);
  const [workspaceFileDraft, setWorkspaceFileDraft] = useState('');
  const [workspaceFileSaving, setWorkspaceFileSaving] = useState(false);
  const latestActionIdRef = useRef(0);

  const workspaceFileDirty = workspaceFileDetail?.kind === 'editable'
    ? workspaceFileDraft !== workspaceFileDetail.file.content
    : false;

  function clearWorkspaceEditor() {
    setWorkspaceFileDetail(null);
    setWorkspaceFileDraft('');
  }

  function nextActionId() {
    latestActionIdRef.current += 1;
    return latestActionIdRef.current;
  }

  function isCurrentAction(actionId: number) {
    return latestActionIdRef.current === actionId;
  }

  useEffect(() => {
    latestActionIdRef.current += 1;
    setWorkspaceExplorerOpen(false);
    setWorkspaceExplorerLoading(false);
    setWorkspaceExplorerError('');
    setWorkspaceExplorerNotice('');
    setWorkspaceExplorerPath('');
    setWorkspaceExplorerEntries([]);
    clearWorkspaceEditor();
    setWorkspaceFileSaving(false);
  }, [workspace]);

  const mutators: WorkspaceExplorerMutators = {
    setWorkspaceExplorerEntries,
    setWorkspaceExplorerPath,
    setWorkspaceExplorerOpen,
    setWorkspaceExplorerNotice,
    setWorkspaceFileDetail,
    setWorkspaceFileDraft,
    clearWorkspaceEditor,
  };

  const actionGuard: WorkspaceExplorerActionGuard = {
    nextActionId,
    isCurrentAction,
  };

  return {
    actionGuard,
    mutators,
    workspaceExplorerOpen,
    workspaceExplorerLoading,
    workspaceExplorerError,
    workspaceExplorerNotice,
    workspaceExplorerPath,
    workspaceExplorerEntries,
    workspaceFileDetail,
    workspaceFileDraft,
    workspaceFileDirty,
    workspaceFileSaving,
    setWorkspaceExplorerOpen,
    setWorkspaceExplorerLoading,
    setWorkspaceExplorerError,
    setWorkspaceExplorerNotice,
    setWorkspaceExplorerEntries,
    setWorkspaceExplorerPath,
    setWorkspaceFileDetail,
    setWorkspaceFileDraft,
    setWorkspaceFileSaving,
    clearWorkspaceEditor,
  };
}
