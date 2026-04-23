import type { SessionNotice, SessionPendingRequest, SessionTimelineItem } from '../session-types';
import {
  createCanonicalUserMessageId,
  reconcileCanonicalUserMessageTimelineItem,
} from '@my-code-x/contracts';

function createNormalizedTimelineItemId({
  item,
  userMessageOrdinalWithinTurn,
}: {
  item: SessionTimelineItem;
  userMessageOrdinalWithinTurn: number;
}) {
  if (item.kind !== 'message' || item.itemType !== 'userMessage' || !item.turnId) {
    return item.id;
  }

  return createCanonicalUserMessageId({
    turnId: item.turnId,
    ordinalWithinTurn: userMessageOrdinalWithinTurn,
  });
}

export function normalizeTimelineItems(items: SessionTimelineItem[]): SessionTimelineItem[] {
  const nextItems: SessionTimelineItem[] = [];
  const userMessageOrdinalByTurnId = new Map<string, number>();

  for (const item of items) {
    const userMessageOrdinalWithinTurn =
      item.kind === 'message' && item.itemType === 'userMessage' && item.turnId
        ? (userMessageOrdinalByTurnId.get(item.turnId) ?? 0)
        : 0;
    const nextItemId = createNormalizedTimelineItemId({
      item,
      userMessageOrdinalWithinTurn,
    });
    const nextItem = nextItemId === item.id ? item : { ...item, id: nextItemId };
    const existingIndex = nextItems.findIndex(existingItem => existingItem.id === nextItem.id);

    if (existingIndex === -1) {
      nextItems.push(nextItem);
    } else {
      nextItems.splice(existingIndex, 1);
      nextItems.push(nextItem);
    }

    if (item.kind === 'message' && item.itemType === 'userMessage' && item.turnId) {
      userMessageOrdinalByTurnId.set(item.turnId, userMessageOrdinalWithinTurn + 1);
    }
  }

  return nextItems;
}

export function reconcileTimelineItem(items: SessionTimelineItem[], nextItem: SessionTimelineItem): SessionTimelineItem {
  return reconcileCanonicalUserMessageTimelineItem({ items, nextItem });
}

export function upsertNotice(notices: SessionNotice[], nextNotice: SessionNotice): SessionNotice[] {
  const index = notices.findIndex(notice => notice.id === nextNotice.id);

  if (index === -1) {
    return [...notices, nextNotice];
  }

  return notices.map((notice, noticeIndex) => (noticeIndex === index ? nextNotice : notice));
}

export function normalizeNotices(notices: SessionNotice[] | undefined): SessionNotice[] {
  if (!Array.isArray(notices)) {
    return [];
  }

  return notices.reduce<SessionNotice[]>((nextNotices, notice) => upsertNotice(nextNotices, notice), []);
}

export function upsertPendingRequest(
  pendingRequests: SessionPendingRequest[],
  nextRequest: SessionPendingRequest,
): SessionPendingRequest[] {
  const index = pendingRequests.findIndex(request => request.id === nextRequest.id);

  if (index === -1) {
    return [...pendingRequests, nextRequest];
  }

  return pendingRequests.map((request, requestIndex) => (requestIndex === index ? nextRequest : request));
}

export function normalizePendingRequests(
  pendingRequests: SessionPendingRequest[] | undefined,
): SessionPendingRequest[] {
  if (!Array.isArray(pendingRequests)) {
    return [];
  }

  return pendingRequests.reduce<SessionPendingRequest[]>((nextPendingRequests, request) => {
    return upsertPendingRequest(nextPendingRequests, request);
  }, []);
}

export function updatePendingRequestSubmissionState(
  pendingRequests: SessionPendingRequest[],
  requestId: string,
  submitState: SessionPendingRequest['submitState'],
): SessionPendingRequest[] {
  return pendingRequests.map(request => (request.id === requestId ? { ...request, submitState } : request));
}

export function upsertMessage(messages: SessionTimelineItem[], nextMessage: SessionTimelineItem): SessionTimelineItem[] {
  const index = messages.findIndex(message => message.id === nextMessage.id);

  if (index === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, messageIndex) => (messageIndex === index ? nextMessage : message));
}
