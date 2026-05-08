import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { postChatMessage } from './api/session-turn-api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('postChatMessage image attachments', () => {
  it('posts structured content, preserves mixed ordering, and allows image-only messages', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-22',
          turnExecution: {
            activeTurnId: 'turn-9',
            turnLifecycle: 'running',
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
          },
        });
      }),
    );

    await postChatMessage({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      content: [
        { type: 'text', text: '先看第一张，再看第二张' },
        { type: 'imageAttachment', attachmentId: 'att-1' },
        { type: 'imageAttachment', attachmentId: 'att-2' },
      ],
    } as never);

    expect(requestBody).toEqual({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      content: [
        { type: 'text', text: '先看第一张，再看第二张' },
        { type: 'imageAttachment', attachmentId: 'att-1' },
        { type: 'imageAttachment', attachmentId: 'att-2' },
      ],
    });
  });
});
