import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import { readString } from '../reader/index.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeResult } from '../../../../ports/index.js';
import {
  createRuntimeThreadSnapshot,
  hasCodexEffectiveConfig,
  isRichCodexThreadPayload,
  readCodexEffectiveConfig,
  readCodexJsonObject,
  readCodexNumberLike,
  readCodexThread,
} from '../reader/index.js';
import { cleanRuntimeResult } from './clean-runtime-result.js';
import type { DecodeCodexResultInput } from './codex-result-input.js';

export function decodeThreadResult(input: DecodeCodexResultInput): RuntimeResult | null {
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

    default:
      return null;
  }
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
