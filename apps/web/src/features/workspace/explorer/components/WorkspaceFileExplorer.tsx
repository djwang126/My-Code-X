import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { OverlayDialog } from '../../../../shared/components/overlay';
import { FeedbackMessage } from '../../../../shared/components/feedback';
import { IconClose, IconFile, IconFolder } from '../../../../shared/chat-ui/ChatIcons';
import { MarkdownMessage } from '../../../../shared/components/markdown';
import type { WorkspaceFileDetail, WorkspaceFileEntry } from '..';
import {
  captureWorkspaceExplorerScrollSnapshot,
  restoreWorkspaceExplorerScrollSnapshot,
  type WorkspaceExplorerScrollSnapshot,
} from './workspace-file-explorer-scroll';
import {
  buildBreadcrumbs,
  confirmDiscardWorkspaceDraft,
  formatEntryMeta,
  getBinaryFileBadges,
  getFileDetailName,
  getFileDetailPath,
  getParentPath,
  getTextFileBadges,
  isMarkdownFile,
} from './workspace-file-explorer-view';

const previewImageStyle: CSSProperties = {
  maxWidth: 'min(24rem, 100%)',
  borderRadius: '0.75rem',
};

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

type ExplorerScreen =
  | { kind: 'list' }
  | { kind: 'preview'; detailPath: string }
  | { kind: 'edit'; detailPath: string };

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
  const [screen, setScreen] = useState<ExplorerScreen>({ kind: 'list' });
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pendingScrollRestoreRef = useRef<WorkspaceExplorerScrollSnapshot | null>(null);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath]);
  const detailPath = getFileDetailPath(fileDetail);
  const detailName = getFileDetailName(fileDetail);
  const isListScreen = screen.kind === 'list';
  const isEditScreen = screen.kind === 'edit' && screen.detailPath === detailPath;
  const isTextDetail = fileDetail?.kind === 'text';
  const shouldRenderPreviewAsMarkdown = Boolean(isTextDetail && isMarkdownFile(fileDetail.path));

  useEffect(() => {
    if (!open) return;

    if (!detailPath) {
      setScreen({ kind: 'list' });
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

  async function handleEnterEdit() {
    if (!detailPath || !isTextDetail) return;
    const ready = (await onStartTextEdit?.()) ?? true;
    if (!ready) return;
    captureCurrentDetailScroll();
    setScreen({ kind: 'edit', detailPath });
  }

  function handleReturnToPreview() {
    if (!isTextDetail) return;
    if (dirty && !confirmDiscardWorkspaceDraft()) return;
    if (dirty) {
      onDraftChange?.(fileDetail.content);
    }
    captureCurrentDetailScroll();
    setScreen({ kind: 'preview', detailPath: fileDetail.path });
  }

  function handleBack() {
    if (isEditScreen) {
      handleReturnToPreview();
      return;
    }
    setScreen({ kind: 'list' });
  }

  function handleDiscard() {
    if (!isTextDetail) return;
    if (dirty && !confirmDiscardWorkspaceDraft()) return;
    onDraftChange?.(fileDetail.content);
    captureCurrentDetailScroll();
    setScreen({ kind: 'preview', detailPath: fileDetail.path });
  }

  async function handleSave() {
    if (!detailPath || !onSave) return;
    captureCurrentDetailScroll();
    const saved = (await onSave()) ?? false;
    if (!saved) {
      pendingScrollRestoreRef.current = null;
      return;
    }
    setScreen({ kind: 'preview', detailPath });
  }

  if (!open) return null;

  return (
    <section aria-label="File Explorer" className="workspace-explorer">
      <div className="workspace-explorer-header">
        {isListScreen ? (
          <button aria-label="Close File Explorer" className="workspace-explorer-nav-btn" onClick={onClose} type="button">
            <IconClose />
          </button>
        ) : (
          <button className="workspace-explorer-back-btn" onClick={handleBack} type="button">
            ← Back
          </button>
        )}
        <div className="workspace-explorer-header-copy">
          <h2>{isListScreen ? 'File Explorer' : detailName}</h2>
          {!isListScreen && detailPath ? <p>{detailPath}</p> : null}
        </div>
        <span aria-hidden="true" className="workspace-explorer-header-spacer" />
      </div>

      {errorMessage ? <FeedbackMessage tone="error">{errorMessage}</FeedbackMessage> : null}
      {notice ? <FeedbackMessage tone="info">{notice}</FeedbackMessage> : null}

      {isListScreen ? (
        <div className="workspace-explorer-screen">
          <div className="workspace-explorer-pathbar">
            {currentPath ? (
              <button className="workspace-action-btn" onClick={() => onNavigate?.(getParentPath(currentPath))} type="button">
                ↑ Up
              </button>
            ) : null}
            <nav aria-label="File path" className="workspace-explorer-breadcrumbs">
              <button className="workspace-explorer-breadcrumb root" onClick={() => onNavigate?.('')} type="button">
                root
              </button>
              {breadcrumbs.map(crumb => (
                <button key={crumb.path} className="workspace-explorer-breadcrumb" onClick={() => onNavigate?.(crumb.path)} type="button">
                  {crumb.label}
                </button>
              ))}
            </nav>
          </div>
          {loading ? <p className="workspace-explorer-state">Loading folder…</p> : null}
          {!loading && entries.length === 0 ? <p className="workspace-explorer-state">This folder is empty.</p> : null}
          {!loading && entries.length ? (
            <div className="workspace-explorer-entry-list">
              {entries.map(entry => {
                const meta = formatEntryMeta(entry);

                return (
                  <button
                    aria-label={entry.name}
                    key={entry.path}
                    className={`workspace-explorer-entry ${entry.kind === 'directory' ? 'directory' : 'file'}`}
                    onClick={() => (entry.kind === 'directory' ? onNavigate?.(entry.path) : onOpenFile?.(entry.path))}
                    type="button"
                  >
                    <span className="workspace-explorer-entry-leading">
                      {entry.kind === 'directory' ? <IconFolder /> : <IconFile />}
                      <span className="workspace-explorer-entry-name">{entry.name}</span>
                    </span>
                    <span className="workspace-explorer-entry-trailing">
                      {meta ? <span className="workspace-explorer-entry-meta">{meta}</span> : null}
                      <span aria-hidden="true" className="workspace-explorer-entry-chevron">›</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="workspace-explorer-screen workspace-explorer-detail-screen">
          {!fileDetail ? (
            <div className="workspace-editor-state-card workspace-editor-empty">
              <p className="workspace-editor-state-title">Opening file…</p>
            </div>
          ) : fileDetail.kind === 'text' ? (
            isEditScreen ? (
              <div className="workspace-editor-stack">
                <div className="workspace-explorer-detail-meta">
                  <div className="workspace-explorer-detail-badges">
                    {getTextFileBadges(fileDetail).map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
                  </div>
                </div>
                <label className="workspace-editor-label">
                  <span className="workspace-editor-label-text">File content</span>
                  <textarea aria-label="File content" className="workspace-editor-textarea" onChange={event => onDraftChange?.(event.target.value)} ref={editorRef} spellCheck={false} value={draft} />
                </label>
                <div className="workspace-editor-footer">
                  <span className={`workspace-editor-status ${dirty ? 'dirty' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'No changes'}</span>
                  <div className="workspace-editor-actions">
                    <button className="workspace-action-btn" onClick={handleDiscard} type="button">Discard</button>
                    <button className="workspace-action-btn primary" disabled={!dirty || saving} onClick={() => void handleSave()} type="button">{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="workspace-editor-stack">
                <div className="workspace-explorer-detail-meta">
                  <div className="workspace-explorer-detail-badges">
                    {getTextFileBadges(fileDetail).map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
                  </div>
                  {fileDetail.truncated ? <p className="workspace-editor-state-copy">Showing the preview first. Edit loads the full file.</p> : null}
                </div>
                <div className="workspace-editor-preview">
                  {shouldRenderPreviewAsMarkdown ? (
                    <div className="workspace-editor-preview-content workspace-editor-preview-markdown" ref={previewRef}>
                      <MarkdownMessage text={draft} />
                    </div>
                  ) : (
                    <div className="workspace-editor-preview-content" ref={previewRef}>
                      <pre>{draft}</pre>
                    </div>
                  )}
                </div>
                <div className="workspace-editor-footer">
                  <span className="workspace-editor-status saved">Preview</span>
                  <div className="workspace-editor-actions">
                    <button className="workspace-action-btn primary" onClick={() => void handleEnterEdit()} type="button">Edit</button>
                  </div>
                </div>
              </div>
            )
          ) : fileDetail.kind === 'image' ? (
            <div className="workspace-editor-stack">
              <div className="workspace-explorer-detail-meta">
                <div className="workspace-explorer-detail-badges">
                  {getBinaryFileBadges(fileDetail).map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
                </div>
              </div>
              <button className="workspace-action-btn" onClick={() => setPreviewImageOpen(true)} type="button">Open image preview</button>
              <div className="workspace-editor-preview-content" ref={previewRef}>
                <button className="workspace-action-btn" onClick={() => setPreviewImageOpen(true)} type="button">
                  <img alt={fileDetail.name} src={fileDetail.url} style={previewImageStyle} />
                </button>
              </div>
            </div>
          ) : (
            <div className="workspace-editor-state-card workspace-editor-empty">
              <p className="workspace-editor-state-title">{fileDetail.name}</p>
              <p className="workspace-editor-state-copy">{getBinaryFileBadges(fileDetail).join(' · ')}</p>
            </div>
          )}
        </div>
      )}

      {fileDetail?.kind === 'image' ? (
        <OverlayDialog
          ariaLabel="Workspace image preview"
          onClose={() => setPreviewImageOpen(false)}
          open={previewImageOpen}
          showCloseButton={false}
          title={fileDetail.name}
          width="min(28rem, 100%)"
        >
          <img alt="Workspace image preview content" src={fileDetail.url} style={previewImageStyle} />
        </OverlayDialog>
      ) : null}
    </section>
  );
}
