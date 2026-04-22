export class SessionPayloadParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionPayloadParseError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function fail(fieldName: string, expected: string): never {
  throw new SessionPayloadParseError(`${fieldName} must be ${expected}.`);
}

export function readRequiredRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(fieldName, 'an object');
  }

  return value;
}

export function readOptionalRecord(value: unknown, fieldName: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredRecord(value, fieldName);
}

export function readNullableRecord(value: unknown, fieldName: string): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  return readRequiredRecord(value, fieldName);
}

export function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    fail(fieldName, 'a string');
  }

  return value;
}

export function readOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredString(value, fieldName);
}

export function readRequiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    fail(fieldName, 'a boolean');
  }

  return value;
}

export function readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredBoolean(value, fieldName);
}

export function readRequiredNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return readRequiredString(value, fieldName);
}

export function readOptionalNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return readRequiredString(value, fieldName);
}

export function readNullableBoolean(value: unknown, fieldName: string): boolean | null {
  if (value === null) {
    return null;
  }

  return readRequiredBoolean(value, fieldName);
}

export function readNullableNumber(value: unknown, fieldName: string): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(fieldName, 'a finite number or null');
  }

  return value;
}

export function readOptionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(fieldName, 'an integer');
  }

  return value;
}

export function readRequiredArray<T>(
  value: unknown,
  fieldName: string,
  readEntry: (entry: unknown, fieldName: string) => T,
): T[] {
  if (!Array.isArray(value)) {
    fail(fieldName, 'an array');
  }

  return value.map((entry, index) => readEntry(entry, `${fieldName}[${index}]`));
}

export function readOptionalArray<T>(
  value: unknown,
  fieldName: string,
  readEntry: (entry: unknown, fieldName: string) => T,
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredArray(value, fieldName, readEntry);
}

export function readUnknownArray(value: unknown, fieldName: string): unknown[] {
  return readRequiredArray(value, fieldName, entry => entry);
}

export function readOptionalUnknownArray(value: unknown, fieldName: string): unknown[] | undefined {
  return readOptionalArray(value, fieldName, entry => entry);
}
