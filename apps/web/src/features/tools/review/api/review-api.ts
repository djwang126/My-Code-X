import type { ReviewStartAcceptedPayload, ReviewStartTarget } from '@my-code-x/contracts';
import { postJson } from '../../../../shared/lib/app-api-client';

type PostReviewStartInput = {
  slotId: string;
  threadId: string;
  workspace: string;
  delivery: 'inline' | 'detached';
  target: ReviewStartTarget;
};

export async function postReviewStart({
  slotId,
  threadId,
  workspace,
  delivery,
  target,
}: PostReviewStartInput): Promise<ReviewStartAcceptedPayload> {
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
