import { useEffect, useRef, useState } from 'react';

import type { WorkspaceFileDetail } from '../public-types';
import {
  captureWorkspaceExplorerScrollSnapshot,
  restoreWorkspaceExplorerScrollSnapshot,
  type WorkspaceExplorerScrollSnapshot,
} from '../components/workspace-file-explorer-scroll';
import { confirmDiscardWorkspaceDraft } from '../components/workspace-file-explorer-view';

type ExplorerScreen =
  | { kind: 'list' }
  | { kind: 'preview'; detailPath: string }
  | { kind: 'edit'; detailPath: string };

interface UseWorkspaceExplorerViewStateInput {
  dirty: boolean;
  fileDetail: WorkspaceFileDetail | null;
  onDraftChange?: (draft: string) => void;
  onSave?: () => boolean | Promise<boolean>;
  onStartTextEdit?: () => boolean | Promise<boolean>;
  open: boolean;
}

export function useWorkspaceExplorerViewState({
  dirty,
  fileDetail,
  onDraftChange,
  onSave,
  onStartTextEdit,
  open,
}: UseWorkspaceExplorerViewStateInput) {
  const [screen, setScreen] = useState<ExplorerScreen>({ kind: 'list' });
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pendingScrollRestoreRef = useRef<WorkspaceExplorerScrollSnapshot | null>(null);

  const detailPath = fileDetail?.path ?? '';
  const isListScreen = screen.kind === 'list';
  const isEditScreen = screen.kind === 'edit' && screen.detailPath === detailPath;
  const isTextDetail = fileDetail?.kind === 'text';

  useEffect(() => {
    if (!open) {
      setPreviewImageOpen(false);
      return;
    }

    if (!detailPath) {
      setScreen({ kind: 'list' });
      setPreviewImageOpen(false);
      return;
    }

    setScreen(currentScreen => {
      if (currentScreen.kind === 'list' || currentScreen.detailPath !== detailPath) {
        pendingScrollRestoreRef.current = null;
        return { kind: 'preview', detailPath };
      }

      if (fileDetail?.kind !== 'text' && currentScreen.kind === 'edit') {
        return { kind: 'preview', detailPath };
      }

      return currentScreen;
    });
  }, [detailPath, fileDetail?.kind, open]);

  useEffect(() => {
    if (screen.kind === 'list') {
      pendingScrollRestoreRef.current = null;
      return;
    }

    restoreWorkspaceExplorerScrollSnapshot(
      screen.kind === 'preview' ? previewRef.current : editorRef.current,
      pendingScrollRestoreRef.current,
    );
    pendingScrollRestoreRef.current = null;
  }, [screen]);

  function captureCurrentDetailScroll() {
    if (screen.kind === 'preview') {
      pendingScrollRestoreRef.current = captureWorkspaceExplorerScrollSnapshot(previewRef.current);
      return;
    }

    if (screen.kind === 'edit') {
      pendingScrollRestoreRef.current = captureWorkspaceExplorerScrollSnapshot(editorRef.current);
      return;
    }

    pendingScrollRestoreRef.current = null;
  }

  async function enterEdit() {
    if (!detailPath || !isTextDetail) {
      return false;
    }

    const ready = (await onStartTextEdit?.()) ?? true;
    if (!ready) {
      return false;
    }

    captureCurrentDetailScroll();
    setScreen({ kind: 'edit', detailPath });
    return true;
  }

  function returnToPreview() {
    if (!isTextDetail) {
      return false;
    }

    if (dirty && !confirmDiscardWorkspaceDraft()) {
      return false;
    }

    if (dirty) {
      onDraftChange?.(fileDetail.content);
    }

    captureCurrentDetailScroll();
    setScreen({ kind: 'preview', detailPath: fileDetail.path });
    return true;
  }

  function returnToList() {
    setScreen({ kind: 'list' });
  }

  function back() {
    if (isEditScreen) {
      return returnToPreview();
    }

    returnToList();
    return true;
  }

  function discard() {
    return returnToPreview();
  }

  async function save() {
    if (!detailPath || !onSave) {
      return false;
    }

    captureCurrentDetailScroll();
    const saved = (await onSave()) ?? false;
    if (!saved) {
      pendingScrollRestoreRef.current = null;
      return false;
    }

    setScreen({ kind: 'preview', detailPath });
    return true;
  }

  return {
    editorRef,
    isEditScreen,
    isListScreen,
    previewImageOpen,
    previewRef,
    screen,
    setPreviewImageOpen,
    back,
    discard,
    enterEdit,
    returnToPreview,
    save,
  };
}
