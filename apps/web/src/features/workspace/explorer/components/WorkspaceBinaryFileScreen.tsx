import type { WorkspaceBinaryFile } from '..';
import { getBinaryFileBadges } from './workspace-file-explorer-view';

interface WorkspaceBinaryFileScreenProps {
  detail: WorkspaceBinaryFile;
}

export function WorkspaceBinaryFileScreen({ detail }: WorkspaceBinaryFileScreenProps) {
  return (
    <div className="workspace-editor-state-card workspace-editor-empty">
      <p className="workspace-editor-state-title">{detail.name}</p>
      <p className="workspace-editor-state-copy">{getBinaryFileBadges(detail).join(' · ')}</p>
    </div>
  );
}
