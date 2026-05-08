import type { SessionTimelineItem } from '../../runtime/public-types';
import type {
  TranscriptImagePreviewOpenHandler,
  TranscriptTimelineItemContentHandler,
} from '../types';
import { MessageTimelineItem } from './transcript-message/MessageTimelineItem';
import { SpecialTimelineItem } from './transcript-message/SpecialTimelineItem';

type TranscriptMessageProps = {
  message: SessionTimelineItem;
  onFileHrefOpen?: (href: string) => void;
  isWorkspaceFileLink?: (href: string) => boolean;
  onTimelineItemContentLoad?: TranscriptTimelineItemContentHandler;
  onImagePreviewOpen?: TranscriptImagePreviewOpenHandler;
  proposedPlanActionTurnId?: string | null;
  showProposedPlanAction?: boolean;
  onConfirmProposedPlanAction?: () => boolean | Promise<boolean>;
  onDismissProposedPlanAction?: () => boolean | Promise<boolean>;
};
export function TranscriptMessage({
  message,
  onFileHrefOpen,
  isWorkspaceFileLink,
  onTimelineItemContentLoad,
  onImagePreviewOpen,
  proposedPlanActionTurnId = null,
  showProposedPlanAction = false,
  onConfirmProposedPlanAction,
  onDismissProposedPlanAction,
}: TranscriptMessageProps) {
  if (message.kind === 'message') {
    return (
      <MessageTimelineItem
        isWorkspaceFileLink={isWorkspaceFileLink}
        message={message}
        onFileHrefOpen={onFileHrefOpen}
        onImagePreviewOpen={onImagePreviewOpen}
      />
    );
  }

  return (
    <SpecialTimelineItem
      message={message}
      onConfirmProposedPlanAction={onConfirmProposedPlanAction}
      onDismissProposedPlanAction={onDismissProposedPlanAction}
      onFileHrefOpen={onFileHrefOpen}
      isWorkspaceFileLink={isWorkspaceFileLink}
      onTimelineItemContentLoad={onTimelineItemContentLoad}
      proposedPlanActionTurnId={proposedPlanActionTurnId}
      showProposedPlanAction={showProposedPlanAction}
    />
  );
}
