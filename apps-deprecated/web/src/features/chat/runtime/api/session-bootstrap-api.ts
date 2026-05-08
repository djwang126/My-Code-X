import type { SessionPayload } from '../session-types';
import { ensureOk } from '../../../../shared/lib/app-api-client';
import { parseSessionPayload } from '../lib/session-payload-parse';

export async function fetchSessionPayload({
  viewerId,
  slotId,
  workspace,
  threadId,
}: {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
}): Promise<SessionPayload> {
  const search = new URLSearchParams({ viewerId, slotId, workspace, threadId });
  const response = await fetch(`/api/v2/session?${search.toString()}`);
  await ensureOk(response);

  return parseSessionPayload(await response.json());
}
