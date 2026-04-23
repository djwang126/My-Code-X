import type { ReviewStartTarget } from '../../features/tools/review';
import type { RuntimeOptions, RuntimeSettings } from '../../features/chat/settings';
import type {
  ChatRuntimeState,
  SessionNotice,
  SessionPendingRequest,
  SessionSendInput,
  SessionTimelineItem,
  SessionTurnExecutionState,
  TimelineItemContentPayload,
} from '../../features/chat/runtime';
import type { SessionState as SessionShellState } from '../../features/session';
import type { WorkspaceThreadEntry } from '../../features/workspace/threads';
import type { SavedWorkspace, WorkspaceDraft } from '../../features/workspace/bookmarks';
import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../../features/workspace/explorer';
import type { ChatPageFeedback } from './state/page-state-types';

export type ChatReviewStartInput = {
  delivery: 'inline' | 'detached';
  target: ReviewStartTarget;
};

export type ChatAttachmentUploadResult = {
  attachmentId: string;
};

export type ChatPageRuntimeState = {
  phase: SessionShellState['phase'];
  viewerId: SessionShellState['viewerId'];
  slotId: SessionShellState['slotId'];
  workspace: SessionShellState['workspace'];
  threadId: string;
  serverInstanceId: SessionShellState['serverInstanceId'];
  statusMessage: string;
  errorMessage: string;
  turnExecution: SessionTurnExecutionState;
  threadName: ChatRuntimeState['threadName'];
  threadStatusText: ChatRuntimeState['threadStatusText'];
  tokenUsageText: ChatRuntimeState['tokenUsageText'];
  notices: SessionNotice[];
  pendingRequests: SessionPendingRequest[];
  messages: SessionTimelineItem[];
  preferences: ChatRuntimeState['preferences'];
  options: ChatRuntimeState['options'];
};

export type ChatPageSubmitHandler = (input: SessionSendInput) => boolean | Promise<boolean>;
export type ChatPageInterruptHandler = () => boolean | Promise<boolean>;
export type ChatPageRequestResponseHandler = (
  requestId: string,
  response: Record<string, unknown>,
) => boolean | Promise<boolean>;
export type ChatPageWorkspaceHandler = (workspacePath: string) => boolean | Promise<boolean>;
export type ChatPageWorkspaceSaveHandler = (workspace: WorkspaceDraft) => boolean | Promise<boolean>;
export type ChatPageActionHandler = () => boolean | Promise<boolean>;
export type ChatPageWorkspaceThreadHandler = (threadId: string) => boolean | Promise<boolean>;
export type ChatPageMessageForkHandler = (messageId: string) => boolean | Promise<boolean>;
export type ChatPageTimelineItemContentHandler = (itemId: string) => TimelineItemContentPayload | Promise<TimelineItemContentPayload>;
export type ChatPageReviewStartHandler = (payload: ChatReviewStartInput) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFilePathHandler = (path: string) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFileLinkHandler = (href: string) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFileLinkMatcher = (href: string) => boolean;
export type ChatPageWorkspaceFileDraftChangeHandler = (draft: string) => void;
export type ChatPageAttachmentUploadHandler = (file: File) => Promise<ChatAttachmentUploadResult>;

export type ChatPageProps = {
  title: string;
  status: string;
  workspace: string;
  threadId: string;
  turnExecution: SessionTurnExecutionState;
  threadName?: string;
  threadStatusText?: string;
  tokenUsageText?: string;
  savedWorkspaces?: SavedWorkspace[];
  workspaceThreads?: WorkspaceThreadEntry[];
  workspaceThreadsLoading?: boolean;
  workspaceThreadsError?: string;
  notices?: SessionNotice[];
  pendingRequests?: SessionPendingRequest[];
  messages: SessionTimelineItem[];
  runtimeSettings?: RuntimeSettings | null;
  runtimeOptions?: RuntimeOptions | null;
  actionBlocked?: boolean;
  inputDisabled?: boolean;
  sendButtonDisabled?: boolean;
  isRestarting?: boolean;
  interruptPending?: boolean;
  pageFeedback?: ChatPageFeedback | null;
  onInterrupt?: ChatPageInterruptHandler;
  onSubmit?: ChatPageSubmitHandler;
  onUploadAttachment?: ChatPageAttachmentUploadHandler;
  onRuntimeSettingsChange?: (settings: RuntimeSettings) => void;
  onRequestResponse?: ChatPageRequestResponseHandler;
  onWorkspaceSave?: ChatPageWorkspaceSaveHandler;
  onWorkspaceOpen?: ChatPageWorkspaceHandler;
  onWorkspaceResume?: ChatPageWorkspaceHandler;
  onWorkspaceRemove?: ChatPageWorkspaceHandler;
  onWorkspaceThreadOpen?: ChatPageWorkspaceThreadHandler;
  onMessageFork?: ChatPageMessageForkHandler;
  onTimelineItemContentLoad?: ChatPageTimelineItemContentHandler;
  onNewThread?: ChatPageActionHandler;
  onRestart?: ChatPageActionHandler;
  onRollback?: ChatPageActionHandler;
  onCompact?: ChatPageActionHandler;
  onReviewStart?: ChatPageReviewStartHandler;
  canCycleCollaborationMode?: boolean;
  collaborationModeLabel?: string;
  onCycleCollaborationMode?: ChatPageActionHandler;
  onConfirmProposedPlanAction?: ChatPageActionHandler;
  onDismissProposedPlanAction?: ChatPageActionHandler;
  workspaceSwitchReason?: string;
  workspaceExplorerOpen?: boolean;
  workspaceExplorerLoading?: boolean;
  workspaceExplorerError?: string;
  workspaceExplorerNotice?: string;
  workspaceExplorerPath?: string;
  workspaceExplorerEntries?: WorkspaceFileEntry[];
  workspaceFileDetail?: WorkspaceFileDetail | null;
  workspaceFileDraft?: string;
  workspaceFileDirty?: boolean;
  workspaceFileSaving?: boolean;
  onWorkspaceExplorerOpen?: ChatPageActionHandler;
  onWorkspaceExplorerClose?: ChatPageActionHandler;
  onWorkspaceExplorerNavigate?: ChatPageWorkspaceFilePathHandler;
  onWorkspaceFileOpen?: ChatPageWorkspaceFilePathHandler;
  onWorkspaceFileDraftChange?: ChatPageWorkspaceFileDraftChangeHandler;
  onWorkspaceTextEditStart?: ChatPageActionHandler;
  onWorkspaceFileSave?: ChatPageActionHandler;
  onWorkspaceFileLinkOpen?: ChatPageWorkspaceFileLinkHandler;
  isWorkspaceFileLink?: ChatPageWorkspaceFileLinkMatcher;
};
