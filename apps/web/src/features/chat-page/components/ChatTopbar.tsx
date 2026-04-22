import { IconChevronDown, IconMenu, IconTools } from '../../../shared/chat-ui/ChatIcons';

type ChatTopbarProps = {
  displayTitle: string;
  status: string;
  statusDotClass: string;
  leftOpen: boolean;
  rightOpen: boolean;
  settingsOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleSettings: () => void;
};

export function ChatTopbar({
  displayTitle,
  status,
  statusDotClass,
  leftOpen,
  rightOpen,
  settingsOpen,
  onToggleLeft,
  onToggleRight,
  onToggleSettings,
}: ChatTopbarProps) {
  return (
    <header className="topbar">
      <button aria-label="Toggle workspace sidebar" className={`topbar-btn ${leftOpen ? 'active' : ''}`} onClick={onToggleLeft} type="button">
        <IconMenu />
      </button>
      <div aria-label="Toggle settings" className={`topbar-center ${settingsOpen ? 'active' : ''}`} onClick={onToggleSettings} role="button" tabIndex={0}>
        <span className={`topbar-status-dot ${statusDotClass}`} />
        <div className="topbar-text">
          <span className="topbar-title">{displayTitle}</span>
          <span className="topbar-status-text">{status}</span>
        </div>
        <IconChevronDown />
      </div>
      <button aria-label="Toggle tools sidebar" className={`topbar-btn ${rightOpen ? 'active' : ''}`} onClick={onToggleRight} type="button">
        <IconTools />
      </button>
    </header>
  );
}
