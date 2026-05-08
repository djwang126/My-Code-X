import { type SessionThreadStatus } from '@my-code-x/contracts';

import type {
  SessionError,
  SessionNotice,
  SessionPayload,
  SessionPendingRequest,
  SessionPendingRequestApprovalDecision,
  SessionPendingRequestQuestion,
} from '../../session-types';
import {
  fail,
  isRecord,
  readNullableBoolean,
  readNullableNumber,
  readNullableRecord,
  readOptionalArray,
  readOptionalBoolean,
  readOptionalInteger,
  readOptionalNullableString,
  readOptionalRecord,
  readOptionalString,
  readOptionalUnknownArray,
  readRequiredNullableString,
  readRequiredRecord,
  readRequiredString,
} from './readers';
import { parseTurnExecution } from './turn-execution';

const pendingRequestKinds = new Set([
  'command_approval',
  'file_change_approval',
  'permissions_approval',
  'legacy_patch_approval',
  'legacy_command_approval',
  'user_input',
  'mcp_elicitation',
  'tool_call',
  'auth_refresh',
] as const);
const pendingRequestSubmitStates = new Set(['idle', 'submitting'] as const);
const noticeLevels = new Set(['info', 'warning', 'error'] as const);
const errorPresentationScopes = new Set(['conversation', 'shared'] as const);
const approvalDecisions = new Set([
  'accept',
  'acceptForSession',
  'decline',
  'cancel',
  'approved',
  'approved_for_session',
  'denied',
  'abort',
] as const);

function readAllowedString<T extends string>(value: unknown, fieldName: string, allowed: Set<T>): T {
  const nextValue = readRequiredString(value, fieldName);

  if (!allowed.has(nextValue as T)) {
    fail(fieldName, `one of ${Array.from(allowed).join(', ')}`);
  }

  return nextValue as T;
}

function readOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  return readOptionalArray(value, fieldName, readRequiredString);
}

function readDecision(value: unknown, fieldName: string): SessionPendingRequestApprovalDecision {
  if (typeof value === 'string') {
    return readAllowedString(value, fieldName, approvalDecisions);
  }

  return readRequiredRecord(value, fieldName);
}

function readQuestion(value: unknown, fieldName: string): SessionPendingRequestQuestion {
  const record = readRequiredRecord(value, fieldName);

  return {
    id: readRequiredString(record.id, `${fieldName}.id`),
    header: readRequiredString(record.header, `${fieldName}.header`),
    question: readRequiredString(record.question, `${fieldName}.question`),
    options: readOptionalArray(record.options, `${fieldName}.options`, (optionValue, optionFieldName) => {
      const option = readRequiredRecord(optionValue, optionFieldName);
      return {
        label: readRequiredString(option.label, `${optionFieldName}.label`),
        description: readRequiredString(option.description, `${optionFieldName}.description`),
      };
    }),
    isOther: readOptionalBoolean(record.isOther, `${fieldName}.isOther`),
    isSecret: readOptionalBoolean(record.isSecret, `${fieldName}.isSecret`),
  };
}

export function readSessionThreadStatus(value: unknown, fieldName: string): SessionThreadStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string') {
    return value;
  }

  const record = readRequiredRecord(value, fieldName);
  const nextStatus: Record<string, unknown> = {
    ...record,
    type: readRequiredString(record.type, `${fieldName}.type`),
  };

  if (record.activeFlags !== undefined) {
    nextStatus.activeFlags = readOptionalStringArray(record.activeFlags, `${fieldName}.activeFlags`);
  }

  return nextStatus as SessionThreadStatus;
}

export function readSessionError(value: unknown, fieldName: string): SessionError | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const record = readRequiredRecord(value, fieldName);
  const codexErrorInfo = record.codexErrorInfo;

  if (!(codexErrorInfo === null || typeof codexErrorInfo === 'string' || isRecord(codexErrorInfo))) {
    fail(`${fieldName}.codexErrorInfo`, 'a string, object, or null');
  }

  return {
    message: readRequiredString(record.message, `${fieldName}.message`),
    codexErrorInfo: (codexErrorInfo ?? null) as SessionError['codexErrorInfo'],
    additionalDetails: readOptionalNullableString(record.additionalDetails, `${fieldName}.additionalDetails`) ?? null,
    httpStatusCode: readNullableNumber(record.httpStatusCode, `${fieldName}.httpStatusCode`),
    willRetry: readNullableBoolean(record.willRetry, `${fieldName}.willRetry`),
    threadId: readOptionalNullableString(record.threadId, `${fieldName}.threadId`) ?? null,
    turnId: readOptionalNullableString(record.turnId, `${fieldName}.turnId`) ?? null,
    presentationScope: readAllowedString(
      record.presentationScope,
      `${fieldName}.presentationScope`,
      errorPresentationScopes,
    ),
    source: readRequiredString(record.source, `${fieldName}.source`),
    raw: readNullableRecord(record.raw, `${fieldName}.raw`),
  };
}

export function readSessionNotice(value: unknown, fieldName: string): SessionNotice {
  const record = readRequiredRecord(value, fieldName);

  return {
    id: readRequiredString(record.id, `${fieldName}.id`),
    level: readAllowedString(record.level, `${fieldName}.level`, noticeLevels),
    title: readRequiredString(record.title, `${fieldName}.title`),
    text: readRequiredString(record.text, `${fieldName}.text`),
    ...(record.raw !== undefined ? { raw: readOptionalRecord(record.raw, `${fieldName}.raw`) } : {}),
  };
}

export function readSessionPendingRequest(value: unknown, fieldName: string): SessionPendingRequest {
  const record = readRequiredRecord(value, fieldName);

  return {
    id: readRequiredString(record.id, `${fieldName}.id`),
    method: readRequiredString(record.method, `${fieldName}.method`),
    kind: readAllowedString(record.kind, `${fieldName}.kind`, pendingRequestKinds),
    threadId: readRequiredString(record.threadId, `${fieldName}.threadId`),
    turnId: readRequiredNullableString(record.turnId, `${fieldName}.turnId`),
    title: readRequiredString(record.title, `${fieldName}.title`),
    prompt: readRequiredString(record.prompt, `${fieldName}.prompt`),
    submitState: readAllowedString(record.submitState, `${fieldName}.submitState`, pendingRequestSubmitStates),
    ...(record.itemId !== undefined ? { itemId: readOptionalString(record.itemId, `${fieldName}.itemId`) } : {}),
    ...(record.callId !== undefined ? { callId: readOptionalString(record.callId, `${fieldName}.callId`) } : {}),
    ...(record.approvalId !== undefined
      ? { approvalId: readOptionalString(record.approvalId, `${fieldName}.approvalId`) }
      : {}),
    ...(record.command !== undefined ? { command: readOptionalString(record.command, `${fieldName}.command`) } : {}),
    ...(record.cwd !== undefined ? { cwd: readOptionalString(record.cwd, `${fieldName}.cwd`) } : {}),
    ...(record.reason !== undefined ? { reason: readOptionalNullableString(record.reason, `${fieldName}.reason`) } : {}),
    ...(record.grantRoot !== undefined
      ? { grantRoot: readOptionalNullableString(record.grantRoot, `${fieldName}.grantRoot`) }
      : {}),
    ...(record.commandActions !== undefined
      ? { commandActions: readOptionalUnknownArray(record.commandActions, `${fieldName}.commandActions`) }
      : {}),
    ...(record.availableDecisions !== undefined
      ? {
          availableDecisions: readOptionalArray(record.availableDecisions, `${fieldName}.availableDecisions`, readDecision),
        }
      : {}),
    ...(record.networkApprovalContext !== undefined
      ? { networkApprovalContext: readOptionalRecord(record.networkApprovalContext, `${fieldName}.networkApprovalContext`) }
      : {}),
    ...(record.permissions !== undefined
      ? { permissions: readOptionalRecord(record.permissions, `${fieldName}.permissions`) }
      : {}),
    ...(record.fileChanges !== undefined
      ? { fileChanges: readOptionalRecord(record.fileChanges, `${fieldName}.fileChanges`) }
      : {}),
    ...(record.questions !== undefined
      ? { questions: readOptionalArray(record.questions, `${fieldName}.questions`, readQuestion) }
      : {}),
    ...(record.serverName !== undefined
      ? { serverName: readOptionalString(record.serverName, `${fieldName}.serverName`) }
      : {}),
    ...(record.mode !== undefined ? { mode: readOptionalString(record.mode, `${fieldName}.mode`) } : {}),
    ...(record.requestedSchema !== undefined
      ? { requestedSchema: readOptionalRecord(record.requestedSchema, `${fieldName}.requestedSchema`) }
      : {}),
    ...(record.url !== undefined ? { url: readOptionalString(record.url, `${fieldName}.url`) } : {}),
    ...(record.elicitationId !== undefined
      ? { elicitationId: readOptionalString(record.elicitationId, `${fieldName}.elicitationId`) }
      : {}),
    ...(record.tool !== undefined ? { tool: readOptionalString(record.tool, `${fieldName}.tool`) } : {}),
    ...(record.arguments !== undefined ? { arguments: record.arguments } : {}),
    ...(record.previousAccountId !== undefined
      ? { previousAccountId: readOptionalNullableString(record.previousAccountId, `${fieldName}.previousAccountId`) }
      : {}),
    ...(record.raw !== undefined ? { raw: readOptionalRecord(record.raw, `${fieldName}.raw`) } : {}),
  };
}

export function readSessionRecord(value: unknown, fieldName: string): SessionPayload['session'] {
  const record = readRequiredRecord(value, fieldName);
  const turnExecution = parseTurnExecution(record.turnExecution, `${fieldName}.turnExecution`);

  return {
    workspace: readRequiredString(record.workspace, `${fieldName}.workspace`),
    threadId: readRequiredString(record.threadId, `${fieldName}.threadId`),
    turnExecution,
    collaborationModeKind: readOptionalNullableString(record.collaborationModeKind, `${fieldName}.collaborationModeKind`),
    promptOverride: readOptionalNullableString(record.promptOverride, `${fieldName}.promptOverride`),
    lastUpdatedAt: readRequiredString(record.lastUpdatedAt, `${fieldName}.lastUpdatedAt`),
    threadName: readOptionalNullableString(record.threadName, `${fieldName}.threadName`) ?? undefined,
    threadStatus: readSessionThreadStatus(record.threadStatus, `${fieldName}.threadStatus`),
    threadStatusText: readOptionalNullableString(record.threadStatusText, `${fieldName}.threadStatusText`) ?? undefined,
    tokenUsageText: readOptionalNullableString(record.tokenUsageText, `${fieldName}.tokenUsageText`) ?? undefined,
    lastError: readSessionError(record.lastError, `${fieldName}.lastError`),
  };
}

export function readSessionNoticeArray(value: unknown, fieldName: string) {
  return readOptionalArray(value, fieldName, readSessionNotice);
}

export function readSessionPendingRequestArray(value: unknown, fieldName: string) {
  return readOptionalArray(value, fieldName, readSessionPendingRequest);
}

export function readOptionalSessionIndex(value: unknown, fieldName: string): number | undefined {
  const nextIndex = readOptionalInteger(value, fieldName);

  if (nextIndex === undefined || nextIndex >= 0) {
    return nextIndex;
  }

  fail(fieldName, 'a non-negative integer');
}
