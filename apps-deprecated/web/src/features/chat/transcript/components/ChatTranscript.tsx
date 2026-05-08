import { Fragment, useState, type CSSProperties } from 'react';

import { OverlayDialog } from '../../../../shared/components/overlay';
import { FeedbackEmptyState } from '../../../../shared/components/feedback';
import type { ChatTranscriptProps, TranscriptImagePreview } from '../types';
import { PendingRequestCard } from './PendingRequestCard';
import { IconChat } from './ChatIcons';
import { TranscriptMessage } from './TranscriptMessage';

const previewImageStyle: CSSProperties = {
  maxWidth: 'min(24rem, 100%)',
  borderRadius: '0.75rem',
};

export function ChatTranscript({
  fallbackPendingRequests,
  inlineRequestsByMessageId,
  turnExecution,
  currentThreadId = '',
  proposedPlanActionTurnId = null,
  showProposedPlanAction = false,
  hasWorkspace,
  messages,
  chatEndRef,
  transcriptSectionRef,
  onTranscriptScroll,
  renderMessageAction,
  onTimelineItemContentLoad,
  onRequestResponse,
  onWorkspaceFileLinkOpen,
  isWorkspaceFileLink,
  onConfirmProposedPlanAction,
  onDismissProposedPlanAction,
}: ChatTranscriptProps) {
  const [previewImage, setPreviewImage] = useState<TranscriptImagePreview | null>(null);
  const showMessageLevelProposedPlanAction = Boolean(showProposedPlanAction && proposedPlanActionTurnId);
  const currentTurnExecution = turnExecution;

  return (
    <section
      aria-label="chat transcript section"
      className="chat-area"
      onScroll={onTranscriptScroll}
      ref={transcriptSectionRef}
    >
      {fallbackPendingRequests.length ? (
        <section aria-label="pending requests">
          {fallbackPendingRequests.map(request => (
            <PendingRequestCard
              currentThreadId={currentThreadId}
              key={request.id}
              onRequestResponse={onRequestResponse}
              request={request}
              turnExecution={currentTurnExecution}
            />
          ))}
        </section>
      ) : null}

      {!hasWorkspace ? <FeedbackEmptyState icon={<IconChat />} title="Select a workspace to start chatting" /> : null}
      {hasWorkspace && messages.length === 0 ? <FeedbackEmptyState icon={<IconChat />} title="No messages yet" /> : null}

      <div aria-label="chat transcript" role="log">
        {messages.map(message => {
          if (message.kind !== 'message') {
            return (
              <Fragment key={message.id}>
                <TranscriptMessage
                  message={message}
                  onConfirmProposedPlanAction={onConfirmProposedPlanAction}
                  onDismissProposedPlanAction={onDismissProposedPlanAction}
                  onFileHrefOpen={href => void onWorkspaceFileLinkOpen?.(href)}
                  onImagePreviewOpen={setPreviewImage}
                  isWorkspaceFileLink={isWorkspaceFileLink}
                  onTimelineItemContentLoad={onTimelineItemContentLoad}
                  proposedPlanActionTurnId={proposedPlanActionTurnId}
                  showProposedPlanAction={showMessageLevelProposedPlanAction}
                />
                {inlineRequestsByMessageId.get(message.id)?.length ? (
                  <section aria-label={`pending requests for ${message.id}`}>
                    {inlineRequestsByMessageId.get(message.id)?.map(request => (
                      <PendingRequestCard
                        currentThreadId={currentThreadId}
                        key={request.id}
                        onRequestResponse={onRequestResponse}
                        request={request}
                        turnExecution={currentTurnExecution}
                      />
                    ))}
                  </section>
                ) : null}
              </Fragment>
            );
          }

          const messageAction = renderMessageAction?.(message);

          return (
            <Fragment key={message.id}>
              <div className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}>
                {message.role === 'assistant' ? (
                  <div className="assistant-message-layout message-with-side-action">
                    <div className="message-layout message-main">
                      <div className="message-bubble">
                        <TranscriptMessage
                          message={message}
                          onConfirmProposedPlanAction={onConfirmProposedPlanAction}
                          onDismissProposedPlanAction={onDismissProposedPlanAction}
                          onFileHrefOpen={href => void onWorkspaceFileLinkOpen?.(href)}
                          onImagePreviewOpen={setPreviewImage}
                          isWorkspaceFileLink={isWorkspaceFileLink}
                          onTimelineItemContentLoad={onTimelineItemContentLoad}
                          proposedPlanActionTurnId={proposedPlanActionTurnId}
                          showProposedPlanAction={showMessageLevelProposedPlanAction}
                        />
                      </div>
                    </div>
                    <div aria-hidden={!messageAction} className="message-side-action">
                      <div className="message-side-action-stack">{messageAction}</div>
                    </div>
                  </div>
                ) : (
                  <div className="message-layout message-main user-message-layout">
                    <div className="message-bubble">
                      <TranscriptMessage
                        message={message}
                        onConfirmProposedPlanAction={onConfirmProposedPlanAction}
                        onDismissProposedPlanAction={onDismissProposedPlanAction}
                        onFileHrefOpen={href => void onWorkspaceFileLinkOpen?.(href)}
                        onImagePreviewOpen={setPreviewImage}
                        isWorkspaceFileLink={isWorkspaceFileLink}
                        onTimelineItemContentLoad={onTimelineItemContentLoad}
                        proposedPlanActionTurnId={proposedPlanActionTurnId}
                        showProposedPlanAction={showMessageLevelProposedPlanAction}
                      />
                    </div>
                  </div>
                )}
              </div>

              {inlineRequestsByMessageId.get(message.id)?.length ? (
                <section aria-label={`pending requests for ${message.id}`}>
                  {inlineRequestsByMessageId.get(message.id)?.map(request => (
                    <PendingRequestCard
                      currentThreadId={currentThreadId}
                      key={request.id}
                      onRequestResponse={onRequestResponse}
                      request={request}
                      turnExecution={currentTurnExecution}
                    />
                  ))}
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      <div ref={chatEndRef} />

      <OverlayDialog
        ariaLabel="Attached image preview"
        onClose={() => setPreviewImage(null)}
        open={previewImage !== null}
        showCloseButton={false}
        title="Attached image preview"
        width="min(28rem, 100%)"
      >
        {previewImage ? (
          <img alt="Attached image preview content" src={previewImage.src} style={previewImageStyle} />
        ) : null}
      </OverlayDialog>
    </section>
  );
}
