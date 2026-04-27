import { BoundaryError, isJsonObject, type JsonObject, type JsonValue } from '../shared/index.js';
import type { HttpRequest } from './http-types.js';

export function readBodyObject(request: HttpRequest): JsonObject {
  if (!isJsonObject(request.body)) {
    throw new BoundaryError('HTTP request body must be an object');
  }

  return request.body;
}

export function readRequiredString(input: JsonObject, fieldName: string): string {
  const value = input[fieldName];

  if (typeof value !== 'string' || !value) {
    throw new BoundaryError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

export function readOptionalString(input: JsonObject, fieldName: string): string | null {
  const value = input[fieldName];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BoundaryError(`${fieldName} must be a string or null`);
  }

  return value;
}

export function readRequiredKind<const Kind extends string>(input: JsonObject, allowedKinds: readonly Kind[]): Kind {
  const kind = readRequiredString(input, 'kind');

  if (!isAllowedKind(kind, allowedKinds)) {
    throw new BoundaryError(`Unsupported command kind: ${kind}`);
  }

  return kind;
}

function isAllowedKind<const Kind extends string>(kind: string, allowedKinds: readonly Kind[]): kind is Kind {
  for (const allowedKind of allowedKinds) {
    if (allowedKind === kind) {
      return true;
    }
  }

  return false;
}

export function readBoolean(input: JsonObject, fieldName: string, fallback: boolean): boolean {
  const value = input[fieldName];

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'boolean') {
    throw new BoundaryError(`${fieldName} must be a boolean`);
  }

  return value;
}

export function readPositiveInteger(input: JsonObject, fieldName: string, fallback: number): number {
  const value = input[fieldName];

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new BoundaryError(`${fieldName} must be a positive integer`);
  }

  return value;
}

export function readOptionalObject(input: JsonObject, fieldName: string): JsonObject | null {
  const value = input[fieldName];

  if (value === undefined || value === null) {
    return null;
  }

  if (!isJsonObject(value)) {
    throw new BoundaryError(`${fieldName} must be an object or null`);
  }

  return value;
}

export function readNullableStringValue(value: JsonValue | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BoundaryError(`${fieldName} must be a string or null`);
  }

  return value;
}
