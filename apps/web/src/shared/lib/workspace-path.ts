export function normalizeWorkspacePath(path: string) {
  return String(path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
}
