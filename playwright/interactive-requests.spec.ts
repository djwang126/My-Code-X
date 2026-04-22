import { expect, test } from '@playwright/test';

test('browser flow can submit and clear a threadless auth-refresh request', async ({ page }) => {
  const requestBodies: Array<Record<string, unknown>> = [];
  const slotId = 'pw-slot-auth-refresh';

  await page.addInitScript(() => {
    class MockEventSource {
      static instances: MockEventSource[] = [];

      url: string;

      listeners: Map<string, Set<(event: MessageEvent<string>) => void>>;

      constructor(url: string) {
        this.url = url;
        this.listeners = new Map();
        MockEventSource.instances.push(this);
      }

      addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
        this.listeners.get(type)?.delete(listener);
      }

      close() {}

      emit(type: string, payload: unknown) {
        const event = new MessageEvent(type, {
          data: typeof payload === 'string' ? payload : JSON.stringify(payload),
        });

        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    Object.assign(window, {
      EventSource: MockEventSource,
      __emitMockEventSource(type: string, payload: unknown) {
        MockEventSource.instances[0]?.emit(type, payload);
      },
    });

    window.sessionStorage.setItem('my-code-x-viewer-id', 'pw-viewer-auth-refresh');
  });

  await page.route('**/api/v2/session?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        server: { ok: true, serverInstanceId: 'pw-test', authRequired: false },
        viewer: { viewerId: 'pw-viewer-auth-refresh', slotId },
        session: {
          workspace: 'D:/workspace/example-app',
          threadId: 'pw-thread-auth-refresh',
          activeTurnId: 'pw-turn-auth-refresh',
          turnStatus: 'in_progress',
          waitingForInput: false,
          lastUpdatedAt: '2026-04-04T08:00:00.000Z',
        },
        conversation: {
          messages: [],
        },
        stream: {
          url: `/api/v2/chat/events?slotId=${slotId}&threadId=pw-thread-auth-refresh`,
        },
        preferences: {},
        options: {},
        pendingRequests: [],
      }),
    });
  });

  await page.route('**/api/v2/server-requests/respond', async route => {
    const body = route.request().postData() || '{}';
    requestBodies.push(JSON.parse(body) as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true, requestId: 'req-auth' }),
    });
  });

  await page.goto(`/?slot=${slotId}`);

  await expect(page.getByRole('heading', { name: 'My code X' })).toBeVisible();
  await expect(page.getByText('Thread: pw-thread-auth-refresh')).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'pending_request_updated',
      {
        threadId: '',
        request: {
          id: 'req-auth',
          method: 'account/chatgptAuthTokens/refresh',
          kind: 'auth_refresh',
          threadId: '',
          turnId: null,
          title: 'Refresh ChatGPT authentication',
          prompt: 'Codex needs refreshed ChatGPT credentials.',
          previousAccountId: 'acct-9',
          submitState: 'idle',
          raw: {
            reason: 'unauthorized',
          },
        },
      },
    );
  });

  await expect(page.getByText('Refresh ChatGPT authentication')).toBeVisible();

  await page.getByRole('textbox', { name: 'Access token' }).fill('token-123');
  await page.getByRole('textbox', { name: 'Account id' }).fill('acct-9');
  await page.getByRole('button', { name: 'Submit tokens' }).click();

  await expect.poll(() => requestBodies).toEqual([
    {
      slotId,
      threadId: '',
      requestId: 'req-auth',
      response: {
        accessToken: 'token-123',
        chatgptAccountId: 'acct-9',
      },
    },
  ]);

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'pending_request_resolved',
      {
        threadId: '',
        requestId: 'req-auth',
        notice: {
          id: 'serverRequest/resolved:req-auth',
          level: 'info',
          title: 'Request resolved',
          text: 'Resolved request req-auth',
        },
      },
    );
  });

  await expect(page.getByText('Resolved request req-auth')).toBeVisible();
  await expect(page.getByText('Refresh ChatGPT authentication')).toHaveCount(0);
});

test('browser flow keeps resumed media fallbacks visible while live updates and auth refresh resolve', async ({ page }) => {
  const requestBodies: Array<Record<string, unknown>> = [];
  const slotId = 'pw-slot-issue-8';

  await page.addInitScript(() => {
    class MockEventSource {
      static instances: MockEventSource[] = [];

      url: string;

      listeners: Map<string, Set<(event: MessageEvent<string>) => void>>;

      constructor(url: string) {
        this.url = url;
        this.listeners = new Map();
        MockEventSource.instances.push(this);
      }

      addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
        this.listeners.get(type)?.delete(listener);
      }

      close() {}

      emit(type: string, payload: unknown) {
        const event = new MessageEvent(type, {
          data: typeof payload === 'string' ? payload : JSON.stringify(payload),
        });

        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    Object.assign(window, {
      EventSource: MockEventSource,
      __emitMockEventSource(type: string, payload: unknown) {
        MockEventSource.instances[0]?.emit(type, payload);
      },
    });

    window.sessionStorage.setItem('my-code-x-viewer-id', 'pw-viewer-issue-8');
  });

  await page.route('**/api/v2/session?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        server: { ok: true, serverInstanceId: 'pw-test', authRequired: false },
        viewer: { viewerId: 'pw-viewer-issue-8', slotId },
        session: {
          workspace: 'D:/workspace/example-app',
          threadId: 'pw-thread-issue-8',
          activeTurnId: 'pw-turn-issue-8',
          turnStatus: 'in_progress',
          waitingForInput: false,
          lastUpdatedAt: '2026-04-04T08:00:00.000Z',
        },
        conversation: {
          messages: [
            {
              id: 'image-generation-1',
              kind: 'fallback',
              itemType: 'imageGeneration',
              text: '[imageGeneration]',
              state: 'streaming',
              threadId: 'pw-thread-issue-8',
              turnId: 'pw-turn-issue-8',
              raw: {
                type: 'imageGeneration',
                id: 'image-generation-1',
              },
            },
          ],
        },
        stream: {
          url: `/api/v2/chat/events?slotId=${slotId}&threadId=pw-thread-issue-8`,
        },
        preferences: {},
        options: {},
        pendingRequests: [],
      }),
    });
  });

  await page.route('**/api/v2/server-requests/respond', async route => {
    const body = route.request().postData() || '{}';
    requestBodies.push(JSON.parse(body) as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true, requestId: 'req-auth-issue-8' }),
    });
  });

  await page.goto(`/?slot=${slotId}`);

  await expect(page.getByLabel('imageGeneration item')).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'future_notification',
      {
        threadId: 'pw-thread-issue-8',
        payload: { ignored: true },
      },
    );
  });

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'timeline_item_updated',
      {
        threadId: 'pw-thread-issue-8',
        turnId: 'pw-turn-issue-8',
        item: {
          id: 'image-view-1',
          kind: 'fallback',
          itemType: 'imageView',
          text: '[imageView]',
          state: 'complete',
          threadId: 'pw-thread-issue-8',
          turnId: 'pw-turn-issue-8',
          raw: {
            type: 'imageView',
            id: 'image-view-1',
          },
        },
      },
    );
  });

  await expect(page.getByLabel('imageView item')).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'pending_request_updated',
      {
        threadId: '',
        request: {
          id: 'req-auth-issue-8',
          method: 'account/chatgptAuthTokens/refresh',
          kind: 'auth_refresh',
          threadId: '',
          turnId: null,
          title: 'Refresh ChatGPT authentication',
          prompt: 'Codex needs refreshed ChatGPT credentials.',
          previousAccountId: 'acct-8',
          submitState: 'idle',
          raw: {
            reason: 'unauthorized',
          },
        },
      },
    );
  });

  await expect(page.getByText('Refresh ChatGPT authentication')).toBeVisible();

  await page.getByRole('textbox', { name: 'Access token' }).fill('token-issue-8');
  await page.getByRole('textbox', { name: 'Account id' }).fill('acct-8');
  await page.getByRole('button', { name: 'Submit tokens' }).click();

  await expect.poll(() => requestBodies).toEqual([
    {
      slotId,
      threadId: '',
      requestId: 'req-auth-issue-8',
      response: {
        accessToken: 'token-issue-8',
        chatgptAccountId: 'acct-8',
      },
    },
  ]);

  await page.evaluate(() => {
    (window as typeof window & { __emitMockEventSource: (type: string, payload: unknown) => void }).__emitMockEventSource(
      'pending_request_resolved',
      {
        threadId: '',
        requestId: 'req-auth-issue-8',
        notice: {
          id: 'serverRequest/resolved:req-auth-issue-8',
          level: 'info',
          title: 'Request resolved',
          text: 'Resolved request req-auth-issue-8',
        },
      },
    );
  });

  await expect(page.getByText('Resolved request req-auth-issue-8')).toBeVisible();
  await expect(page.getByLabel('imageGeneration item')).toBeVisible();
  await expect(page.getByLabel('imageView item')).toBeVisible();
  await expect(page.getByText('Refresh ChatGPT authentication')).toHaveCount(0);
});
