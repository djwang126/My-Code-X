import type { FormEvent } from 'react';

import type { ChatPageProps } from '../types';
import type { RuntimeOptions, RuntimeSettings } from '../../../features/chat/settings';
import { RuntimeSettingsDrawer } from '../../../features/chat/settings';
import { ToolsPanel } from '../../../features/tools/panel';
import type { SavedWorkspace } from '../../../features/workspace/bookmarks';
import { WorkspaceFileExplorer } from '../../../features/workspace/explorer';
import { WorkspaceNavigationPanel } from '../../../features/workspace/navigation';
import { ChatTopbar } from './ChatTopbar';
import {
  getCollaborationModeOptions,
  getPromptOverrideOptions,
  getReasoningEffortOptions,
  getReasoningSummaryOptions,
} from '../../../features/chat/settings';
import { getRuntimeSelectOptions, getStatusClass } from '../lib/chat-view';

type ChatPageChromeProps = {
  title: string;
  status: string;
  threadId: string;
  threadName: string;
  hasThread: boolean;
  hasWorkspace: boolean;
  isRestarting: boolean;
  actionBlocked: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  settingsOpen: boolean;
  manageWorkspaceOpen: boolean;
  reviewChooserOpen: boolean;
  workspaceSwitchReason: string;
  tokenUsageText: string;
  threadStatusText: string;
  savedWorkspaces: NonNullable<ChatPageProps['savedWorkspaces']>;
  workspaceThreads: NonNullable<ChatPageProps['workspaceThreads']>;
  workspaceThreadsLoading: boolean;
  workspaceThreadsError: string;
  workspace: string;
  workspacePathDraft: string;
  workspaceLabelDraft: string;
  reviewTargetType: 'uncommittedChanges' | 'baseBranch' | 'commit' | 'custom';
  reviewDelivery: 'inline' | 'detached';
  reviewBaseBranch: string;
  reviewCommitSha: string;
  reviewCommitTitle: string;
  reviewCustomInstructions: string;
  runtimeSettings: RuntimeSettings | null;
  runtimeOptions: RuntimeOptions | null;
  workspaceExplorerOpen: boolean;
  workspaceExplorerLoading: boolean;
  workspaceExplorerError: string;
  workspaceExplorerNotice: string;
  workspaceExplorerPath: string;
  workspaceExplorerEntries: NonNullable<ChatPageProps['workspaceExplorerEntries']>;
  workspaceFileDetail: ChatPageProps['workspaceFileDetail'];
  workspaceFileDraft: string;
  workspaceFileDirty: boolean;
  workspaceFileSaving: boolean;
  onToggleLeft: () => void | Promise<void>;
  onToggleRight: () => void | Promise<void>;
  onToggleSettings: () => void | Promise<void>;
  onRuntimeSettingChange: <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => void;
  onCloseLeft: () => void;
  onManageWorkspaceToggle: () => void;
  onStartEditingWorkspace: (workspace: SavedWorkspace) => void;
  onWorkspaceThreadOpen?: ChatPageProps['onWorkspaceThreadOpen'];
  onWorkspaceLabelDraftChange: (value: string) => void;
  onWorkspaceOpen?: ChatPageProps['onWorkspaceOpen'];
  onWorkspacePathDraftChange: (value: string) => void;
  onWorkspaceRemove?: ChatPageProps['onWorkspaceRemove'];
  onWorkspaceResume?: ChatPageProps['onWorkspaceResume'];
  onWorkspaceSave?: ChatPageProps['onWorkspaceSave'];
  onCloseRight: () => void;
  onRestart?: ChatPageProps['onRestart'];
  onReviewBaseBranchChange: (value: string) => void;
  onReviewCommitShaChange: (value: string) => void;
  onReviewCommitTitleChange: (value: string) => void;
  onReviewCustomInstructionsChange: (value: string) => void;
  onReviewDeliveryChange: (value: 'inline' | 'detached') => void;
  onReviewStart: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onReviewTargetTypeChange: (value: 'uncommittedChanges' | 'baseBranch' | 'commit' | 'custom') => void;
  onToggleReviewChooser: () => void;
  onWorkspaceExplorerOpen?: ChatPageProps['onWorkspaceExplorerOpen'];
  onWorkspaceExplorerClose?: ChatPageProps['onWorkspaceExplorerClose'];
  onWorkspaceFileDraftChange?: ChatPageProps['onWorkspaceFileDraftChange'];
  onWorkspaceExplorerNavigate?: ChatPageProps['onWorkspaceExplorerNavigate'];
  onWorkspaceFileOpen?: ChatPageProps['onWorkspaceFileOpen'];
  onWorkspaceFileSave?: ChatPageProps['onWorkspaceFileSave'];
};

export function ChatPageChrome(props: ChatPageChromeProps) {
  const displayTitle = props.threadName || (props.hasThread ? `Thread ${props.threadId.slice(0, 8)}…` : props.title);
  const statusDotClass = getStatusClass(props.status);
  const modelOptions = props.runtimeSettings && props.runtimeOptions ? getRuntimeSelectOptions(props.runtimeOptions.models, props.runtimeSettings.model) : [];
  const reasoningEffortOptions = props.runtimeSettings && props.runtimeOptions ? getReasoningEffortOptions(props.runtimeOptions, props.runtimeSettings) : [];
  const reasoningSummaryOptions = props.runtimeSettings && props.runtimeOptions ? getReasoningSummaryOptions(props.runtimeOptions, props.runtimeSettings) : [];
  const approvalPolicyOptions = props.runtimeSettings && props.runtimeOptions ? getRuntimeSelectOptions(props.runtimeOptions.approvalPolicies, props.runtimeSettings.approvalPolicy) : [];
  const promptOverrideOptions = props.runtimeSettings && props.runtimeOptions ? getPromptOverrideOptions(props.runtimeOptions, props.runtimeSettings) : [];
  const sandboxModeOptions = props.runtimeSettings && props.runtimeOptions ? getRuntimeSelectOptions(props.runtimeOptions.sandboxModes, props.runtimeSettings.sandboxMode) : [];
  const collaborationModeOptions = props.runtimeSettings && props.runtimeOptions
    ? [{ value: '', label: 'None' }, ...getCollaborationModeOptions(props.runtimeOptions, props.runtimeSettings).map(option => ({ value: option.kind, label: option.label }))]
    : [{ value: '', label: 'None' }];

  return (
    <>
      <ChatTopbar
        displayTitle={displayTitle}
        leftOpen={props.leftOpen}
        onToggleLeft={() => void props.onToggleLeft()}
        onToggleRight={() => void props.onToggleRight()}
        onToggleSettings={() => void props.onToggleSettings()}
        rightOpen={props.rightOpen}
        settingsOpen={props.settingsOpen}
        status={props.status}
        statusDotClass={statusDotClass}
      />
      <RuntimeSettingsDrawer
        approvalPolicyOptions={approvalPolicyOptions}
        collaborationModeOptions={collaborationModeOptions}
        modelOptions={modelOptions}
        onRuntimeSettingChange={props.onRuntimeSettingChange}
        open={props.settingsOpen}
        promptOverrideOptions={promptOverrideOptions}
        reasoningEffortOptions={reasoningEffortOptions}
        reasoningSummaryOptions={reasoningSummaryOptions}
        runtimeSettings={props.runtimeSettings}
        sandboxModeOptions={sandboxModeOptions}
      />
      <WorkspaceNavigationPanel
        isRestarting={props.isRestarting}
        manageWorkspaceOpen={props.manageWorkspaceOpen}
        onClose={props.onCloseLeft}
        onManageWorkspaceToggle={props.onManageWorkspaceToggle}
        onStartEditingWorkspace={props.onStartEditingWorkspace}
        onWorkspaceThreadOpen={props.onWorkspaceThreadOpen}
        onWorkspaceLabelDraftChange={props.onWorkspaceLabelDraftChange}
        onWorkspaceOpen={props.onWorkspaceOpen}
        onWorkspacePathDraftChange={props.onWorkspacePathDraftChange}
        onWorkspaceRemove={props.onWorkspaceRemove}
        onWorkspaceResume={props.onWorkspaceResume}
        onWorkspaceSave={props.onWorkspaceSave}
        open={props.leftOpen}
        savedWorkspaces={props.savedWorkspaces}
        workspaceThreads={props.workspaceThreads}
        workspaceThreadsError={props.workspaceThreadsError}
        workspaceThreadsLoading={props.workspaceThreadsLoading}
        threadId={props.threadId}
        threadStatusText={props.threadStatusText}
        workspace={props.workspace}
        workspaceLabelDraft={props.workspaceLabelDraft}
        workspacePathDraft={props.workspacePathDraft}
        workspaceSwitchReason={props.workspaceSwitchReason}
      />
      <ToolsPanel
        actionBlocked={props.actionBlocked}
        hasThread={props.hasThread}
        hasWorkspace={props.hasWorkspace}
        isRestarting={props.isRestarting}
        onClose={props.onCloseRight}
        onRestart={props.onRestart}
        onReviewBaseBranchChange={props.onReviewBaseBranchChange}
        onReviewCommitShaChange={props.onReviewCommitShaChange}
        onReviewCommitTitleChange={props.onReviewCommitTitleChange}
        onReviewCustomInstructionsChange={props.onReviewCustomInstructionsChange}
        onReviewDeliveryChange={props.onReviewDeliveryChange}
        onReviewStart={props.onReviewStart}
        onReviewTargetTypeChange={props.onReviewTargetTypeChange}
        onToggleReviewChooser={props.onToggleReviewChooser}
        onWorkspaceExplorerOpen={props.onWorkspaceExplorerOpen}
        open={props.rightOpen}
        reviewBaseBranch={props.reviewBaseBranch}
        reviewChooserOpen={props.reviewChooserOpen}
        reviewCommitSha={props.reviewCommitSha}
        reviewCommitTitle={props.reviewCommitTitle}
        reviewCustomInstructions={props.reviewCustomInstructions}
        reviewDelivery={props.reviewDelivery}
        reviewTargetType={props.reviewTargetType}
        tokenUsageText={props.tokenUsageText}
      />
      <WorkspaceFileExplorer
        currentPath={props.workspaceExplorerPath}
        dirty={props.workspaceFileDirty}
        draft={props.workspaceFileDraft}
        entries={props.workspaceExplorerEntries}
        errorMessage={props.workspaceExplorerError}
        fileDetail={props.workspaceFileDetail ?? null}
        loading={props.workspaceExplorerLoading}
        notice={props.workspaceExplorerNotice}
        onClose={() => void props.onWorkspaceExplorerClose?.()}
        onDraftChange={props.onWorkspaceFileDraftChange}
        onNavigate={path => void props.onWorkspaceExplorerNavigate?.(path)}
        onOpenFile={path => void props.onWorkspaceFileOpen?.(path)}
        onSave={() => void props.onWorkspaceFileSave?.()}
        open={props.workspaceExplorerOpen}
        saving={props.workspaceFileSaving}
      />
    </>
  );
}
