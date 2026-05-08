import { waitForHealthResponse } from '../../../../shared/lib/app-api-client';

type WaitForAppReadyInput = {
  healthUrl?: string;
  intervalMs?: number;
  timeoutMs?: number;
  previousServerInstanceId?: string;
};

export async function waitForAppReady({
  healthUrl = '/api/health',
  intervalMs = 1_000,
  timeoutMs = 60_000,
  previousServerInstanceId = '',
}: WaitForAppReadyInput = {}): Promise<void> {
  await waitForHealthResponse({
    healthUrl,
    intervalMs,
    timeoutMs,
    previousServerInstanceId,
  });
}
