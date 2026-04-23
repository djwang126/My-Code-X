import { ChatPageLayout } from './ChatPageLayout';
import { useChatPageController } from '../hooks/useChatPageController';
import { selectChatPageFeedback } from '../state/feedback-selector';

export function ChatPageScreen() {
  const controller = useChatPageController();
  const { state } = controller;
  const pageFeedback = selectChatPageFeedback(controller.currentError);

  return (
    <ChatPageLayout
      title="My code X"
      status={controller.isRestarting ? 'Restarting My-Code-X…' : state.statusMessage}
      workspace={state.workspace}
      threadId={state.threadId}
      turnExecution={state.turnExecution}
      collaborationModeLabel={controller.collaborationModeLabel}
      canCycleCollaborationMode={controller.canCycleCollaborationMode}
      actionBlocked={controller.actionBlocked}
      pageFeedback={pageFeedback}
      inputDisabled={controller.inputDisabled}
      interruptPending={controller.interruptPending}
      isRestarting={controller.isRestarting}
      messages={state.messages}
      notices={state.notices}
      sendButtonDisabled={controller.sendButtonDisabled}
      onCompact={controller.handleCompact}
      onConfirmProposedPlanAction={controller.handleConfirmProposedPlanAction}
      onCycleCollaborationMode={controller.handleCycleCollaborationMode}
      onDismissProposedPlanAction={controller.handleDismissProposedPlanAction}
      onInterrupt={controller.interruptTurn}
      onMessageFork={controller.handleMessageFork}
      onNewThread={controller.handleNewThread}
      onRequestResponse={controller.submitRequestResponse}
      onRestart={controller.handleRestart}
      onReviewStart={controller.handleReviewStart}
      onRollback={controller.handleRollback}
      onRuntimeSettingsChange={controller.handleRuntimeSettingsChange}
      onSubmit={controller.sendMessage}
      onUploadAttachment={controller.handleAttachmentUpload}
      onWorkspaceThreadOpen={controller.handleWorkspaceThreadOpen}
      onTimelineItemContentLoad={controller.handleTimelineItemContentLoad}
      onWorkspaceExplorerClose={controller.handleWorkspaceExplorerClose}
      onWorkspaceExplorerNavigate={controller.handleWorkspaceExplorerNavigate}
      onWorkspaceExplorerOpen={controller.handleWorkspaceExplorerOpen}
      onWorkspaceFileDraftChange={controller.setWorkspaceFileDraft}
      onWorkspaceFileLinkOpen={controller.handleWorkspaceFileLinkOpen}
      isWorkspaceFileLink={controller.isWorkspaceFileLink}
      onWorkspaceFileOpen={controller.handleWorkspaceFileOpen}
      onWorkspaceFileSave={controller.handleWorkspaceFileSave}
      onWorkspaceOpen={controller.handleWorkspaceOpen}
      onWorkspaceRemove={controller.handleWorkspaceRemove}
      onWorkspaceResume={controller.handleWorkspaceResume}
      onWorkspaceSave={controller.handleWorkspaceSave}
      pendingRequests={state.pendingRequests}
      runtimeOptions={controller.runtimeOptions}
      runtimeSettings={controller.runtimeSettings}
      savedWorkspaces={controller.savedWorkspaces}
      workspaceThreads={controller.workspaceThreads}
      workspaceThreadsError={controller.workspaceThreadsError}
      workspaceThreadsLoading={controller.workspaceThreadsLoading}
      threadName={state.threadName}
      threadStatusText={state.threadStatusText}
      tokenUsageText={state.tokenUsageText}
      workspaceExplorerEntries={controller.workspaceExplorerEntries}
      workspaceExplorerError={controller.workspaceExplorerError}
      workspaceExplorerLoading={controller.workspaceExplorerLoading}
      workspaceExplorerNotice={controller.workspaceExplorerNotice}
      workspaceExplorerOpen={controller.workspaceExplorerOpen}
      workspaceExplorerPath={controller.workspaceExplorerPath}
      workspaceFileDetail={controller.workspaceFileDetail}
      workspaceFileDirty={controller.workspaceFileDirty}
      workspaceFileDraft={controller.workspaceFileDraft}
      workspaceFileSaving={controller.workspaceFileSaving}
      workspaceSwitchReason={controller.workspaceSwitchReason}
    />
  );
}
