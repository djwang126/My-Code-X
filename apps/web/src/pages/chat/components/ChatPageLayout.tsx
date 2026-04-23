import { useEffect, useRef, useState } from 'react';

import { createThreadConversationActions } from '../../../features/chat/commands';
import { useCollapsibleChatTodo } from '../../../features/chat/todo';
import { ChatPageChrome } from './ChatPageChrome';
import { ChatPageConversation } from './ChatPageConversation';
import { ChatPageFeedbackRegion } from './ChatPageFeedbackRegion';
import { useChatPageLayoutState } from '../hooks/useChatPageLayoutState';
import { useChatPageLayoutViewModel } from '../hooks/useChatPageLayoutViewModel';
import type { ChatPageProps } from '../types';

import '../styles/app-shell.css';

export function ChatPageLayout(props: ChatPageProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptSectionRef = useRef<HTMLElement>(null);
  const [shouldFollowTranscript, setShouldFollowTranscript] = useState(true);
  const interruptPending = props.interruptPending ?? false;
  const isRestarting = props.isRestarting ?? false;
  const pendingRequests = props.pendingRequests ?? [];
  const runtimeOptions = props.runtimeOptions ?? null;
  const runtimeSettings = props.runtimeSettings ?? null;
  const savedWorkspaces = props.savedWorkspaces ?? [];
  const workspaceThreads = props.workspaceThreads ?? [];
  const workspaceThreadsError = props.workspaceThreadsError ?? '';
  const workspaceThreadsLoading = props.workspaceThreadsLoading ?? false;
  const threadName = props.threadName ?? '';
  const threadStatusText = props.threadStatusText ?? '';
  const tokenUsageText = props.tokenUsageText ?? '';
  const workspaceExplorerEntries = props.workspaceExplorerEntries ?? [];
  const workspaceExplorerError = props.workspaceExplorerError ?? '';
  const workspaceExplorerLoading = props.workspaceExplorerLoading ?? false;
  const workspaceExplorerNotice = props.workspaceExplorerNotice ?? '';
  const workspaceExplorerOpen = props.workspaceExplorerOpen ?? false;
  const workspaceExplorerPath = props.workspaceExplorerPath ?? '';
  const workspaceFileDetail = props.workspaceFileDetail ?? null;
  const workspaceFileDirty = props.workspaceFileDirty ?? false;
  const workspaceFileDraft = props.workspaceFileDraft ?? '';
  const workspaceFileSaving = props.workspaceFileSaving ?? false;
  const workspaceSwitchReason = props.workspaceSwitchReason ?? '';
  const { fallbackViewModel, partitionedPendingRequests, activeTodoList, chatToasts, proposedPlanActionTurnId, showProposedPlanAction } =
    useChatPageLayoutViewModel(props);
  const actionBlocked = props.actionBlocked ?? fallbackViewModel.actionBlocked;
  const inputDisabled = props.inputDisabled ?? fallbackViewModel.inputDisabled;
  const sendButtonDisabled = props.sendButtonDisabled ?? fallbackViewModel.sendButtonDisabled;

  const layoutState = useChatPageLayoutState({
    inputDisabled,
    workspaceExplorerOpen,
    runtimeSettings,
    onSubmit: props.onSubmit,
    onUploadAttachment: props.onUploadAttachment,
    onRuntimeSettingsChange: props.onRuntimeSettingsChange,
    onReviewStart: props.onReviewStart,
    onWorkspaceSave: props.onWorkspaceSave,
    onWorkspaceOpen: props.onWorkspaceOpen,
    onWorkspaceExplorerOpen: props.onWorkspaceExplorerOpen,
    onWorkspaceExplorerClose: props.onWorkspaceExplorerClose,
  });
  const { visibleTodo, todoCollapsed, toggleCollapsed } = useCollapsibleChatTodo({
    activeTodo: activeTodoList,
    threadId: props.threadId,
    workspace: props.workspace,
  });
  const conversationActions = createThreadConversationActions({
    onCompact: props.onCompact,
    onNewThread: props.onNewThread,
    onRollback: props.onRollback,
    setBottomDrawerOpen: layoutState.setBottomDrawerOpen,
  });
  const hasAttachmentBlockingState = layoutState.attachmentDraftItems.some(item => item.status !== 'ready');
  const resolvedSendButtonDisabled = sendButtonDisabled || hasAttachmentBlockingState;
  const anyOverlay =
    layoutState.leftOpen || layoutState.rightOpen || layoutState.settingsOpen || workspaceExplorerOpen || layoutState.attachmentDialogOpen;

  function updateTranscriptFollowState() {
    const transcriptSection = transcriptSectionRef.current;
    if (!transcriptSection) {
      return;
    }

    const distanceFromBottom =
      transcriptSection.scrollHeight - (transcriptSection.scrollTop + transcriptSection.clientHeight);

    setShouldFollowTranscript(distanceFromBottom <= 48);
  }

  useEffect(() => {
    if (!shouldFollowTranscript) {
      return;
    }

    const scrollIntoView = chatEndRef.current?.scrollIntoView;
    if (typeof scrollIntoView === 'function') {
      scrollIntoView.call(chatEndRef.current, { behavior: 'smooth' });
    }
  }, [pendingRequests.length, props.messages, shouldFollowTranscript]);

  return (
    <main className="app-shell">
      <h1 className="visually-hidden">{props.title}</h1>
      <p className="visually-hidden">Thread: {fallbackViewModel.hasThread ? props.threadId : 'New session'}</p>

      <div className={`overlay-backdrop ${anyOverlay ? 'visible' : ''}`} onClick={() => void layoutState.closeAllOverlays()} />

      <ChatPageChrome
        actionBlocked={actionBlocked}
        hasThread={fallbackViewModel.hasThread}
        hasWorkspace={fallbackViewModel.hasWorkspace}
        isRestarting={isRestarting}
        leftOpen={layoutState.leftOpen}
        manageWorkspaceOpen={layoutState.manageWorkspaceOpen}
        onCloseLeft={() => void layoutState.closeAllOverlays()}
        onCloseRight={() => void layoutState.closeAllOverlays()}
        onManageWorkspaceToggle={() => layoutState.setManageWorkspaceOpen(open => !open)}
        onRestart={props.onRestart}
        onReviewBaseBranchChange={layoutState.setReviewBaseBranch}
        onReviewCommitShaChange={layoutState.setReviewCommitSha}
        onReviewCommitTitleChange={layoutState.setReviewCommitTitle}
        onReviewCustomInstructionsChange={layoutState.setReviewCustomInstructions}
        onReviewDeliveryChange={layoutState.setReviewDelivery}
        onReviewStart={layoutState.handleReviewStart}
        onReviewTargetTypeChange={layoutState.setReviewTargetType}
        onRuntimeSettingChange={layoutState.updateRuntimeSetting}
        onStartEditingWorkspace={layoutState.startEditingWorkspace}
        onWorkspaceThreadOpen={props.onWorkspaceThreadOpen}
        onToggleLeft={layoutState.handleLeftToggle}
        onToggleReviewChooser={() => layoutState.setReviewChooserOpen(open => !open)}
        onToggleRight={layoutState.handleRightToggle}
        onToggleSettings={layoutState.handleSettingsToggle}
        onWorkspaceExplorerClose={props.onWorkspaceExplorerClose}
        onWorkspaceExplorerNavigate={props.onWorkspaceExplorerNavigate}
        onWorkspaceExplorerOpen={layoutState.handleWorkspaceExplorerOpenFromTools}
        onWorkspaceFileDraftChange={props.onWorkspaceFileDraftChange}
        onWorkspaceFileOpen={props.onWorkspaceFileOpen}
        onWorkspaceTextEditStart={props.onWorkspaceTextEditStart}
        onWorkspaceFileSave={props.onWorkspaceFileSave}
        onWorkspaceLabelDraftChange={layoutState.setWorkspaceLabelDraft}
        onWorkspaceOpen={layoutState.handleWorkspaceOpenAndCloseManager}
        onWorkspacePathDraftChange={layoutState.setWorkspacePathDraft}
        onWorkspaceRemove={props.onWorkspaceRemove}
        onWorkspaceResume={props.onWorkspaceResume}
        onWorkspaceSave={layoutState.handleWorkspaceSave}
        reviewBaseBranch={layoutState.reviewBaseBranch}
        reviewChooserOpen={layoutState.reviewChooserOpen}
        reviewCommitSha={layoutState.reviewCommitSha}
        reviewCommitTitle={layoutState.reviewCommitTitle}
        reviewCustomInstructions={layoutState.reviewCustomInstructions}
        reviewDelivery={layoutState.reviewDelivery}
        reviewTargetType={layoutState.reviewTargetType}
        rightOpen={layoutState.rightOpen}
        runtimeOptions={runtimeOptions}
        runtimeSettings={runtimeSettings}
        savedWorkspaces={savedWorkspaces}
        settingsOpen={layoutState.settingsOpen}
        status={props.status}
        workspaceThreads={workspaceThreads}
        workspaceThreadsError={workspaceThreadsError}
        workspaceThreadsLoading={workspaceThreadsLoading}
        threadId={props.threadId}
        threadName={threadName}
        threadStatusText={threadStatusText}
        title={props.title}
        tokenUsageText={tokenUsageText}
        workspace={props.workspace}
        workspaceExplorerEntries={workspaceExplorerEntries}
        workspaceExplorerError={workspaceExplorerError}
        workspaceExplorerLoading={workspaceExplorerLoading}
        workspaceExplorerNotice={workspaceExplorerNotice}
        workspaceExplorerOpen={workspaceExplorerOpen}
        workspaceExplorerPath={workspaceExplorerPath}
        workspaceFileDetail={workspaceFileDetail}
        workspaceFileDirty={workspaceFileDirty}
        workspaceFileDraft={workspaceFileDraft}
        workspaceFileSaving={workspaceFileSaving}
        workspaceLabelDraft={layoutState.workspaceLabelDraft}
        workspacePathDraft={layoutState.workspacePathDraft}
        workspaceSwitchReason={workspaceSwitchReason}
      />
      <ChatPageFeedbackRegion feedback={props.pageFeedback ?? null} />
      <ChatPageConversation
        actionBlocked={actionBlocked}
        attachmentDialogOpen={layoutState.attachmentDialogOpen}
        attachmentDraftItems={layoutState.attachmentDraftItems}
        attachmentLimitMessage={layoutState.attachmentLimitMessage}
        bottomDrawerOpen={layoutState.bottomDrawerOpen}
        chatEndRef={chatEndRef}
        draft={layoutState.draft}
        fallbackPendingRequests={partitionedPendingRequests.fallbackPendingRequests}
        chatToasts={chatToasts}
        hasThread={fallbackViewModel.hasThread}
        hasWorkspace={fallbackViewModel.hasWorkspace}
        inlineRequestsByMessageId={partitionedPendingRequests.inlineRequestsByMessageId}
        inputDisabled={inputDisabled}
        interruptPending={interruptPending}
        isRestarting={isRestarting}
        isTurnInterrupting={fallbackViewModel.isInterrupting}
        isTurnInProgress={fallbackViewModel.isRunning || fallbackViewModel.isInterrupting}
        messages={props.messages}
        onAttachmentDialogClose={layoutState.closeAttachmentDialog}
        onAttachmentDialogOpen={layoutState.handleAttachmentDialogOpen}
        onAttachmentFilesSelected={layoutState.handleAttachmentFilesSelected}
        onAttachmentRemoveItem={layoutState.handleAttachmentRemoveItem}
        onCompact={conversationActions.onCompact}
        onConfirmProposedPlanAction={props.onConfirmProposedPlanAction}
        onDismissProposedPlanAction={props.onDismissProposedPlanAction}
        onDraftChange={layoutState.setDraft}
        onInterrupt={props.onInterrupt}
        onMessageFork={props.onMessageFork}
        onNewThread={conversationActions.onNewThread}
        onRequestResponse={props.onRequestResponse}
        onRollback={conversationActions.onRollback}
        onSubmit={layoutState.handleSubmit}
        onTranscriptScroll={updateTranscriptFollowState}
        onTimelineItemContentLoad={props.onTimelineItemContentLoad}
        onToggleBottomDrawer={() => layoutState.setBottomDrawerOpen(open => !open)}
        onToggleTodoListCollapsed={toggleCollapsed}
        onWorkspaceFileLinkOpen={props.onWorkspaceFileLinkOpen}
        isWorkspaceFileLink={props.isWorkspaceFileLink}
        proposedPlanActionTurnId={proposedPlanActionTurnId}
        sendButtonDisabled={resolvedSendButtonDisabled}
        showProposedPlanAction={showProposedPlanAction}
        threadId={props.threadId}
        turnExecution={props.turnExecution}
        todoListCollapsed={todoCollapsed}
        transcriptSectionRef={transcriptSectionRef}
        visibleTodoList={visibleTodo}
        workspaceSwitchReason={workspaceSwitchReason}
      />
    </main>
  );
}
