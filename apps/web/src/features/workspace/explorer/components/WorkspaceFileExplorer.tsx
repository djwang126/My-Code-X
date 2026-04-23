import { useEffect, useMemo, useState } from 'react';

import { FeedbackMessage } from '../../../../shared/components/feedback';
import { IconClose, IconFile, IconFolder } from '../../../../shared/chat-ui/ChatIcons';
import { MarkdownMessage } from '../../../../shared/components/markdown';
import type { WorkspaceFileDetail, WorkspaceFileEntry } from '..';

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
  onSave?: () => void;
};

type ExplorerScreen =
  | { kind: 'list' }
  | { kind: 'preview'; detailPath: string }
  | { kind: 'edit'; detailPath: string };

function getParentPath(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

function getFileDetailPath(fileDetail: WorkspaceFileDetail | null) {
  if (!fileDetail) return '';
  return 'file' in fileDetail ? fileDetail.file.path : fileDetail.path;
}

function getFileDetailName(fileDetail: WorkspaceFileDetail | null) {
  if (!fileDetail) return 'File';
  return 'file' in fileDetail ? fileDetail.file.name : fileDetail.name;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatEntryMeta(entry: WorkspaceFileEntry) {
  if (entry.kind === 'directory') return '';
  const parts = [formatFileSize(entry.size)];
  if (!entry.isTextEditable) {
    parts.push('RO');
  }
  return parts.join(' · ');
}

function buildBreadcrumbs(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return [];
  const segments = normalized.split('/');
  return segments.map((segment, index) => ({ label: segment, path: segments.slice(0, index + 1).join('/') }));
}

function isMarkdownFile(path: string) {
  return /\.md$/i.test(String(path || '').trim());
}

function getEditableBadges(fileDetail: Extract<WorkspaceFileDetail, { kind: 'editable' }>) {
  return [formatFileSize(fileDetail.file.size), fileDetail.file.encoding, 'Editable'];
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
  onSave,
}: WorkspaceFileExplorerProps) {
  const [screen, setScreen] = useState<ExplorerScreen>({ kind: 'list' });

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath]);
  const detailPath = getFileDetailPath(fileDetail);
  const detailName = getFileDetailName(fileDetail);
  const isListScreen = screen.kind === 'list';
  const isEditScreen = screen.kind === 'edit' && screen.detailPath === detailPath;
  const editableBadges = fileDetail?.kind === 'editable' ? getEditableBadges(fileDetail) : [];
  const shouldRenderPreviewAsMarkdown = Boolean(fileDetail?.kind === 'editable' && isMarkdownFile(fileDetail.file.path));

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!detailPath) {
      setScreen({ kind: 'list' });
      return;
    }

    setScreen(currentScreen => {
      if (currentScreen.kind === 'list') {
        return { kind: 'preview', detailPath };
      }

      if (currentScreen.detailPath !== detailPath) {
        return { kind: 'preview', detailPath };
      }

      if (fileDetail?.kind !== 'editable' && currentScreen.kind === 'edit') {
        return { kind: 'preview', detailPath };
      }

      return currentScreen;
    });
  }, [detailPath, fileDetail?.kind, open]);

  function handleReturnToList() {
    setScreen({ kind: 'list' });
  }

  function handleDiscard() {
    if (!fileDetail || fileDetail.kind !== 'editable') return;
    if (dirty && !window.confirm('Discard unsaved file changes?')) return;
    onDraftChange?.(fileDetail.file.content);
    setScreen({ kind: 'preview', detailPath: fileDetail.file.path });
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
          <button className="workspace-explorer-back-btn" onClick={handleReturnToList} type="button">
            ← Back
          </button>
        )}
        <div className="workspace-explorer-header-copy">
          <h2>{isListScreen ? 'File Explorer' : detailName}</h2>
          {!isListScreen && detailPath ? <p>{detailPath}</p> : null}
        </div>
        {!isListScreen && fileDetail?.kind === 'editable' ? (
          isEditScreen ? (
            <button className="workspace-action-btn" onClick={() => setScreen({ kind: 'preview', detailPath })} type="button">
              Preview
            </button>
          ) : (
            <button className="workspace-action-btn primary" onClick={() => setScreen({ kind: 'edit', detailPath })} type="button">
              Edit
            </button>
          )
        ) : (
          <span className="workspace-explorer-header-spacer" aria-hidden="true" />
        )}
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
          ) : fileDetail.kind === 'tooLarge' ? (
            <div className="workspace-editor-state-card workspace-editor-empty">
              <p className="workspace-editor-state-title">File too large for inline preview.</p>
              <p className="workspace-editor-state-copy">{formatFileSize(fileDetail.file.size)} · Large</p>
              <p className="workspace-editor-state-copy">Limit: 256 KB</p>
              <button className="workspace-action-btn" onClick={handleReturnToList} type="button">Back to files</button>
            </div>
          ) : fileDetail.kind === 'readOnly' ? (
            <div className="workspace-editor-state-card workspace-editor-empty">
              <p className="workspace-editor-state-title">This file is view-only.</p>
              <p className="workspace-editor-state-copy">{formatFileSize(fileDetail.size)} · RO</p>
              <button className="workspace-action-btn" onClick={handleReturnToList} type="button">Back to files</button>
            </div>
          ) : isEditScreen ? (
            <div className="workspace-editor-stack">
              <div className="workspace-explorer-detail-meta">
                <div className="workspace-explorer-detail-badges">
                  {editableBadges.map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
                </div>
              </div>
              <label className="workspace-editor-label">
                <span className="workspace-editor-label-text">File content</span>
                <textarea aria-label="File content" className="workspace-editor-textarea" onChange={event => onDraftChange?.(event.target.value)} spellCheck={false} value={draft} />
              </label>
              <div className="workspace-editor-footer">
                <span className={`workspace-editor-status ${dirty ? 'dirty' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'No changes'}</span>
                <div className="workspace-editor-actions">
                  <button className="workspace-action-btn" onClick={handleDiscard} type="button">Discard</button>
                  <button className="workspace-action-btn primary" disabled={!dirty || saving} onClick={onSave} type="button">{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="workspace-explorer-detail-meta">
                <div className="workspace-explorer-detail-badges">
                  {editableBadges.map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
                </div>
              </div>
              <div className="workspace-editor-preview">
                {shouldRenderPreviewAsMarkdown ? (
                  <div className="workspace-editor-preview-content workspace-editor-preview-markdown">
                    <MarkdownMessage text={draft} />
                  </div>
                ) : (
                  <pre className="workspace-editor-preview-content">{draft}</pre>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
