import type { ReactNode, RefObject } from 'react';

import type {
  ChatTurn,
  SessionPendingRequest,
  SessionTimelineItem,
  TimelineItemContentPayload,
} from '../runtime/public-types';
import type { ProposedPlanTranscriptAction } from '../commands';

export type TranscriptRequestResponseHandler = (
  requestId: string,
  response: Record<string, unknown>,
) => boolean | Promise<boolean>;

export type TranscriptTimelineItemContentHandler = (itemId: string) => TimelineItemContentPayload | Promise<TimelineItemContentPayload>;

export type TranscriptImagePreview = {
  src: string;
};

export type TranscriptImagePreviewOpenHandler = (image: TranscriptImagePreview) => void;
export type ProposedPlanActionHandler = (
  action: ProposedPlanTranscriptAction,
) => boolean | Promise<boolean>;

export type PendingRequestCardProps = {
  request: SessionPendingRequest;
  onRequestResponse?: TranscriptRequestResponseHandler;
  latestTurn?: ChatTurn | null;
  currentThreadId?: string;
};

export type ChatTranscriptProps = {
  fallbackPendingRequests: SessionPendingRequest[];
  inlineRequestsByMessageId: Map<string, SessionPendingRequest[]>;
  proposedPlanActionsByItemId?: Map<string, ProposedPlanTranscriptAction>;
  latestTurn?: ChatTurn | null;
  currentThreadId?: string;
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
  onConfirmProposedPlanAction?: ProposedPlanActionHandler;
  onDismissProposedPlanAction?: ProposedPlanActionHandler;
};
