import { IconClose } from '../../../../shared/chat-ui/ChatIcons';

interface WorkspaceExplorerHeaderProps {
  detailPath: string;
  isListScreen: boolean;
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}

export function WorkspaceExplorerHeader({
  detailPath,
  isListScreen,
  title,
  onBack,
  onClose,
}: WorkspaceExplorerHeaderProps) {
  return (
    <div className="workspace-explorer-header">
      {isListScreen ? (
        <button aria-label="Close File Explorer" className="workspace-explorer-nav-btn" onClick={onClose} type="button">
          <IconClose />
        </button>
      ) : (
        <button className="workspace-explorer-back-btn" onClick={onBack} type="button">
          ← Back
        </button>
      )}
      <div className="workspace-explorer-header-copy">
        <h2>{title}</h2>
        {!isListScreen && detailPath ? <p>{detailPath}</p> : null}
      </div>
      <span aria-hidden="true" className="workspace-explorer-header-spacer" />
    </div>
  );
}
