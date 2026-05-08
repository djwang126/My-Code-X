import { FeedbackMessage } from '../../../../shared/components/feedback';
import type { WorkspaceFileDetail, WorkspaceFileEntry } from '..';
import { WorkspaceBinaryFileScreen } from './WorkspaceBinaryFileScreen';
import { WorkspaceExplorerHeader } from './WorkspaceExplorerHeader';
import { WorkspaceExplorerListScreen } from './WorkspaceExplorerListScreen';
import { WorkspaceImageFileScreen } from './WorkspaceImageFileScreen';
import { WorkspaceTextFileScreen } from './WorkspaceTextFileScreen';
import { getFileDetailName, getFileDetailPath } from './workspace-file-explorer-view';
import { useWorkspaceExplorerViewState } from '../hooks/useWorkspaceExplorerViewState';

type WorkspaceFileExplorerProps = {
  open: boolean;
  loading: boolean;
  errorMessage: string;
  notice: string;
  currentPath: string;
  entries: WorkspaceFileEntry[];
  fileDetail: WorkspaceFileDetail | null;
  draft: string;
  dirty: boolean;
  saving: boolean;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
  onOpenFile?: (path: string) => void;
  onDraftChange?: (draft: string) => void;
  onStartTextEdit?: () => boolean | Promise<boolean>;
  onSave?: () => boolean | Promise<boolean>;
};

function renderWorkspaceDetailScreen({
  detail,
  dirty,
  draft,
  saving,
  viewState,
  onDraftChange,
}: {
  detail: WorkspaceFileDetail;
  dirty: boolean;
  draft: string;
  saving: boolean;
  viewState: ReturnType<typeof useWorkspaceExplorerViewState>;
  onDraftChange?: (draft: string) => void;
}) {
  if (detail.kind === 'text') {
    return (
      <WorkspaceTextFileScreen
        detail={detail}
        dirty={dirty}
        draft={draft}
        editorRef={viewState.editorRef}
        isEditScreen={viewState.isEditScreen}
        onDiscard={viewState.discard}
        onDraftChange={onDraftChange}
        onEnterEdit={() => void viewState.enterEdit()}
        onSave={() => void viewState.save()}
        previewRef={viewState.previewRef}
        saving={saving}
      />
    );
  }

  if (detail.kind === 'image') {
    return (
      <WorkspaceImageFileScreen
        detail={detail}
        onClosePreview={() => viewState.setPreviewImageOpen(false)}
        onOpenPreview={() => viewState.setPreviewImageOpen(true)}
        previewImageOpen={viewState.previewImageOpen}
        previewRef={viewState.previewRef}
      />
    );
  }

  return <WorkspaceBinaryFileScreen detail={detail} />;
}

export function WorkspaceFileExplorer({
  open,
  loading,
  errorMessage,
  notice,
  currentPath,
  entries,
  fileDetail,
  draft,
  dirty,
  saving,
  onClose,
  onNavigate,
  onOpenFile,
  onDraftChange,
  onStartTextEdit,
  onSave,
}: WorkspaceFileExplorerProps) {
  const detailPath = getFileDetailPath(fileDetail);
  const detailName = getFileDetailName(fileDetail);
  const viewState = useWorkspaceExplorerViewState({
    dirty,
    fileDetail,
    onDraftChange,
    onSave,
    onStartTextEdit,
    open,
  });

  if (!open) {
    return null;
  }

  return (
    <section aria-label="File Explorer" className="workspace-explorer">
      <WorkspaceExplorerHeader
        detailPath={detailPath}
        isListScreen={viewState.isListScreen}
        onBack={viewState.back}
        onClose={onClose}
        title={viewState.isListScreen ? 'File Explorer' : detailName}
      />

      {errorMessage ? <FeedbackMessage tone="error">{errorMessage}</FeedbackMessage> : null}
      {notice ? <FeedbackMessage tone="info">{notice}</FeedbackMessage> : null}

      {viewState.isListScreen ? (
        <WorkspaceExplorerListScreen
          currentPath={currentPath}
          entries={entries}
          loading={loading}
          onNavigate={onNavigate}
          onOpenFile={onOpenFile}
        />
      ) : (
        <div className="workspace-explorer-screen workspace-explorer-detail-screen">
          {fileDetail ? (
            renderWorkspaceDetailScreen({
              detail: fileDetail,
              dirty,
              draft,
              saving,
              viewState,
              onDraftChange,
            })
          ) : (
            <div className="workspace-editor-state-card workspace-editor-empty">
              <p className="workspace-editor-state-title">Opening file…</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
