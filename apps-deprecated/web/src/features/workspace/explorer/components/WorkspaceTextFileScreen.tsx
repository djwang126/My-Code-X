import type { RefObject } from 'react';

import { MarkdownMessage } from '../../../../shared/components/markdown';
import type { WorkspaceTextFile } from '..';
import { getTextFileBadges, isMarkdownFile } from './workspace-file-explorer-view';

interface WorkspaceTextFileScreenProps {
  detail: WorkspaceTextFile;
  draft: string;
  dirty: boolean;
  saving: boolean;
  isEditScreen: boolean;
  previewRef: RefObject<HTMLDivElement | null>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange?: (draft: string) => void;
  onDiscard?: () => void;
  onEnterEdit?: () => void;
  onSave?: () => void;
}

export function WorkspaceTextFileScreen({
  detail,
  draft,
  dirty,
  saving,
  isEditScreen,
  previewRef,
  editorRef,
  onDraftChange,
  onDiscard,
  onEnterEdit,
  onSave,
}: WorkspaceTextFileScreenProps) {
  const badges = getTextFileBadges(detail);
  const shouldRenderPreviewAsMarkdown = isMarkdownFile(detail.path);

  if (isEditScreen) {
    return (
      <div className="workspace-editor-stack">
        <div className="workspace-explorer-detail-meta">
          <div className="workspace-explorer-detail-badges">
            {badges.map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
          </div>
        </div>
        <label className="workspace-editor-label">
          <span className="workspace-editor-label-text">File content</span>
          <textarea
            aria-label="File content"
            className="workspace-editor-textarea"
            onChange={event => onDraftChange?.(event.target.value)}
            ref={editorRef}
            spellCheck={false}
            value={draft}
          />
        </label>
        <div className="workspace-editor-footer">
          <span className={`workspace-editor-status ${dirty ? 'dirty' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'No changes'}</span>
          <div className="workspace-editor-actions">
            <button className="workspace-action-btn" onClick={onDiscard} type="button">Discard</button>
            <button className="workspace-action-btn primary" disabled={!dirty || saving} onClick={onSave} type="button">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-editor-stack">
      <div className="workspace-explorer-detail-meta">
        <div className="workspace-explorer-detail-badges">
          {badges.map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
        </div>
        {detail.truncated ? <p className="workspace-editor-state-copy">Showing the preview first. Edit loads the full file.</p> : null}
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
          <button className="workspace-action-btn primary" onClick={onEnterEdit} type="button">Edit</button>
        </div>
      </div>
    </div>
  );
}
