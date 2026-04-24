import type {
  ThreadResumeAcceptedPayload,
  ThreadStartAcceptedPayload,
  ThreadCompactAcceptedPayload,
  ThreadForkAcceptedPayload,
  ThreadRollbackAcceptedPayload,
} from '@my-code-x/contracts';
import type { SessionStreamSnapshot } from '../runtime';
import { parseSessionStreamSnapshot } from '../runtime/lib/session-payload-parse';
import { postJson } from '../../../shared/lib/app-api-client';

type ParsedThreadRollbackAcceptedPayload = Omit<ThreadRollbackAcceptedPayload, 'snapshot'> & {
  snapshot: SessionStreamSnapshot;
};

type ParsedThreadForkAcceptedPayload = Omit<ThreadForkAcceptedPayload, 'snapshot'> & {
  snapshot: SessionStreamSnapshot;
};

type ParsedThreadStartAcceptedPayload = Omit<ThreadStartAcceptedPayload, 'snapshot'> & {
  snapshot: SessionStreamSnapshot;
};

type ParsedThreadResumeAcceptedPayload = Omit<ThreadResumeAcceptedPayload, 'snapshot'> & {
  snapshot: SessionStreamSnapshot;
};

export type ParsedThreadActionPayload =
  | ParsedThreadStartAcceptedPayload
  | ParsedThreadResumeAcceptedPayload
  | ThreadCompactAcceptedPayload
  | ParsedThreadRollbackAcceptedPayload
  | ParsedThreadForkAcceptedPayload;

function readRequiredRecord(value: unknown, fieldName: string) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as { [key: string]: unknown };
  }

  throw new Error(`${fieldName} must be an object.`);
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new Error(`${fieldName} must be a non-empty string.`);
}

export function parseThreadActionPayload(value: unknown): ParsedThreadActionPayload {
  const record = readRequiredRecord(value, 'thread action payload');
  const kind = readRequiredString(record.kind, 'thread action payload.kind');

  if (kind === 'threadCompactStarted') {
    return {
      kind,
      threadId: readRequiredString(record.threadId, 'thread action payload.threadId'),
    };
  }

  if (kind === 'threadStarted') {
    return {
      kind,
      threadId: readRequiredString(record.threadId, 'thread action payload.threadId'),
      snapshot: parseSessionStreamSnapshot(record.snapshot),
    };
  }

  if (kind === 'threadResumed') {
    return {
      kind,
      threadId: readRequiredString(record.threadId, 'thread action payload.threadId'),
      snapshot: parseSessionStreamSnapshot(record.snapshot),
    };
  }

  if (kind === 'threadRolledBack') {
    return {
      kind,
      threadId: readRequiredString(record.threadId, 'thread action payload.threadId'),
      snapshot: parseSessionStreamSnapshot(record.snapshot),
    };
  }

  if (kind === 'threadForked') {
    return {
      kind,
      sourceThreadId: readRequiredString(record.sourceThreadId, 'thread action payload.sourceThreadId'),
      threadId: readRequiredString(record.threadId, 'thread action payload.threadId'),
      snapshot: parseSessionStreamSnapshot(record.snapshot),
    };
  }

  throw new Error(
    'thread action payload.kind must be threadStarted, threadResumed, threadCompactStarted, threadRolledBack, or threadForked.',
  );
}

export async function postThreadStart({
  viewerId,
  slotId,
  workspace,
  runtimeSettings,
}: {
  viewerId: string;
  slotId: string;
  workspace: string;
  runtimeSettings?: Record<string, unknown>;
}) {
  return postJson<ParsedThreadStartAcceptedPayload>({
    url: '/api/v2/thread/start',
    body: {
      viewerId,
      slotId,
      workspace,
      ...(runtimeSettings ? { runtimeSettings } : {}),
    },
    parseResponse: payload => {
      const parsed = parseThreadActionPayload(payload);
      if (parsed.kind !== 'threadStarted') {
        throw new Error('thread start response kind mismatch.');
      }
      return parsed;
    },
  });
}

export async function postThreadResume({
  viewerId,
  slotId,
  threadId,
  workspace,
  runtimeSettings,
}: {
  viewerId: string;
  slotId: string;
  threadId: string;
  workspace: string;
  runtimeSettings?: Record<string, unknown>;
}) {
  return postJson<ParsedThreadResumeAcceptedPayload>({
    url: '/api/v2/thread/resume',
    body: {
      viewerId,
      slotId,
      threadId,
      workspace,
      ...(runtimeSettings ? { runtimeSettings } : {}),
    },
    parseResponse: payload => {
      const parsed = parseThreadActionPayload(payload);
      if (parsed.kind !== 'threadResumed') {
        throw new Error('thread resume response kind mismatch.');
      }
      return parsed;
    },
  });
}

export async function postThreadCompactStart({
  slotId,
  threadId,
  workspace,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
}) {
  return postJson<ThreadCompactAcceptedPayload>({
    url: '/api/v2/thread/compact',
    body: {
      slotId,
      threadId,
      workspace,
    },
    parseResponse: payload => {
      const parsed = parseThreadActionPayload(payload);
      if (parsed.kind !== 'threadCompactStarted') {
        throw new Error('thread compact response kind mismatch.');
      }
      return parsed;
    },
  });
}

export async function postThreadRollback({
  slotId,
  threadId,
  workspace,
  numTurns,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
  numTurns: number;
}) {
  return postJson<ParsedThreadRollbackAcceptedPayload>({
    url: '/api/v2/thread/rollback',
    body: {
      slotId,
      threadId,
      workspace,
      numTurns,
    },
    parseResponse: payload => {
      const parsed = parseThreadActionPayload(payload);
      if (parsed.kind !== 'threadRolledBack') {
        throw new Error('thread rollback response kind mismatch.');
      }
      return parsed;
    },
  });
}

export async function postThreadFork({
  slotId,
  threadId,
  workspace,
  preservedTurnCount,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
  preservedTurnCount: number;
}) {
  return postJson<ParsedThreadForkAcceptedPayload>({
    url: '/api/v2/thread/fork',
    body: {
      slotId,
      threadId,
      workspace,
      preservedTurnCount,
    },
    parseResponse: payload => {
      const parsed = parseThreadActionPayload(payload);
      if (parsed.kind !== 'threadForked') {
        throw new Error('thread fork response kind mismatch.');
      }
      return parsed;
    },
  });
}
