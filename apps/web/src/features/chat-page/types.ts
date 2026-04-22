import type { ReviewStartTarget } from '../thread-actions';
import type { RuntimeOptions, RuntimeSettings } from '../runtime-settings';
import type {
  ChatRuntimeState,
  SessionNotice,
  SessionPendingRequest,
  SessionSendInput,
  SessionTimelineItem,
  SessionTurnExecutionState,
  TimelineItemContentPayload,
} from '../chat-runtime/public-types';
import type { SessionState as SessionShellState } from '../session/public-types';
import type { SessionThreadHistoryItem } from '../thread-history';
import type { SavedWorkspace } from '../workspace-bookmarks';
import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../workspace-files';
import type { ChatPageFeedback } from './state/chat-page-state-types';

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
export type ChatPageWorkspaceSaveHandler = (workspace: { path: string; label: string }) => boolean | Promise<boolean>;
export type ChatPageActionHandler = () => boolean | Promise<boolean>;
export type ChatPageThreadHistoryHandler = (threadId: string) => boolean | Promise<boolean>;
export type ChatPageMessageForkHandler = (messageId: string) => boolean | Promise<boolean>;
export type ChatPageTimelineItemContentHandler = (itemId: string) => TimelineItemContentPayload | Promise<TimelineItemContentPayload>;
export type ChatPageReviewStartHandler = (
  payload: { delivery: 'inline' | 'detached'; target: ReviewStartTarget },
) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFilePathHandler = (path: string) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFileLinkHandler = (href: string) => boolean | Promise<boolean>;
export type ChatPageWorkspaceFileLinkMatcher = (href: string) => boolean;
export type ChatPageWorkspaceFileDraftChangeHandler = (draft: string) => void;
export type ChatPageAttachmentUploadHandler = (file: File) => Promise<{ attachmentId: string }>;

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
  threadHistory?: SessionThreadHistoryItem[];
  threadHistoryLoading?: boolean;
  threadHistoryError?: string;
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
  onThreadHistoryOpen?: ChatPageThreadHistoryHandler;
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
  onWorkspaceFileSave?: ChatPageActionHandler;
  onWorkspaceFileLinkOpen?: ChatPageWorkspaceFileLinkHandler;
  isWorkspaceFileLink?: ChatPageWorkspaceFileLinkMatcher;
};
