import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import { isJsonObject, isJsonValue, type JsonObject, type JsonValue } from '@my-code-x/contracts-new/json';

export function parseJsonValue(line: string): JsonValue {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CodexProtocolError(`Codex JSONL message is not valid JSON: ${message}`);
  }

  if (!isJsonValue(parsed)) {
    throw new CodexProtocolError('Codex JSONL message is not valid JSON data');
  }

  return parsed;
}

export function readJsonObject(value: JsonValue, fieldName: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new CodexProtocolError(`${fieldName} must be an object`);
  }

  return value;
}

export function readOptionalJsonObject(value: JsonValue | undefined, fieldName: string): JsonObject {
  if (value === undefined || value === null) {
    return {};
  }

  return readJsonObject(value, fieldName);
}

export function readString(value: JsonValue | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new CodexProtocolError(`${fieldName} must be a string`);
  }

  return value;
}

export function readOptionalString(value: JsonValue | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readString(value, fieldName);
}

export function readCodexJsonObject(value: JsonValue | undefined, fieldName: string): JsonObject {
  if (value === undefined) {
    throw new CodexProtocolError(`${fieldName} must be an object`);
  }

  return readJsonObject(value, fieldName);
}

export function readCodexJsonObjectOrNull(value: JsonValue | undefined): JsonObject | null {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

export function readCodexOptionalString(value: JsonValue | undefined, fieldName: string): string | null {
  return readOptionalString(value, fieldName);
}

export function readCodexJsonArray(value: JsonValue | undefined, fieldName: string): readonly JsonValue[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new CodexProtocolError(`${fieldName} must be an array`);
  }

  return value;
}

export function readRequiredCodexJsonArray(value: JsonValue | undefined, fieldName: string): readonly JsonValue[] {
  if (value === undefined || value === null) {
    throw new CodexProtocolError(`${fieldName} must be an array`);
  }

  return readCodexJsonArray(value, fieldName);
}

export function readCodexTextLike(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function readCodexNumberLike(value: JsonValue | undefined): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readCodexBooleanLike(value: JsonValue | undefined): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}
