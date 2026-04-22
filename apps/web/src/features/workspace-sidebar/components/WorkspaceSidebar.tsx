import { FeedbackEmptyState, FeedbackMessage } from '../../../shared/components/feedback';
import type { SavedWorkspace } from '../../workspace-bookmarks';
import type { SessionThreadHistoryItem } from '../../thread-history';
import { IconClose, IconFolder, IconGrid } from './WorkspaceSidebarIcons';

type WorkspaceHandler = (workspacePath: string) => boolean | Promise<boolean>;
type WorkspaceSaveHandler = (workspace: { path: string; label: string }) => boolean | Promise<boolean>;
type ThreadHistoryHandler = (threadId: string) => boolean | Promise<boolean>;

type WorkspaceSidebarProps = {
  open: boolean;
  workspace: string;
  threadId: string;
  threadStatusText: string;
  workspaceSwitchReason: string;
  savedWorkspaces: SavedWorkspace[];
  threadHistory: SessionThreadHistoryItem[];
  threadHistoryLoading: boolean;
  threadHistoryError: string;
  workspacePathDraft: string;
  workspaceLabelDraft: string;
  manageWorkspaceOpen: boolean;
  isRestarting: boolean;
  onClose: () => void;
  onManageWorkspaceToggle: () => void;
  onWorkspacePathDraftChange: (value: string) => void;
  onWorkspaceLabelDraftChange: (value: string) => void;
  onWorkspaceSave?: WorkspaceSaveHandler;
  onWorkspaceOpen?: WorkspaceHandler;
  onWorkspaceResume?: WorkspaceHandler;
  onWorkspaceRemove?: WorkspaceHandler;
  onThreadHistoryOpen?: ThreadHistoryHandler;
  onStartEditingWorkspace: (workspace: SavedWorkspace) => void;
};

function formatHistoryTime(unixSeconds: number) {
  if (!unixSeconds) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(unixSeconds * 1000));
  } catch {
    return '';
  }
}

function getThreadHistoryTitle(thread: SessionThreadHistoryItem) {
  return thread.name || thread.preview || `Thread ${thread.id.slice(0, 8)}…`;
}

export function WorkspaceSidebar({
  open,
  workspace,
  threadId,
  workspaceSwitchReason,
  savedWorkspaces,
  threadHistory,
  threadHistoryLoading,
  threadHistoryError,
  workspacePathDraft,
  workspaceLabelDraft,
  manageWorkspaceOpen,
  isRestarting,
  onClose,
  onManageWorkspaceToggle,
  onWorkspacePathDraftChange,
  onWorkspaceLabelDraftChange,
  onWorkspaceSave,
  onWorkspaceOpen,
  onWorkspaceResume,
  onWorkspaceRemove,
  onThreadHistoryOpen,
  onStartEditingWorkspace,
}: WorkspaceSidebarProps) {
  const threadHistoryDisabled = isRestarting || Boolean(workspaceSwitchReason);
  const currentWorkspace = savedWorkspaces.find(savedWorkspace => savedWorkspace.path === workspace) ?? null;
  const workspaceSummaryLabel = currentWorkspace?.label || workspace.split(/[\\/]/).pop() || 'Not set';
  const workspaceSummaryPath = workspace || '';

  return (
    <aside aria-label="session management" className={`sidebar-left ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Session management</h2>
        <button aria-label="Close sidebar" className="sidebar-close-btn" onClick={onClose} type="button"><IconClose /></button>
      </div>
      <div className="sidebar-body">
        <p className="sidebar-section-title">Workspace</p>
        <section aria-label="workspace summary" className="workspace-summary-card">
          <div className="workspace-summary-header"><IconFolder /><span className="workspace-summary-label">{workspaceSummaryLabel}</span></div>
          {workspaceSummaryPath ? <div className="workspace-summary-path">{workspaceSummaryPath}</div> : null}
        </section>
        <button aria-expanded={manageWorkspaceOpen} className="workspace-action-btn sidebar-section-toggle" onClick={onManageWorkspaceToggle} type="button">Manage workspace</button>
        {manageWorkspaceOpen ? (
          <>
            <p className="sidebar-section-title">Add workspace</p>
            <form className="workspace-form" aria-label="workspace form" onSubmit={event => { event.preventDefault(); void onWorkspaceSave?.({ path: workspacePathDraft, label: workspaceLabelDraft }); }}>
              <input aria-label="Workspace path" className="workspace-form-input" onChange={event => onWorkspacePathDraftChange(event.target.value)} placeholder="Workspace path" value={workspacePathDraft} />
              <input aria-label="Workspace label" className="workspace-form-input" onChange={event => onWorkspaceLabelDraftChange(event.target.value)} placeholder="Label (optional)" value={workspaceLabelDraft} />
              <button className="workspace-action-btn primary" type="submit">Save workspace</button>
            </form>
            <p className="sidebar-section-title">Saved workspaces</p>
            {savedWorkspaces.length ? (
              <section aria-label="saved workspaces">
                {savedWorkspaces.map(savedWorkspace => (
                  <div className={`workspace-card ${savedWorkspace.path === workspace ? 'active' : ''}`} key={savedWorkspace.path}>
                    <span className="workspace-card-label"><IconGrid />{savedWorkspace.label || savedWorkspace.path.split(/[\\/]/).pop()}</span>
                    <span className="workspace-card-path">{savedWorkspace.path}</span>
                    <div className="workspace-card-actions">
                      <button className="workspace-action-btn primary" disabled={threadHistoryDisabled} onClick={() => void onWorkspaceOpen?.(savedWorkspace.path)} type="button">Open</button>
                      {savedWorkspace.lastThreadId ? <button className="workspace-action-btn" disabled={threadHistoryDisabled} onClick={() => void onWorkspaceResume?.(savedWorkspace.path)} type="button">Resume</button> : null}
                      <button aria-label={`Edit workspace ${savedWorkspace.label}`} className="workspace-action-btn" onClick={() => onStartEditingWorkspace(savedWorkspace)} type="button">Edit</button>
                      <button aria-label={`Remove workspace ${savedWorkspace.label}`} className="workspace-action-btn" onClick={() => void onWorkspaceRemove?.(savedWorkspace.path)} type="button">Remove</button>
                    </div>
                  </div>
                ))}
              </section>
            ) : <FeedbackEmptyState compact title="No saved workspaces yet." />}
          </>
        ) : null}
        <p className="sidebar-section-title">Thread history</p>
        <section aria-label="thread history">
          {!workspace ? <FeedbackEmptyState compact title="Select a workspace to see thread history." /> : null}
          {workspace && threadHistoryLoading ? <FeedbackMessage compact layout="subtle" title="Loading thread history…" /> : null}
          {workspace && !threadHistoryLoading && threadHistoryError ? <FeedbackMessage compact layout="subtle" tone="error">{threadHistoryError}</FeedbackMessage> : null}
          {workspace && !threadHistoryLoading && !threadHistoryError && !threadHistory.length ? <FeedbackEmptyState compact title="No thread history yet." /> : null}
          {workspace && !threadHistoryLoading && !threadHistoryError ? threadHistory.map(historyThread => {
            const title = getThreadHistoryTitle(historyThread);
            const preview = historyThread.name && historyThread.preview && historyThread.preview !== historyThread.name ? historyThread.preview : '';
            const timeText = formatHistoryTime(historyThread.updatedAt);
            return (
              <button className={`thread-history-card ${historyThread.id === threadId ? 'active' : ''}`} disabled={threadHistoryDisabled} key={historyThread.id} onClick={() => void onThreadHistoryOpen?.(historyThread.id)} type="button">
                <span className="thread-history-card-title">{title}</span>
                {preview ? <span className="thread-history-card-preview">{preview}</span> : null}
                <span className="thread-history-card-meta"><span>{historyThread.statusText || 'idle'}</span>{timeText ? <span>{timeText}</span> : null}</span>
              </button>
            );
          }) : null}
        </section>
      </div>
    </aside>
  );
}
