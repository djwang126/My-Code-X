import { readString } from '../reader/index.js';
import type { RuntimeResult } from '../../../../ports/index.js';
import {
  createRuntimeThreadSnapshot,
  readCodexJsonObject,
  readCodexOptionalString,
  readCodexThread,
  readCodexTurn,
  readRequiredCodexJsonArray,
} from '../reader/index.js';
import { cleanRuntimeResult } from './clean-runtime-result.js';
import type { DecodeCodexResultInput } from './codex-result-input.js';

export function decodeThreadQueryResult(input: DecodeCodexResultInput): RuntimeResult | null {
  switch (input.command.kind) {
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

    default:
      return null;
  }
}
