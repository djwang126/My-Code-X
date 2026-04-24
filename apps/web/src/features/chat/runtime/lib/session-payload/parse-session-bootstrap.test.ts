import { describe, expect, it } from 'vitest';

import { parseSessionPayload } from './parse-session-bootstrap';

describe('parseSessionPayload', () => {
  it('parses canonical chat turn fields from a bootstrap payload', () => {
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
        latestTurn: {
        id: 'turn-1',
        status: 'interrupted',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
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

    expect(payload.session.latestTurn?.id).toBe('turn-1');
    expect(payload.session.latestTurn?.status).toBe('interrupted');
    expect(payload.viewer.slotId).toBe('slot-1');
  });

  it('fails explicitly when bootstrap payloads send a blank turnId string', () => {
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
          latestTurn: {
        id: '   ',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
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
    ).toThrowError('session payload.session.latestTurn.id must be a non-empty string.');
  });

  it('parses omitted session.latestTurn as no active chat turn', () => {
    expect(
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
      }).session.latestTurn,
    ).toBeNull();
  });
});
