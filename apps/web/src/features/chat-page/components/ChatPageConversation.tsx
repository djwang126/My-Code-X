import { useCallback, useMemo, type RefObject } from 'react';

import { ChatComposer } from '../../chat-composer';
import { ImageAttachmentDialog, type ImageAttachmentDraftItem } from '../../chat-attachments';
import { SessionToastRegion, type SessionToastItem } from '../../session-feedback';
import type { SessionTimelineMessageItem } from '../../chat-runtime/public-types';
import { ForkReplyButton, getForkableMessageIds } from '../../thread-actions';
import { ThreadTodoPanel, type ActiveThreadTodo } from '../../thread-todo';
import { ChatTranscript } from '../../chat-transcript';
import type { ChatPageProps } from '../types';

type ChatPageConversationProps = {
  sessionToasts: SessionToastItem[];
  turnExecution: ChatPageProps['turnExecution'];
  threadId: string;
  fallbackPendingRequests: NonNullable<ChatPageProps['pendingRequests']>;
  hasWorkspace: boolean;
  inlineRequestsByMessageId: Map<string, NonNullable<ChatPageProps['pendingRequests']>>;
  messages: ChatPageProps['messages'];
  chatEndRef: RefObject<HTMLDivElement | null>;
  attachmentDialogOpen: boolean;
  attachmentDraftItems: ImageAttachmentDraftItem[];
  attachmentLimitMessage: string;
  onAttachmentDialogClose: () => void;
  onAttachmentDialogOpen: () => void;
  onAttachmentFilesSelected: (files: File[]) => void | Promise<void>;
  onAttachmentRemoveItem: (itemId: string) => void;
  transcriptSectionRef: RefObject<HTMLElement | null>;
  onTranscriptScroll: () => void;
  onConfirmProposedPlanAction?: ChatPageProps['onConfirmProposedPlanAction'];
  onDismissProposedPlanAction?: ChatPageProps['onDismissProposedPlanAction'];
  onMessageFork?: ChatPageProps['onMessageFork'];
  onRequestResponse?: ChatPageProps['onRequestResponse'];
  onTimelineItemContentLoad?: ChatPageProps['onTimelineItemContentLoad'];
  onWorkspaceFileLinkOpen?: ChatPageProps['onWorkspaceFileLinkOpen'];
  isWorkspaceFileLink?: ChatPageProps['isWorkspaceFileLink'];
  proposedPlanActionTurnId?: string | null;
  showProposedPlanAction: boolean;
  visibleTodoList: ActiveThreadTodo | null;
  todoListCollapsed: boolean;
  onToggleTodoListCollapsed: () => void;
  actionBlocked: boolean;
  bottomDrawerOpen: boolean;
  draft: string;
  hasThread: boolean;
  inputDisabled: boolean;
  interruptPending: boolean;
  isRestarting: boolean;
  isTurnInterrupting: boolean;
  isTurnInProgress: boolean;
  onCompact?: ChatPageProps['onCompact'];
  onDraftChange: (value: string) => void;
  onInterrupt?: ChatPageProps['onInterrupt'];
  onNewThread?: ChatPageProps['onNewThread'];
  onRollback?: ChatPageProps['onRollback'];
  onSubmit: () => void | Promise<void>;
  onToggleBottomDrawer: () => void;
  sendButtonDisabled: boolean;
  workspaceSwitchReason: string;
};

export function ChatPageConversation(props: ChatPageConversationProps) {
  const forkableMessageIds = useMemo(() => getForkableMessageIds(props.messages), [props.messages]);
  const renderMessageAction = useCallback(
    (message: SessionTimelineMessageItem) =>
      forkableMessageIds.has(message.id)
        ? <ForkReplyButton messageId={message.id} onFork={props.onMessageFork} />
        : null,
    [forkableMessageIds, props.onMessageFork],
  );

  return (
    <>
      <SessionToastRegion toasts={props.sessionToasts} />
      <ImageAttachmentDialog
        items={props.attachmentDraftItems}
        limitMessage={props.attachmentLimitMessage}
        maxAttachments={5}
        onClose={props.onAttachmentDialogClose}
        onFilesSelected={props.onAttachmentFilesSelected}
        onRemoveItem={props.onAttachmentRemoveItem}
        open={props.attachmentDialogOpen}
      />

      <ChatTranscript
        chatEndRef={props.chatEndRef}
        currentThreadId={props.threadId}
        fallbackPendingRequests={props.fallbackPendingRequests}
        hasWorkspace={props.hasWorkspace}
        inlineRequestsByMessageId={props.inlineRequestsByMessageId}
        messages={props.messages}
        onConfirmProposedPlanAction={props.onConfirmProposedPlanAction}
        onDismissProposedPlanAction={props.onDismissProposedPlanAction}
        onRequestResponse={props.onRequestResponse}
        onTranscriptScroll={props.onTranscriptScroll}
        onTimelineItemContentLoad={props.onTimelineItemContentLoad}
        onWorkspaceFileLinkOpen={props.onWorkspaceFileLinkOpen}
        isWorkspaceFileLink={props.isWorkspaceFileLink}
        proposedPlanActionTurnId={props.proposedPlanActionTurnId}
        renderMessageAction={renderMessageAction}
        showProposedPlanAction={props.showProposedPlanAction}
        transcriptSectionRef={props.transcriptSectionRef}
        turnExecution={props.turnExecution}
      />

      {props.visibleTodoList ? (
        <ThreadTodoPanel
          collapsed={props.todoListCollapsed}
          onToggleCollapsed={props.onToggleTodoListCollapsed}
          todo={props.visibleTodoList}
        />
      ) : null}

      <ChatComposer
        actionBlocked={props.actionBlocked}
        bottomDrawerOpen={props.bottomDrawerOpen}
        draft={props.draft}
        hasThread={props.hasThread}
        hasWorkspace={props.hasWorkspace}
        inputDisabled={props.inputDisabled}
        interruptPending={props.interruptPending}
        isRestarting={props.isRestarting}
        isTurnInterrupting={props.isTurnInterrupting}
        isTurnInProgress={props.isTurnInProgress}
        onCompact={props.onCompact}
        onDraftChange={props.onDraftChange}
        onInterrupt={props.onInterrupt}
        onNewThread={props.onNewThread}
        onOpenImageAttachments={() => { props.onAttachmentDialogOpen(); return true; }}
        onRollback={props.onRollback}
        onSubmit={props.onSubmit}
        onToggleBottomDrawer={props.onToggleBottomDrawer}
        sendButtonDisabled={props.sendButtonDisabled}
        workspaceSwitchReason={props.workspaceSwitchReason}
      />
    </>
  );
}
