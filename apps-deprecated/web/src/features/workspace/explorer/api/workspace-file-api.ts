import type {
  WorkspaceFile,
  WorkspaceFileEntry,
  WorkspaceFileSaveAcceptedPayload,
  WorkspaceFilesPayload,
} from '@my-code-x/contracts';
import { ensureOk, postJson } from '../../../../shared/lib/app-api-client';
import { resolveWorkspaceExplorerApiError } from '../errors/workspace-explorer-errors';

type FetchWorkspaceFilesInput = {
  workspace: string;
  path?: string;
};

type FetchWorkspaceFileInput = {
  workspace: string;
  path: string;
  full?: boolean;
};

type PostWorkspaceFileSaveInput = {
  workspace: string;
  path: string;
  content: string;
};

function parseWorkspaceFilesPayload(payload: unknown): WorkspaceFileEntry[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as WorkspaceFilesPayload).data)
    ? (payload as WorkspaceFilesPayload).data
    : [];

  return data.filter(entry => Boolean(entry && typeof entry.path === 'string'));
}

export async function fetchWorkspaceFiles({
  workspace,
  path = '',
}: FetchWorkspaceFilesInput): Promise<WorkspaceFileEntry[]> {
  try {
    const search = new URLSearchParams({
      workspace,
      path,
    });
    const response = await fetch(`/api/v2/workspace/files?${search.toString()}`);
    await ensureOk(response);

    return parseWorkspaceFilesPayload(await response.json());
  } catch (error) {
    throw resolveWorkspaceExplorerApiError({ error, path });
  }
}

export async function fetchWorkspaceFile({
  workspace,
  path,
  full = false,
}: FetchWorkspaceFileInput): Promise<WorkspaceFile> {
  try {
    const search = new URLSearchParams({
      workspace,
      path,
      ...(full ? { full: '1' } : {}),
    });
    const response = await fetch(`/api/v2/workspace/file?${search.toString()}`);
    await ensureOk(response);

    return (await response.json()) as WorkspaceFile;
  } catch (error) {
    throw resolveWorkspaceExplorerApiError({ error, path });
  }
}

export function buildWorkspaceFileContentUrl({
  workspace,
  path,
}: {
  workspace: string;
  path: string;
}) {
  const search = new URLSearchParams({ workspace, path });
  return `/api/v2/workspace/file/content?${search.toString()}`;
}

export async function postWorkspaceFileSave({
  workspace,
  path,
  content,
}: PostWorkspaceFileSaveInput): Promise<WorkspaceFileSaveAcceptedPayload> {
  return postJson<WorkspaceFileSaveAcceptedPayload>({
    url: '/api/v2/workspace/file',
    body: {
      workspace,
      path,
      content,
    },
  });
}
