import type { SessionThreadHistoryItem, ThreadHistoryPayload } from '../../chat-runtime/session-types';
import { ensureOk } from '../../../shared/lib/app-api-client';

export async function fetchThreadHistory({
  workspace,
  limit = 20,
}: {
  workspace: string;
  limit?: number;
}): Promise<SessionThreadHistoryItem[]> {
  const search = new URLSearchParams({
    workspace,
    limit: String(limit),
  });
  const response = await fetch(`/api/v2/thread/history?${search.toString()}`);
  await ensureOk(response);

  const payload = (await response.json()) as ThreadHistoryPayload;
  return Array.isArray(payload.data) ? payload.data : [];
}
