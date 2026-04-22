import type {
  SessionTimelineFallbackItem,
  SessionTimelineItem,
  SessionTimelineMessageItem,
  SessionTimelineSpecialItem,
  UserInputContentItem,
} from '../../session-types';
import {
  fail,
  readOptionalArray,
  readOptionalRecord,
  readOptionalString,
  readOptionalUnknownArray,
  readRequiredNullableString,
  readRequiredRecord,
  readRequiredString,
} from './readers';

const timelineStates = new Set(['complete', 'streaming', 'error'] as const);
const messageRoles = new Set(['user', 'assistant', 'system'] as const);
const messageItemTypes = new Set(['userMessage', 'agentMessage'] as const);
const timelineKinds = new Set(['message', 'special', 'fallback'] as const);
const imageStatuses = new Set(['unavailable'] as const);

function readAllowedString<T extends string>(value: unknown, fieldName: string, allowed: Set<T>): T {
  const nextValue = readRequiredString(value, fieldName);

  if (!allowed.has(nextValue as T)) {
    fail(fieldName, `one of ${Array.from(allowed).join(', ')}`);
  }

  return nextValue as T;
}

function readOptionalAllowedString<T extends string>(value: unknown, fieldName: string, allowed: Set<T>): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readAllowedString(value, fieldName, allowed);
}

function readContentItem(value: unknown, fieldName: string): UserInputContentItem {
  const record = readRequiredRecord(value, fieldName);
  const type = readRequiredString(record.type, `${fieldName}.type`);

  switch (type) {
    case 'text':
      return {
        type,
        ...(record.text !== undefined ? { text: readOptionalString(record.text, `${fieldName}.text`) } : {}),
        ...(record.text_elements !== undefined
          ? { text_elements: readOptionalUnknownArray(record.text_elements, `${fieldName}.text_elements`) }
          : {}),
      };
    case 'imageAttachment':
      return {
        type,
        attachmentId: readRequiredString(record.attachmentId, `${fieldName}.attachmentId`),
      };
    case 'image':
      return {
        type,
        ...(record.url !== undefined ? { url: readOptionalString(record.url, `${fieldName}.url`) } : {}),
        ...(record.attachmentId !== undefined
          ? { attachmentId: readOptionalString(record.attachmentId, `${fieldName}.attachmentId`) }
          : {}),
        ...(record.status !== undefined
          ? { status: readOptionalAllowedString(record.status, `${fieldName}.status`, imageStatuses) }
          : {}),
      };
    case 'localImage':
      return {
        type,
        ...(record.url !== undefined ? { url: readOptionalString(record.url, `${fieldName}.url`) } : {}),
        ...(record.path !== undefined ? { path: readOptionalString(record.path, `${fieldName}.path`) } : {}),
        ...(record.attachmentId !== undefined
          ? { attachmentId: readOptionalString(record.attachmentId, `${fieldName}.attachmentId`) }
          : {}),
        ...(record.status !== undefined
          ? { status: readOptionalAllowedString(record.status, `${fieldName}.status`, imageStatuses) }
          : {}),
      };
    case 'skill':
    case 'mention':
      return {
        type,
        ...(record.name !== undefined ? { name: readOptionalString(record.name, `${fieldName}.name`) } : {}),
        ...(record.path !== undefined ? { path: readOptionalString(record.path, `${fieldName}.path`) } : {}),
      };
    default:
      fail(`${fieldName}.type`, 'a supported content item type');
  }
}

function readCommonTimelineFields(record: Record<string, unknown>, fieldName: string) {
  return {
    id: readRequiredString(record.id, `${fieldName}.id`),
    text: readRequiredString(record.text, `${fieldName}.text`),
    state: readAllowedString(record.state, `${fieldName}.state`, timelineStates),
    threadId: readRequiredNullableString(record.threadId, `${fieldName}.threadId`),
    turnId: readRequiredNullableString(record.turnId, `${fieldName}.turnId`),
  };
}

function readMessageTimelineItem(record: Record<string, unknown>, fieldName: string): SessionTimelineMessageItem {
  return {
    ...readCommonTimelineFields(record, fieldName),
    kind: 'message',
    itemType: readAllowedString(record.itemType, `${fieldName}.itemType`, messageItemTypes),
    role: readAllowedString(record.role, `${fieldName}.role`, messageRoles),
    ...(record.content !== undefined
      ? { content: readOptionalArray(record.content, `${fieldName}.content`, readContentItem) }
      : {}),
    ...(record.raw !== undefined ? { raw: readOptionalRecord(record.raw, `${fieldName}.raw`) } : {}),
  };
}

function readSpecialTimelineItem(record: Record<string, unknown>, fieldName: string): SessionTimelineSpecialItem {
  return {
    ...readCommonTimelineFields(record, fieldName),
    kind: 'special',
    itemType: readRequiredString(record.itemType, `${fieldName}.itemType`),
    ...(record.status !== undefined ? { status: readOptionalString(record.status, `${fieldName}.status`) } : {}),
    ...(record.raw !== undefined ? { raw: readOptionalRecord(record.raw, `${fieldName}.raw`) } : {}),
  };
}

function readFallbackTimelineItem(record: Record<string, unknown>, fieldName: string): SessionTimelineFallbackItem {
  return {
    ...readCommonTimelineFields(record, fieldName),
    kind: 'fallback',
    itemType: readRequiredString(record.itemType, `${fieldName}.itemType`),
    ...(record.raw !== undefined ? { raw: readOptionalRecord(record.raw, `${fieldName}.raw`) } : {}),
  };
}

export function readSessionTimelineItem(value: unknown, fieldName: string): SessionTimelineItem {
  const record = readRequiredRecord(value, fieldName);
  const kind = readAllowedString(record.kind, `${fieldName}.kind`, timelineKinds);

  switch (kind) {
    case 'message':
      return readMessageTimelineItem(record, fieldName);
    case 'special':
      return readSpecialTimelineItem(record, fieldName);
    case 'fallback':
      return readFallbackTimelineItem(record, fieldName);
  }
}

export function readSessionTimelineItems(value: unknown, fieldName: string): SessionTimelineItem[] {
  return readOptionalArray(value, fieldName, readSessionTimelineItem) ?? [];
}
