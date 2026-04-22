import type { AppRestartAcceptedPayload } from '../../chat-runtime/session-types';
import { postJson, waitForHealthResponse } from '../../../shared/lib/app-api-client';

export async function postAppRestart({
  viewerId,
  slotId,
  workspace,
  threadId,
}: {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
}): Promise<AppRestartAcceptedPayload> {
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

export async function waitForAppReady({
  healthUrl = '/api/health',
  intervalMs = 1_000,
  timeoutMs = 60_000,
  previousServerInstanceId = '',
}: {
  healthUrl?: string;
  intervalMs?: number;
  timeoutMs?: number;
  previousServerInstanceId?: string;
} = {}): Promise<void> {
  await waitForHealthResponse({
    healthUrl,
    intervalMs,
    timeoutMs,
    previousServerInstanceId,
  });
}
