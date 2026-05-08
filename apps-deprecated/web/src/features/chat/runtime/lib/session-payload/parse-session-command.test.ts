import { describe, expect, it } from 'vitest';

import {
  parseChatInterruptAcceptedPayload,
  parseChatMessageAcceptedPayload,
} from './parse-session-command';

describe('session command payload parsing', () => {
  it('parses accepted send payloads with canonical running lifecycle', () => {
    const payload = parseChatMessageAcceptedPayload({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
      },
      stream: {
        url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
      },
    });

    expect(payload).toEqual({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
      },
      stream: {
        url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
      },
    });
  });

  it('parses accepted interrupt payloads with canonical interrupting lifecycle', () => {
    const payload = parseChatInterruptAcceptedPayload({
      ok: true,
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'interrupting',
      },
    });

    expect(payload).toEqual({
      ok: true,
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'interrupting',
      },
    });
  });

  it('fails explicitly when an accepted command payload omits turnExecution.turnLifecycle', () => {
    expect(() =>
      parseChatMessageAcceptedPayload({
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
        },
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
      }),
    ).toThrowError(
      'chat message accepted payload.turnExecution.turnLifecycle must be one of idle, running, interrupting, completed, interrupted, or failed.',
    );
  });

  it('fails explicitly when accepted command payloads only send legacy turnId and turnLifecycle fields', () => {
    expect(() =>
      parseChatMessageAcceptedPayload({
        threadId: 'thread-1',
        turnId: 'turn-1',
        turnLifecycle: 'running',
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
      }),
    ).toThrowError('chat message accepted payload.turnExecution must be an object.');
  });
});
