import type { AppRestartAcceptedPayload } from '@my-code-x/contracts';
import { postJson } from '../../../../shared/lib/app-api-client';

type RequestAppRestartInput = {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
};

export async function requestAppRestart({
  viewerId,
  slotId,
  workspace,
  threadId,
}: RequestAppRestartInput): Promise<AppRestartAcceptedPayload> {
  return postJson<AppRestartAcceptedPayload>({
    url: '/api/v2/app/restart',
    body: {
      viewerId,
      slotId,
      workspace,
      threadId,
    },
  });
}
