import type {
  SessionError,
  SessionStreamAssistantDelta,
  SessionStreamError,
  SessionStreamMessageCompleted,
  SessionStreamPendingRequestResolved,
  SessionStreamPendingRequestUpdated,
  SessionStreamSessionMetaUpdated,
  SessionStreamSnapshot,
  SessionStreamSystemNotice,
  SessionStreamTimelineItemDelta,
  SessionStreamTimelineItemUpdated,
  SessionStreamTurnStarted,
  SessionStreamTurnCompleted,
} from '../../session-types';
import { readRequiredRecord, readRequiredString } from './readers';
import {
  readOptionalSessionIndex,
  readSessionError,
  readSessionNotice,
  readSessionNoticeArray,
  readSessionPendingRequest,
  readSessionPendingRequestArray,
  readSessionThreadStatus,
} from './shared';
import { readSessionTimelineItem, readSessionTimelineItems } from './timeline';
import {
  parsePayloadChatTurnInProgress,
  parsePayloadChatTurnTerminal,
  parsePayloadNullableChatTurn,
} from './chat-turn';

type SessionStreamDeltaField = NonNullable<SessionStreamTimelineItemDelta['deltaField']>;

const deltaFields = new Set<SessionStreamDeltaField>([
  'summary',
  'summary_boundary',
  'content',
  'aggregatedOutput',
  'output',
  'progress',
  'terminalInteraction',
]);

function readOptionalDeltaField(value: unknown, fieldName: string): SessionStreamDeltaField | undefined {
  if (value === undefined) {
    return undefined;
  }

  const nextValue = readRequiredString(value, fieldName);

  if (!deltaFields.has(nextValue as SessionStreamDeltaField)) {
    throw new Error(`${fieldName} must be one of ${Array.from(deltaFields).join(', ')}.`);
  }

  return nextValue as SessionStreamDeltaField;
}

export function parseSessionStreamSnapshot(value: unknown): SessionStreamSnapshot {
  const record = readRequiredRecord(value, 'session stream snapshot');
  const latestTurn = parsePayloadNullableChatTurn(record.latestTurn, 'session stream snapshot.latestTurn');

  return {
    threadId: readRequiredString(record.threadId, 'session stream snapshot.threadId'),
    latestTurn,
    collaborationModeKind:
      record.collaborationModeKind === undefined || record.collaborationModeKind === null
        ? record.collaborationModeKind
        : readRequiredString(record.collaborationModeKind, 'session stream snapshot.collaborationModeKind'),
    promptOverride:
      record.promptOverride === undefined || record.promptOverride === null
        ? record.promptOverride
        : readRequiredString(record.promptOverride, 'session stream snapshot.promptOverride'),
    messages: readSessionTimelineItems(record.messages, 'session stream snapshot.messages'),
    threadName:
      record.threadName === undefined || record.threadName === null
        ? undefined
        : readRequiredString(record.threadName, 'session stream snapshot.threadName'),
    threadStatus: readSessionThreadStatus(record.threadStatus, 'session stream snapshot.threadStatus'),
    threadStatusText:
      record.threadStatusText === undefined || record.threadStatusText === null
        ? undefined
        : readRequiredString(record.threadStatusText, 'session stream snapshot.threadStatusText'),
    tokenUsageText:
      record.tokenUsageText === undefined || record.tokenUsageText === null
        ? undefined
        : readRequiredString(record.tokenUsageText, 'session stream snapshot.tokenUsageText'),
    notices: readSessionNoticeArray(record.notices, 'session stream snapshot.notices'),
    pendingRequests: readSessionPendingRequestArray(record.pendingRequests, 'session stream snapshot.pendingRequests'),
    lastError: readSessionError(record.lastError, 'session stream snapshot.lastError'),
  };
}

export function parseSessionStreamAssistantDelta(value: unknown): SessionStreamAssistantDelta {
  const record = readRequiredRecord(value, 'session stream assistant delta');

  return {
    threadId: readRequiredString(record.threadId, 'session stream assistant delta.threadId'),
    turnId: readRequiredString(record.turnId, 'session stream assistant delta.turnId'),
    messageId: readRequiredString(record.messageId, 'session stream assistant delta.messageId'),
    delta: readRequiredString(record.delta, 'session stream assistant delta.delta'),
    text: readRequiredString(record.text, 'session stream assistant delta.text'),
  };
}

export function parseSessionStreamTurnStarted(value: unknown): SessionStreamTurnStarted {
  const record = readRequiredRecord(value, 'session stream turn started');

  return {
    threadId: readRequiredString(record.threadId, 'session stream turn started.threadId'),
    turn: parsePayloadChatTurnInProgress(record.turn, 'session stream turn started.turn'),
  };
}

export function parseSessionStreamMessageCompleted(value: unknown): SessionStreamMessageCompleted {
  const record = readRequiredRecord(value, 'session stream message completed');

  return {
    threadId: readRequiredString(record.threadId, 'session stream message completed.threadId'),
    turnId: readRequiredString(record.turnId, 'session stream message completed.turnId'),
    message: readSessionTimelineItem(record.message, 'session stream message completed.message') as SessionStreamMessageCompleted['message'],
  };
}

export function parseSessionStreamTimelineItemUpdated(value: unknown): SessionStreamTimelineItemUpdated {
  const record = readRequiredRecord(value, 'session stream timeline item updated');

  return {
    threadId: readRequiredString(record.threadId, 'session stream timeline item updated.threadId'),
    turnId:
      record.turnId === null ? null : readRequiredString(record.turnId, 'session stream timeline item updated.turnId'),
    item: readSessionTimelineItem(record.item, 'session stream timeline item updated.item'),
  };
}

export function parseSessionStreamTimelineItemDelta(value: unknown): SessionStreamTimelineItemDelta {
  const record = readRequiredRecord(value, 'session stream timeline item delta');

  return {
    threadId: readRequiredString(record.threadId, 'session stream timeline item delta.threadId'),
    turnId:
      record.turnId === null ? null : readRequiredString(record.turnId, 'session stream timeline item delta.turnId'),
    itemId: readRequiredString(record.itemId, 'session stream timeline item delta.itemId'),
    itemType: readRequiredString(record.itemType, 'session stream timeline item delta.itemType'),
    ...(record.delta !== undefined ? { delta: readRequiredString(record.delta, 'session stream timeline item delta.delta') } : {}),
    ...(record.deltaField !== undefined
      ? { deltaField: readOptionalDeltaField(record.deltaField, 'session stream timeline item delta.deltaField') }
      : {}),
    ...(record.index !== undefined
      ? { index: readOptionalSessionIndex(record.index, 'session stream timeline item delta.index') }
      : {}),
    ...(record.value !== undefined ? { value: record.value } : {}),
  };
}

export function parseSessionStreamSessionMetaUpdated(value: unknown): SessionStreamSessionMetaUpdated {
  const record = readRequiredRecord(value, 'session stream session meta updated');

  return {
    threadId: readRequiredString(record.threadId, 'session stream session meta updated.threadId'),
    ...(record.threadName !== undefined
      ? { threadName: readRequiredString(record.threadName, 'session stream session meta updated.threadName') }
      : {}),
    ...(record.threadStatus !== undefined
      ? { threadStatus: readSessionThreadStatus(record.threadStatus, 'session stream session meta updated.threadStatus') }
      : {}),
    ...(record.threadStatusText !== undefined
      ? {
          threadStatusText: readRequiredString(
            record.threadStatusText,
            'session stream session meta updated.threadStatusText',
          ),
        }
      : {}),
    ...(record.tokenUsageText !== undefined
      ? { tokenUsageText: readRequiredString(record.tokenUsageText, 'session stream session meta updated.tokenUsageText') }
      : {}),
  };
}

export function parseSessionStreamSystemNotice(value: unknown): SessionStreamSystemNotice {
  const record = readRequiredRecord(value, 'session stream system notice');

  return {
    threadId: readRequiredString(record.threadId, 'session stream system notice.threadId'),
    notice: readSessionNotice(record.notice, 'session stream system notice.notice'),
  };
}

export function parseSessionStreamPendingRequestUpdated(value: unknown): SessionStreamPendingRequestUpdated {
  const record = readRequiredRecord(value, 'session stream pending request updated');

  return {
    threadId: readRequiredString(record.threadId, 'session stream pending request updated.threadId'),
    request: readSessionPendingRequest(record.request, 'session stream pending request updated.request'),
  };
}

export function parseSessionStreamPendingRequestResolved(value: unknown): SessionStreamPendingRequestResolved {
  const record = readRequiredRecord(value, 'session stream pending request resolved');

  return {
    threadId: readRequiredString(record.threadId, 'session stream pending request resolved.threadId'),
    requestId: readRequiredString(record.requestId, 'session stream pending request resolved.requestId'),
    notice: readSessionNotice(record.notice, 'session stream pending request resolved.notice'),
  };
}

export function parseSessionStreamTurnCompleted(value: unknown): SessionStreamTurnCompleted {
  const record = readRequiredRecord(value, 'session stream turn completed');

  return {
    threadId: readRequiredString(record.threadId, 'session stream turn completed.threadId'),
    turn: parsePayloadChatTurnTerminal(record.turn, 'session stream turn completed.turn'),
    error: readSessionError(record.error, 'session stream turn completed.error') ?? null,
  };
}

export function parseSessionStreamError(value: unknown): SessionStreamError {
  const record = readRequiredRecord(value, 'session stream error');

  return {
    threadId: readRequiredString(record.threadId, 'session stream error.threadId'),
    turnId: record.turnId === null ? null : readRequiredString(record.turnId, 'session stream error.turnId'),
    error: readSessionError(record.error, 'session stream error.error') ?? null,
  };
}

export function createInvalidStreamPayloadError({
  eventName,
  error,
  threadId,
}: {
  eventName: string;
  error: unknown;
  threadId: string;
}): SessionError {
  const message =
    error instanceof Error
      ? `Invalid ${eventName} event payload: ${error.message}`
      : `Invalid ${eventName} event payload.`;

  return {
    message,
    codexErrorInfo: null,
    additionalDetails: null,
    httpStatusCode: null,
    willRetry: null,
    threadId,
    turnId: null,
    presentationScope: 'shared',
    source: 'invalid_stream_payload',
    raw: null,
  };
}
