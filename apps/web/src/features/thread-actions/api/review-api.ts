import type { ReviewStartAcceptedPayload, ReviewStartTarget } from '../../chat-runtime/session-types';
import { postJson } from '../../../shared/lib/app-api-client';

export async function postReviewStart({
  slotId,
  threadId,
  workspace,
  delivery,
  target,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
  delivery: 'inline' | 'detached';
  target: ReviewStartTarget;
}): Promise<ReviewStartAcceptedPayload> {
  return postJson<ReviewStartAcceptedPayload>({
    url: '/api/v2/review/start',
    body: {
      slotId,
      threadId,
      workspace,
      delivery,
      target,
    },
  });
}
