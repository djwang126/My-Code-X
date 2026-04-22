export function normalizeErrorCode(message: string, fallback = 'unknown_error'): string {
  const normalized = String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}
