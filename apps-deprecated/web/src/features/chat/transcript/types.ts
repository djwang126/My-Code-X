import type { ReactNode, RefObject } from 'react';

import type {
  SessionPendingRequest,
  SessionTimelineItem,
  SessionTurnExecutionState,
  TimelineItemContentPayload,
} from '../runtime/public-types';

export type TranscriptRequestResponseHandler = (
  requestId: string,
  response: Record<string, unknown>,
) => boolean | Promise<boolean>;

export type TranscriptTimelineItemContentHandler = (itemId: string) => TimelineItemContentPayload | Promise<TimelineItemContentPayload>;

export type TranscriptImagePreview = {
  src: string;
};

export type TranscriptImagePreviewOpenHandler = (image: TranscriptImagePreview) => void;

export type PendingRequestCardProps = {
  request: SessionPendingRequest;
  onRequestResponse?: TranscriptRequestResponseHandler;
  turnExecution?: SessionTurnExecutionState;
  currentThreadId?: string;
};

export type ChatTranscriptProps = {
  fallbackPendingRequests: SessionPendingRequest[];
  inlineRequestsByMessageId: Map<string, SessionPendingRequest[]>;
  turnExecution?: SessionTurnExecutionState;
  currentThreadId?: string;
  proposedPlanActionTurnId?: string | null;
  showProposedPlanAction?: boolean;
  hasWorkspace: boolean;
  messages: SessionTimelineItem[];
  chatEndRef: RefObject<HTMLDivElement | null>;
  transcriptSectionRef?: RefObject<HTMLElement | null>;
  onTranscriptScroll?: () => void;
  renderMessageAction?: (message: SessionTimelineItem & { kind: 'message' }) => ReactNode;
  onTimelineItemContentLoad?: TranscriptTimelineItemContentHandler;
  onRequestResponse?: TranscriptRequestResponseHandler;
  onWorkspaceFileLinkOpen?: (href: string) => boolean | Promise<boolean>;
  isWorkspaceFileLink?: (href: string) => boolean;
  onConfirmProposedPlanAction?: () => boolean | Promise<boolean>;
  onDismissProposedPlanAction?: () => boolean | Promise<boolean>;
};
