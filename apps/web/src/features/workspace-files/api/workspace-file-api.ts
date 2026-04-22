import type {
  WorkspaceFile,
  WorkspaceFileEntry,
  WorkspaceFileSaveAcceptedPayload,
  WorkspaceFilesPayload,
} from '../../chat-runtime/session-types';
import { ensureOk, postJson } from '../../../shared/lib/app-api-client';

export async function fetchWorkspaceFiles({
  workspace,
  path = '',
}: {
  workspace: string;
  path?: string;
}): Promise<WorkspaceFileEntry[]> {
  const search = new URLSearchParams({
    workspace,
    path,
  });
  const response = await fetch(`/api/v2/workspace/files?${search.toString()}`);
  await ensureOk(response);

  const payload = (await response.json()) as WorkspaceFilesPayload;
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function fetchWorkspaceFile({
  workspace,
  path,
}: {
  workspace: string;
  path: string;
}): Promise<WorkspaceFile> {
  const search = new URLSearchParams({
    workspace,
    path,
  });
  const response = await fetch(`/api/v2/workspace/file?${search.toString()}`);
  await ensureOk(response);

  return (await response.json()) as WorkspaceFile;
}

export async function postWorkspaceFileSave({
  workspace,
  path,
  content,
}: {
  workspace: string;
  path: string;
  content: string;
}): Promise<WorkspaceFileSaveAcceptedPayload> {
  return postJson<WorkspaceFileSaveAcceptedPayload>({
    url: '/api/v2/workspace/file',
    body: {
      workspace,
      path,
      content,
    },
  });
}
