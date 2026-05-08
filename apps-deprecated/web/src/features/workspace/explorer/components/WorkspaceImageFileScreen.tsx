import type { CSSProperties, RefObject } from 'react';

import { OverlayDialog } from '../../../../shared/components/overlay';
import type { WorkspaceImageFile } from '..';
import { getBinaryFileBadges } from './workspace-file-explorer-view';

const previewImageStyle: CSSProperties = {
  maxWidth: 'min(24rem, 100%)',
  borderRadius: '0.75rem',
};

interface WorkspaceImageFileScreenProps {
  detail: WorkspaceImageFile;
  previewImageOpen: boolean;
  previewRef: RefObject<HTMLDivElement | null>;
  onClosePreview: () => void;
  onOpenPreview: () => void;
}

export function WorkspaceImageFileScreen({
  detail,
  previewImageOpen,
  previewRef,
  onClosePreview,
  onOpenPreview,
}: WorkspaceImageFileScreenProps) {
  const badges = getBinaryFileBadges(detail);

  return (
    <>
      <div className="workspace-editor-stack">
        <div className="workspace-explorer-detail-meta">
          <div className="workspace-explorer-detail-badges">
            {badges.map(badge => <span key={badge} className="workspace-explorer-detail-badge">{badge}</span>)}
          </div>
        </div>
        <button className="workspace-action-btn" onClick={onOpenPreview} type="button">Open image preview</button>
        <div className="workspace-editor-preview-content" ref={previewRef}>
          <button className="workspace-action-btn" onClick={onOpenPreview} type="button">
            <img alt={detail.name} src={detail.url} style={previewImageStyle} />
          </button>
        </div>
      </div>

      <OverlayDialog
        ariaLabel="Workspace image preview"
        onClose={onClosePreview}
        open={previewImageOpen}
        showCloseButton={false}
        title={detail.name}
        width="min(28rem, 100%)"
      >
        <img alt="Workspace image preview content" src={detail.url} style={previewImageStyle} />
      </OverlayDialog>
    </>
  );
}
