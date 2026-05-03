import { readOptionalString, readString } from '../reader/index.js';
import type { RuntimeEvent } from '../../../../ports/index.js';
import {
  readCodexJsonObject,
  readCodexThread,
} from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeThreadEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  const params = input.params;

  switch (input.method) {
    case 'thread/started':
      return {
        kind: 'runtime-thread-started',
        thread: readCodexThread(params.thread, 'Codex thread/started thread'),
      };

    case 'thread/status/changed':
      return {
        kind: 'runtime-thread-status-changed',
        threadId: readString(params.threadId, 'Codex thread/status/changed threadId'),
        status: params.status ?? { type: 'notLoaded' },
      };

    case 'thread/name/updated':
      return {
        kind: 'runtime-thread-name-updated',
        threadId: readString(params.threadId, 'Codex thread/name/updated threadId'),
        name: readOptionalString(params.threadName, 'Codex thread/name/updated threadName'),
      };

    case 'thread/archived':
      return {
        kind: 'runtime-thread-archived',
        threadId: readString(params.threadId, 'Codex thread/archived threadId'),
      };

    case 'thread/unarchived':
      return {
        kind: 'runtime-thread-unarchived',
        threadId: readString(params.threadId, 'Codex thread/unarchived threadId'),
      };

    case 'thread/closed':
      return {
        kind: 'runtime-thread-closed',
        threadId: readString(params.threadId, 'Codex thread/closed threadId'),
      };

    case 'thread/tokenUsage/updated':
      return {
        kind: 'runtime-thread-token-usage-updated',
        threadId: readString(params.threadId, 'Codex thread/tokenUsage/updated threadId'),
        turnId: readString(params.turnId, 'Codex thread/tokenUsage/updated turnId'),
        tokenUsage: readCodexJsonObject(params.tokenUsage, 'Codex thread/tokenUsage/updated tokenUsage'),
      };

    default:
      return null;
  }
}
