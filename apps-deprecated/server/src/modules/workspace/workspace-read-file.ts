import { readFile } from 'node:fs/promises';

import {
  detectWorkspaceFileContentKind,
  getWorkspaceImageContentType,
  MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
  readWorkspaceTextFile,
} from './workspace-file-detection.js';
import {
  createWorkspaceBinaryFileResponse,
  createWorkspaceImageFileResponse,
  createWorkspaceTextFileResponse,
} from './workspace-file-presenters.js';
import {
  createWorkspaceNotImageFileError,
  createWorkspaceNotTextFileError,
  createWorkspaceUnsupportedImageTypeError,
} from './workspace-errors.js';
import { resolveWorkspaceFileTarget } from './workspace-paths.js';

export async function readWorkspaceFile({
  full = false,
  path,
  workspace,
}: {
  full?: boolean;
  path: string;
  workspace: string;
}) {
  const { relativePath, target, targetStats } = await resolveWorkspaceFileTarget({ workspace, path });
  const contentKind = await detectWorkspaceFileContentKind(target, relativePath);

  if (contentKind === 'image') {
    const contentType = getWorkspaceImageContentType(relativePath);
    if (!contentType) {
      throw createWorkspaceUnsupportedImageTypeError();
    }

    return createWorkspaceImageFileResponse({
      contentType,
      path: relativePath,
      size: targetStats.size,
      workspace,
    });
  }

  if (contentKind === 'binary') {
    return createWorkspaceBinaryFileResponse({
      contentType: null,
      path: relativePath,
      size: targetStats.size,
    });
  }

  const textFile = await readWorkspaceTextFile({
    target,
    maxBytes: full ? null : MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
  });
  if (!textFile) {
    throw createWorkspaceNotTextFileError();
  }

  return createWorkspaceTextFileResponse({
    content: textFile.content,
    path: relativePath,
    size: targetStats.size,
    truncated: textFile.truncated,
  });
}

export async function readWorkspaceFileContent({
  path,
  workspace,
}: {
  path: string;
  workspace: string;
}) {
  const { target, relativePath } = await resolveWorkspaceFileTarget({ workspace, path });
  const contentKind = await detectWorkspaceFileContentKind(target, relativePath);
  if (contentKind !== 'image') {
    throw createWorkspaceNotImageFileError();
  }

  const contentType = getWorkspaceImageContentType(relativePath);
  if (!contentType) {
    throw createWorkspaceUnsupportedImageTypeError();
  }

  return {
    body: await readFile(target),
    contentType,
  };
}
