import { describe, expect, it } from 'vitest';

import { parseSessionPayload } from './parse-session-bootstrap';

describe('parseSessionPayload', () => {
  it('parses canonical turn execution fields from a bootstrap payload', () => {
    const payload = parseSessionPayload({
      server: {
        ok: true,
        serverInstanceId: 'server-1',
        authRequired: false,
      },
      viewer: {
        viewerId: 'viewer-1',
        slotId: 'slot-1',
      },
      session: {
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'interrupted',
        },
        lastUpdatedAt: '2026-04-20T10:00:00.000Z',
      },
      conversation: {
        messages: [],
      },
      stream: {
        url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
      },
      preferences: {},
      options: {},
    });

    expect(payload.session.turnExecution.activeTurnId).toBe('turn-1');
    expect(payload.session.turnExecution.turnLifecycle).toBe('interrupted');
    expect(payload.viewer.slotId).toBe('slot-1');
  });

  it('fails explicitly when bootstrap payloads send a blank activeTurnId string', () => {
    expect(() =>
      parseSessionPayload({
        server: {
          ok: true,
          serverInstanceId: 'server-1',
          authRequired: false,
        },
        viewer: {
          viewerId: 'viewer-1',
          slotId: 'slot-1',
        },
        session: {
          workspace: 'D:/workspaces/My-Code-X',
          threadId: 'thread-1',
          turnExecution: {
            activeTurnId: '   ',
            turnLifecycle: 'completed',
          },
          lastUpdatedAt: '2026-04-20T10:00:00.000Z',
        },
        conversation: {
          messages: [],
        },
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
        preferences: {},
        options: {},
      }),
    ).toThrowError('session payload.session.turnExecution.activeTurnId must be a non-empty string or null.');
  });

  it('fails explicitly when bootstrap payloads omit session.turnExecution', () => {
    expect(() =>
      parseSessionPayload({
        server: {
          ok: true,
          serverInstanceId: 'server-1',
          authRequired: false,
        },
        viewer: {
          viewerId: 'viewer-1',
          slotId: 'slot-1',
        },
        session: {
          workspace: 'D:/workspaces/My-Code-X',
          threadId: 'thread-1',
          lastUpdatedAt: '2026-04-20T10:00:00.000Z',
        },
        conversation: {
          messages: [],
        },
        stream: {
          url: '/api/v2/chat/events?slotId=slot-1&threadId=thread-1',
        },
        preferences: {},
        options: {},
      }),
    ).toThrowError('session payload.session.turnExecution must be an object.');
  });
});
