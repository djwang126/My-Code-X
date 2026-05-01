import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { readString } from '../transport/jsonl-message.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeCommand, RuntimeResult } from '../../../ports/index.js';
import {
  createRuntimeThreadSnapshot,
  hasCodexEffectiveConfig,
  isRichCodexThreadPayload,
  isRichCodexTurnPayload,
  readCodexEffectiveConfig,
  readCodexJsonObject,
  readCodexNumberLike,
  readCodexOptionalString,
  readCodexThread,
  readCodexTurn,
  readRequiredCodexJsonArray,
} from './codex-v2-readers.js';

export function mapCodexResultToRuntimeResult(input: MapCodexResultInput): RuntimeResult {
  switch (input.command.kind) {
    case 'start-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/start result');
      const threadPayload = readCodexJsonObject(payload.thread, 'Codex thread/start result.thread');
      const thread = readCodexThread(threadPayload, 'Codex thread/start result.thread');
      return cleanRuntimeResult({
        kind: 'thread-started',
        threadId: thread.threadId,
        thread: isRichCodexThreadPayload(threadPayload) ? thread : undefined,
        effectiveConfig: hasCodexEffectiveConfig(payload) ? readCodexEffectiveConfig(payload) : undefined,
      });
    }

    case 'resume-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/resume result');
      const thread = readCodexThread(payload.thread, 'Codex thread/resume result.thread');
      return cleanRuntimeResult({
        kind: 'thread-resumed',
        threadId: thread.threadId,
        thread,
        effectiveConfig: hasCodexEffectiveConfig(payload) ? readCodexEffectiveConfig(payload) : undefined,
        snapshot: createRuntimeThreadSnapshot(thread),
      });
    }

    case 'fork-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/fork result');
      const thread = readCodexThread(payload.thread, 'Codex thread/fork result.thread');
      return {
        kind: 'thread-forked',
        threadId: thread.threadId,
        thread,
        effectiveConfig: readCodexEffectiveConfig(payload),
        snapshot: createRuntimeThreadSnapshot(thread),
      };
    }

    case 'archive-thread':
    case 'set-thread-name':
    case 'set-thread-memory-mode':
    case 'compact-thread':
    case 'run-thread-shell-command':
    case 'approve-thread-guardian-denied-action':
    case 'clean-thread-background-terminals':
    case 'inject-thread-items':
      return {
        kind: 'ok',
      };

    case 'unarchive-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/unarchive result');
      const thread = readCodexThread(payload.thread, 'Codex thread/unarchive result.thread');
      return {
        kind: 'thread-updated',
        operation: 'unarchive',
        threadId: thread.threadId,
        thread,
        snapshot: createRuntimeThreadSnapshot(thread),
      };
    }

    case 'unsubscribe-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/unsubscribe result');
      return {
        kind: 'thread-unsubscribed',
        threadId: input.command.threadId,
        status: readUnsubscribeStatus(payload.status),
      };
    }

    case 'increment-thread-elicitation':
    case 'decrement-thread-elicitation':
      return readThreadElicitationResult({
        result: input.result,
        threadId: input.command.threadId,
      });

    case 'update-thread-metadata': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/metadata/update result');
      const thread = readCodexThread(payload.thread, 'Codex thread/metadata/update result.thread');
      return {
        kind: 'thread-updated',
        operation: 'metadata-update',
        threadId: thread.threadId,
        thread,
        snapshot: createRuntimeThreadSnapshot(thread),
      };
    }

    case 'read-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/read result');
      const thread = readCodexThread(payload.thread, 'Codex thread/read result.thread');
      return {
        kind: 'thread-read',
        threadId: thread.threadId,
        thread,
        snapshot: createRuntimeThreadSnapshot(thread),
      };
    }

    case 'list-threads': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/list result');
      return cleanRuntimeResult({
        kind: 'threads-listed',
        threads: readRequiredCodexJsonArray(payload.data, 'Codex thread/list result.data').map(item =>
          readCodexThread(item, 'Codex listed thread'),
        ),
        nextCursor: readCodexOptionalString(payload.nextCursor, 'Codex thread/list result.nextCursor') ?? undefined,
        backwardsCursor: readCodexOptionalString(payload.backwardsCursor, 'Codex thread/list result.backwardsCursor') ?? undefined,
      });
    }

    case 'list-loaded-threads': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/loaded/list result');
      return cleanRuntimeResult({
        kind: 'loaded-threads-listed',
        threadIds: readRequiredCodexJsonArray(payload.data, 'Codex thread/loaded/list result.data').map(item =>
          readString(item, 'Codex loaded thread id'),
        ),
        nextCursor: readCodexOptionalString(payload.nextCursor, 'Codex thread/loaded/list result.nextCursor') ?? undefined,
      });
    }

    case 'list-thread-turns': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/turns/list result');
      return {
        kind: 'thread-turns-listed',
        threadId: input.command.threadId,
        turns: readRequiredCodexJsonArray(payload.data, 'Codex thread/turns/list result.data').map(item =>
          readCodexTurn(item, 'Codex listed turn'),
        ),
        nextCursor: readCodexOptionalString(payload.nextCursor, 'Codex thread/turns/list result.nextCursor') ?? undefined,
        backwardsCursor: readCodexOptionalString(payload.backwardsCursor, 'Codex thread/turns/list result.backwardsCursor') ?? undefined,
      };
    }

    case 'rollback-thread': {
      const payload = readCodexJsonObject(input.result, 'Codex thread/rollback result');
      const thread = readCodexThread(payload.thread, 'Codex thread/rollback result.thread');
      return {
        kind: 'thread-updated',
        operation: 'rollback',
        threadId: thread.threadId,
        thread,
        snapshot: createRuntimeThreadSnapshot(thread),
      };
    }

    case 'start-turn': {
      const payload = readCodexJsonObject(input.result, 'Codex turn/start result');
      const turn = readCodexTurn(payload.turn, 'Codex turn/start result.turn');
      return cleanRuntimeResult({
        kind: 'turn-started',
        turnId: turn.id,
        turn: isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
      });
    }

    case 'steer-turn': {
      const payload = readCodexJsonObject(input.result, 'Codex turn/steer result');
      return {
        kind: 'turn-steered',
        turnId: readString(payload.turnId, 'Codex turn/steer turnId'),
      };
    }

    case 'start-review': {
      const payload = readCodexJsonObject(input.result, 'Codex review/start result');
      const turn = readCodexTurn(payload.turn, 'Codex review/start result.turn');
      return cleanRuntimeResult({
        kind: 'review-started',
        turnId: turn.id,
        reviewThreadId: readString(payload.reviewThreadId, 'Codex review/start result.reviewThreadId'),
        turn: isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
      });
    }

    case 'interrupt-turn':
      return {
        kind: 'ok',
      };

    case 'respond-to-runtime-request':
      return {
        kind: 'runtime-request-responded',
        requestId: input.command.requestId,
      };
  }
}

export interface MapCodexResultInput {
  readonly command: RuntimeCommand;
  readonly result: JsonValue;
}

interface ReadThreadElicitationResultInput {
  readonly result: JsonValue;
  readonly threadId: string;
}

function readThreadElicitationResult(input: ReadThreadElicitationResultInput): RuntimeResult {
  const payload = readCodexJsonObject(input.result, 'Codex thread elicitation result');
  const count = readCodexNumberLike(payload.count);

  if (count === null || typeof payload.paused !== 'boolean') {
    throw new CodexProtocolError('Codex thread elicitation result is missing count or paused');
  }

  return {
    kind: 'thread-elicitation-updated',
    threadId: input.threadId,
    count,
    paused: payload.paused,
  };
}

function readUnsubscribeStatus(value: JsonValue | undefined): 'notLoaded' | 'notSubscribed' | 'unsubscribed' {
  const status = readString(value, 'Codex thread/unsubscribe status');

  switch (status) {
    case 'notLoaded':
    case 'notSubscribed':
    case 'unsubscribed':
      return status;
    default:
      throw new CodexProtocolError(`Unsupported Codex thread/unsubscribe status: ${status}`);
  }
}

function cleanRuntimeResult<T extends RuntimeResult>(result: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(result)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}
