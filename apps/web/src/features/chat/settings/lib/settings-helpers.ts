import type { RuntimeSettings } from '../settings-types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function hasOwnKey(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readOptionalRuntimeNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return undefined;
}

export function assignOptionalRuntimeNumber({
  target,
  source,
  key,
}: {
  target: RuntimeSettings;
  source: Record<string, unknown>;
  key: 'modelContextWindow' | 'modelAutoCompactTokenLimit';
}) {
  if (!hasOwnKey(source, key)) {
    return;
  }

  const parsed = readOptionalRuntimeNumber(source[key]);

  if (parsed !== undefined) {
    target[key] = parsed;
  }
}
