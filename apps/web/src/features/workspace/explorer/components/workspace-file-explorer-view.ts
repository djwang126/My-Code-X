import type { WorkspaceFileDetail, WorkspaceFileEntry, WorkspaceTextFile } from '..';

export function getParentPath(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

export function getFileDetailPath(fileDetail: WorkspaceFileDetail | null) {
  return fileDetail?.path ?? '';
}

export function getFileDetailName(fileDetail: WorkspaceFileDetail | null) {
  return fileDetail?.name ?? 'File';
}

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatContentKind(entry: Extract<WorkspaceFileEntry, { kind: 'file' }>) {
  if (entry.contentKind === 'text') return 'Text';
  if (entry.contentKind === 'image') return 'Image';
  return 'Binary';
}

export function formatEntryMeta(entry: WorkspaceFileEntry) {
  if (entry.kind === 'directory') return '';
  const parts = [formatFileSize(entry.size), formatContentKind(entry)];
  if (entry.isLarge) {
    parts.push('Large');
  }
  return parts.join(' · ');
}

export function buildBreadcrumbs(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return [];
  const segments = normalized.split('/');
  return segments.map((segment, index) => ({ label: segment, path: segments.slice(0, index + 1).join('/') }));
}

export function isMarkdownFile(path: string) {
  return /\.md$/i.test(String(path || '').trim());
}

export function getTextFileBadges(fileDetail: WorkspaceTextFile) {
  const badges = [formatFileSize(fileDetail.size), fileDetail.encoding];
  if (fileDetail.truncated) {
    badges.push('Large');
  }
  return badges;
}

export function getBinaryFileBadges(fileDetail: WorkspaceFileDetail) {
  if (fileDetail.kind === 'text') {
    return getTextFileBadges(fileDetail);
  }

  const badges = [formatFileSize(fileDetail.size)];
  badges.push(fileDetail.kind === 'image' ? 'Image' : 'Binary');
  return badges;
}

export function confirmDiscardWorkspaceDraft() {
  return window.confirm('You have unsaved file changes. Discard them?');
}
