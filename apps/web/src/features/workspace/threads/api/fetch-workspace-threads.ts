import type { WorkspaceThreadEntry, WorkspaceThreadsPayload } from '@my-code-x/contracts';
import { ensureOk } from '../../../../shared/lib/app-api-client';

type FetchWorkspaceThreadsInput = {
  workspace: string;
  limit?: number;
};

function parseWorkspaceThreadsPayload(payload: unknown): WorkspaceThreadEntry[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as WorkspaceThreadsPayload).data)
    ? (payload as WorkspaceThreadsPayload).data
    : [];

  return data.filter(item => Boolean(item && typeof item.id === 'string'));
}

export async function fetchWorkspaceThreads({
  workspace,
  limit = 20,
}: FetchWorkspaceThreadsInput): Promise<WorkspaceThreadEntry[]> {
  const search = new URLSearchParams({
    workspace,
    limit: String(limit),
  });
  const response = await fetch(`/api/v2/thread/history?${search.toString()}`);
  await ensureOk(response);

  return parseWorkspaceThreadsPayload(await response.json());
}
