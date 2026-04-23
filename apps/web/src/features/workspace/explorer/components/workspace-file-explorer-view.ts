import type { WorkspaceFileDetail, WorkspaceFileEntry } from '..';

export function getParentPath(path: string) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  const segments = normalized.split('/');
  segments.pop();
  return segments.join('/');
}

export function getFileDetailPath(fileDetail: WorkspaceFileDetail | null) {
  if (!fileDetail) return '';
  return 'file' in fileDetail ? fileDetail.file.path : fileDetail.path;
}

export function getFileDetailName(fileDetail: WorkspaceFileDetail | null) {
  if (!fileDetail) return 'File';
  return 'file' in fileDetail ? fileDetail.file.name : fileDetail.name;
}

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export function formatEntryMeta(entry: WorkspaceFileEntry) {
  if (entry.kind === 'directory') return '';
  const parts = [formatFileSize(entry.size)];
  if (!entry.isTextEditable) {
    parts.push('RO');
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

export function getEditableBadges(fileDetail: Extract<WorkspaceFileDetail, { kind: 'editable' }>) {
  return [formatFileSize(fileDetail.file.size), fileDetail.file.encoding, 'Editable'];
}

export function confirmDiscardWorkspaceDraft() {
  return window.confirm('You have unsaved file changes. Discard them?');
}
