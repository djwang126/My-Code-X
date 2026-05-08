import { FeedbackEmptyState, FeedbackMessage } from '../../../../shared/components/feedback';
import type { SavedWorkspace, WorkspaceDraft } from '../../bookmarks';
import type { WorkspaceThreadEntry } from '../../threads';
import { IconClose, IconFolder, IconGrid } from './WorkspaceNavigationIcons';

type WorkspaceHandler = (workspacePath: string) => boolean | Promise<boolean>;
type WorkspaceSaveHandler = (workspace: WorkspaceDraft) => boolean | Promise<boolean>;
type WorkspaceThreadHandler = (threadId: string) => boolean | Promise<boolean>;

type WorkspaceNavigationPanelProps = {
  open: boolean;
  workspace: string;
  threadId: string;
  threadStatusText: string;
  workspaceSwitchReason: string;
  savedWorkspaces: SavedWorkspace[];
  workspaceThreads: WorkspaceThreadEntry[];
  workspaceThreadsLoading: boolean;
  workspaceThreadsError: string;
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
  onWorkspaceThreadOpen?: WorkspaceThreadHandler;
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

function getWorkspaceThreadTitle(thread: WorkspaceThreadEntry) {
  return thread.name || thread.preview || `Thread ${thread.id.slice(0, 8)}…`;
}

export function WorkspaceNavigationPanel({
  open,
  workspace,
  threadId,
  workspaceSwitchReason,
  savedWorkspaces,
  workspaceThreads,
  workspaceThreadsLoading,
  workspaceThreadsError,
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
  onWorkspaceThreadOpen,
  onStartEditingWorkspace,
}: WorkspaceNavigationPanelProps) {
  const workspaceThreadsDisabled = isRestarting || Boolean(workspaceSwitchReason);
  const currentWorkspace = savedWorkspaces.find(savedWorkspace => savedWorkspace.path === workspace) ?? null;
  const workspaceSummaryLabel = currentWorkspace?.label || workspace.split(/[\\/]/).pop() || 'Not set';
  const workspaceSummaryPath = workspace || '';

  return (
    <aside aria-label="workspace navigation" className={`sidebar-left ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Workspace</h2>
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
                      <button className="workspace-action-btn primary" disabled={workspaceThreadsDisabled} onClick={() => void onWorkspaceOpen?.(savedWorkspace.path)} type="button">Open</button>
                      {savedWorkspace.lastThreadId ? <button className="workspace-action-btn" disabled={workspaceThreadsDisabled} onClick={() => void onWorkspaceResume?.(savedWorkspace.path)} type="button">Resume</button> : null}
                      <button aria-label={`Edit workspace ${savedWorkspace.label}`} className="workspace-action-btn" onClick={() => onStartEditingWorkspace(savedWorkspace)} type="button">Edit</button>
                      <button aria-label={`Remove workspace ${savedWorkspace.label}`} className="workspace-action-btn" onClick={() => void onWorkspaceRemove?.(savedWorkspace.path)} type="button">Remove</button>
                    </div>
                  </div>
                ))}
              </section>
            ) : <FeedbackEmptyState compact title="No saved workspaces yet." />}
          </>
        ) : null}
        <p className="sidebar-section-title">Threads</p>
        <section aria-label="workspace threads">
          {!workspace ? <FeedbackEmptyState compact title="Select a workspace to see saved threads." /> : null}
          {workspace && workspaceThreadsLoading ? <FeedbackMessage compact layout="subtle" title="Loading threads…" /> : null}
          {workspace && !workspaceThreadsLoading && workspaceThreadsError ? <FeedbackMessage compact layout="subtle" tone="error">{workspaceThreadsError}</FeedbackMessage> : null}
          {workspace && !workspaceThreadsLoading && !workspaceThreadsError && !workspaceThreads.length ? <FeedbackEmptyState compact title="No saved threads yet." /> : null}
          {workspace && !workspaceThreadsLoading && !workspaceThreadsError ? workspaceThreads.map(historyThread => {
            const title = getWorkspaceThreadTitle(historyThread);
            const preview = historyThread.name && historyThread.preview && historyThread.preview !== historyThread.name ? historyThread.preview : '';
            const timeText = formatHistoryTime(historyThread.updatedAt);
            return (
              <button className={`workspace-thread-card ${historyThread.id === threadId ? 'active' : ''}`} disabled={workspaceThreadsDisabled} key={historyThread.id} onClick={() => void onWorkspaceThreadOpen?.(historyThread.id)} type="button">
                <span className="workspace-thread-card-title">{title}</span>
                {preview ? <span className="workspace-thread-card-preview">{preview}</span> : null}
                <span className="workspace-thread-card-meta"><span>{historyThread.statusText || 'idle'}</span>{timeText ? <span>{timeText}</span> : null}</span>
              </button>
            );
          }) : null}
        </section>
      </div>
    </aside>
  );
}
