import type { TimelineItemContentPayload } from '../../chat-runtime/session-types';
import { ensureOk } from '../../../shared/lib/app-api-client';

export async function fetchTimelineItemContent({
  slotId,
  threadId,
  itemId,
}: {
  slotId: string;
  threadId: string;
  itemId: string;
}): Promise<TimelineItemContentPayload> {
  const search = new URLSearchParams({
    slotId,
    threadId,
    itemId,
  });
  const response = await fetch(`/api/v2/chat/item-content?${search.toString()}`);
  await ensureOk(response);

  return (await response.json()) as TimelineItemContentPayload;
}
