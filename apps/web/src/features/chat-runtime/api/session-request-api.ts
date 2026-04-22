import { postJson } from '../../../shared/lib/app-api-client';

export async function postServerRequestResponse({
  slotId,
  threadId,
  requestId,
  response: requestResponse,
}: {
  slotId: string;
  threadId: string;
  requestId: string;
  response: Record<string, unknown>;
}): Promise<{ ok: boolean; requestId: string }> {
  return postJson<{ ok: boolean; requestId: string }>({
    url: '/api/v2/server-requests/respond',
    body: {
      slotId,
      threadId,
      requestId,
      response: requestResponse,
    },
  });
}
