import { describe, expect, it } from 'vitest';

import {
  parseChatInterruptAcceptedPayload,
  parseChatMessageAcceptedPayload,
} from './parse-session-command';

describe('session command payload parsing', () => {
  it('parses accepted send payloads with canonical running state', () => {
    const payload = parseChatMessageAcceptedPayload({
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      stream: {
        url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
      },
    });

    expect(payload).toEqual({
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      stream: {
        url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
      },
    });
  });

  it('parses accepted interrupt payloads with the current in-progress turn', () => {
    const payload = parseChatInterruptAcceptedPayload({
      ok: true,
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });

    expect(payload).toEqual({
      ok: true,
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });
  });

  it('fails explicitly when an accepted command payload omits turn.status', () => {
    expect(() =>
      parseChatMessageAcceptedPayload({
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
        },
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
      }),
    ).toThrowError(
      'chat message accepted payload.turn.status must be one of inProgress, completed, interrupted, or failed.',
    );
  });

  it('fails explicitly when accepted command payloads only send legacy top-level turnId and status fields', () => {
    expect(() =>
      parseChatMessageAcceptedPayload({
        threadId: 'thread-1',
        turnId: 'turn-1',
        status: 'inProgress',
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
      }),
    ).toThrowError('chat message accepted payload.turn must be an object or null.');
  });
});
