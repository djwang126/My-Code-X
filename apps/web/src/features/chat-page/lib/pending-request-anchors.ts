import type { SessionPendingRequest, SessionTimelineItem } from '../../chat-runtime/public-types';

function getLatestTurnMessageId(messages: SessionTimelineItem[], turnId: string | null | undefined) {
  if (!turnId) {
    return null;
  }

  const turnMessages = messages.filter(message => message.turnId === turnId && message.kind === 'message');
  return turnMessages.at(-1)?.id ?? null;
}

function shouldKeepPendingRequestAnchor(request: SessionPendingRequest) {
  return request.kind === 'user_input';
}

function getPendingRequestAnchorId(
  request: SessionPendingRequest,
  messages: SessionTimelineItem[],
  previousAnchorIdsByRequestId: Map<string, string>,
) {
  if (request.itemId && messages.some(message => message.id === request.itemId && message.kind === 'message')) {
    return request.itemId;
  }

  if (shouldKeepPendingRequestAnchor(request)) {
    const previousAnchorId = previousAnchorIdsByRequestId.get(request.id);
    if (previousAnchorId && messages.some(message => message.id === previousAnchorId && message.kind === 'message')) {
      return previousAnchorId;
    }
  }

  return getLatestTurnMessageId(messages, request.turnId);
}

export function partitionPendingRequests(
  messages: SessionTimelineItem[],
  pendingRequests: SessionPendingRequest[],
  previousAnchorIdsByRequestId: Map<string, string> = new Map(),
) {
  const inlineRequestsByMessageId = new Map<string, SessionPendingRequest[]>();
  const fallbackPendingRequests: SessionPendingRequest[] = [];
  const nextAnchorIdsByRequestId = new Map<string, string>();

  for (const request of pendingRequests) {
    const anchorId = getPendingRequestAnchorId(request, messages, previousAnchorIdsByRequestId);

    if (!anchorId) {
      fallbackPendingRequests.push(request);
      continue;
    }

    nextAnchorIdsByRequestId.set(request.id, anchorId);
    inlineRequestsByMessageId.set(anchorId, [...(inlineRequestsByMessageId.get(anchorId) ?? []), request]);
  }

  return {
    inlineRequestsByMessageId,
    fallbackPendingRequests,
    nextAnchorIdsByRequestId,
  };
}
