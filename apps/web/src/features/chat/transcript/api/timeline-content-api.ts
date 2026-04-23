import type { TimelineItemContentPayload } from '../../runtime/public-types';
import { ensureOk } from '../../../../shared/lib/app-api-client';

type FetchTimelineItemContentInput = {
  slotId: string;
  threadId: string;
  itemId: string;
};

export async function fetchTimelineItemContent({
  slotId,
  threadId,
  itemId,
}: FetchTimelineItemContentInput): Promise<TimelineItemContentPayload> {
  const search = new URLSearchParams({
    slotId,
    threadId,
    itemId,
  });
  const response = await fetch(`/api/v2/chat/item-content?${search.toString()}`);
  await ensureOk(response);

  return (await response.json()) as TimelineItemContentPayload;
}
