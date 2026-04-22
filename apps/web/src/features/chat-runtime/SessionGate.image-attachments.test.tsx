import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '../../app';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly url: string;
  constructor(url: string | URL) {
    this.url = String(url);
    MockEventSource.instances.push(this);
  }
  addEventListener() {}
  removeEventListener() {}
  close() {}
  static reset() {
    MockEventSource.instances = [];
  }
}

function createSessionResponse({ viewerId, slotId }: { viewerId: string | null; slotId: string | null }) {
  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-image',
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      collaborationModeKind: 'default',
      lastUpdatedAt: '2026-04-15T10:00:00.000Z',
    },
    conversation: {
      messages: [],
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId || ''}&threadId=thread-image`,
    },
    preferences: {
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    },
    options: {
      models: [
        {
          value: 'gpt-5.1-codex',
          label: 'GPT-5.1 Codex',
          description: 'Stable default',
          reasoningEfforts: [{ value: 'medium', label: 'Medium', description: 'Balanced' }],
          defaultReasoningEffort: 'medium',
        },
      ],
      approvalPolicies: [{ value: 'never', label: 'Never', description: 'Never ask' }],
      sandboxModes: [{ value: 'danger-full-access', label: 'Danger full access', description: 'Full access' }],
      collaborationModes: [{ kind: 'default', label: 'Default', model: null, reasoningEffort: null }],
    },
  });
}

const server = setupServer(
  http.get('/api/v2/session', ({ request }) => {
    const url = new URL(request.url);
    return createSessionResponse({
      viewerId: url.searchParams.get('viewerId'),
      slotId: url.searchParams.get('slotId'),
    });
  }),
  http.get('/api/v2/thread/history', () => HttpResponse.json({ data: [] })),
);

beforeAll(() => {
  server.listen();
  vi.stubGlobal('EventSource', MockEventSource);
  URL.createObjectURL = vi.fn(file => `blob:preview/${file instanceof File ? file.name : 'attachment'}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  MockEventSource.reset();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  server.close();
});

function createImageFile(name: string) {
  return new File([`${name}-content`], name, { type: 'image/png' });
}

function getAttachmentDialog() {
  return screen.getByRole('dialog', { name: 'Add images' });
}

function getAttachmentInput() {
  const input = getAttachmentDialog().querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('attachment file input not found');
  }

  return input;
}

async function openAttachmentDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add images' }));
  expect(getAttachmentDialog()).toBeInTheDocument();
}

async function uploadImages(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  await user.upload(getAttachmentInput(), files);
}

async function closeAttachmentDialog(user: ReturnType<typeof userEvent.setup>) {
  const backdrop = document.querySelector('.overlay-backdrop.visible');
  if (!(backdrop instanceof HTMLElement)) {
    throw new Error('attachment overlay backdrop not found');
  }

  await user.click(backdrop);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add images' })).toBeNull());
}

describe('SessionGate image attachments', () => {
  it('renders persisted attachment thumbnails after session bootstrap so refreshed threads keep prior images visible', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-image-history',
            turnExecution: {
              activeTurnId: null,
              turnLifecycle: 'idle',
            },
            collaborationModeKind: 'default',
            lastUpdatedAt: '2026-04-15T10:00:00.000Z',
          },
          conversation: {
            messages: [
              {
                id: 'user:turn-image-history',
                kind: 'message',
                itemType: 'userMessage',
                role: 'user',
                text: '恢复后也要看到这张图',
                state: 'complete',
                threadId: 'thread-image-history',
                turnId: 'turn-image-history',
                content: [
                  { type: 'text', text: '**恢复后**也要看到这张图' },
                  { type: 'image', url: '/api/v2/chat/attachments/att-history/content' },
                  { type: 'text', text: '`image history`' },
                ],
                raw: {
                  type: 'userMessage',
                  id: 'user:turn-image-history',
                  content: [
                    { type: 'text', text: '**恢复后**也要看到这张图' },
                    { type: 'image', url: '/api/v2/chat/attachments/att-history/content' },
                    { type: 'text', text: '`image history`' },
                  ],
                },
              },
            ],
          },
          stream: {
            url: `/api/v2/chat/events?slotId=${url.searchParams.get('slotId') || ''}&threadId=thread-image-history`,
          },
          preferences: {
            model: 'gpt-5.1-codex',
            reasoningEffort: 'medium',
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access',
          },
          options: {
            models: [
              {
                value: 'gpt-5.1-codex',
                label: 'GPT-5.1 Codex',
                description: 'Stable default',
                reasoningEfforts: [{ value: 'medium', label: 'Medium', description: 'Balanced' }],
                defaultReasoningEffort: 'medium',
              },
            ],
            approvalPolicies: [{ value: 'never', label: 'Never', description: 'Never ask' }],
            sandboxModes: [{ value: 'danger-full-access', label: 'Danger full access', description: 'Full access' }],
            collaborationModes: [{ kind: 'default', label: 'Default', model: null, reasoningEffort: null }],
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-image-history');
    window.history.replaceState({}, '', `/?slot=${'tab-image-history'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('恢复后', { selector: 'strong' })).toBeInTheDocument());
    expect(screen.getByText('image history', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attached image 1' })).toHaveAttribute(
      'src',
      '/api/v2/chat/attachments/att-history/content',
    );
  });

  it('uploads selected images first and then sends the returned attachment ids in message order', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];
    let uploadCount = 0;

    server.use(
      http.post('/api/v2/chat/attachments', async () => {
        uploadCount += 1;
        return HttpResponse.json({
          attachmentId: `att-${uploadCount}`,
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          byteLength: 123456,
        });
      }),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-image',
          turnId: 'turn-image-send',
          turnLifecycle: 'running',
          stream: {
            url: '/api/v2/chat/events?slotId=tab-image-send&threadId=thread-image',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-image-send');
    window.history.replaceState({}, '', `/?slot=${'tab-image-send'}`);
    const user = userEvent.setup();

    render(<App />);
    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    await openAttachmentDialog(user);
    await uploadImages(user, [createImageFile('first.png'), createImageFile('second.png')]);
    await waitFor(() => expect(screen.queryByText('Processing')).toBeNull());
    expect(uploadCount).toBe(2);

    await closeAttachmentDialog(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-image-send',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-image',
      content: [
        { type: 'imageAttachment', attachmentId: 'att-1' },
        { type: 'imageAttachment', attachmentId: 'att-2' },
      ],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
      },
    });
  });

  it('keeps successful uploads, lets the user remove a failed one, and only sends the remaining ready attachment', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];
    let uploadCount = 0;

    server.use(
      http.post('/api/v2/chat/attachments', async () => {
        uploadCount += 1;
        if (uploadCount === 2) {
          return HttpResponse.json(
            {
              error: {
                code: 'unsupported_attachment_type',
                message: 'unsupported image',
                status: 400,
              },
            },
            { status: 400 },
          );
        }

        return HttpResponse.json({
          attachmentId: 'att-ready',
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          byteLength: 123456,
        });
      }),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-image',
          turnId: 'turn-image-send',
          turnLifecycle: 'running',
          stream: {
            url: '/api/v2/chat/events?slotId=tab-image-remove&threadId=thread-image',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-image-remove');
    window.history.replaceState({}, '', `/?slot=${'tab-image-remove'}`);
    const user = userEvent.setup();

    render(<App />);
    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    await openAttachmentDialog(user);
    await uploadImages(user, [createImageFile('ready.png'), createImageFile('failed.png')]);

    await waitFor(() => expect(screen.getByText('unsupported image')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    const failedItemName = screen.getByText('failed.png');
    const failedItemCard = failedItemName.parentElement;
    if (!(failedItemCard instanceof HTMLElement)) {
      throw new Error('failed attachment card not found');
    }
    await user.click(within(failedItemCard).getByRole('button', { name: 'Remove image' }));

    expect(screen.queryByText('unsupported image')).toBeNull();
    expect(screen.getByText('Ready')).toBeInTheDocument();

    await closeAttachmentDialog(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-image-remove',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-image',
      content: [{ type: 'imageAttachment', attachmentId: 'att-ready' }],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
      },
    });
  });

  it('keeps prepared image attachments in the draft after send failure so the user can retry directly', async () => {
    server.use(
      http.post('/api/v2/chat/attachments', async () =>
        HttpResponse.json({
          attachmentId: 'att-retry',
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          byteLength: 123456,
        }),
      ),
      http.post('/api/v2/chat/message', () =>
        new HttpResponse('attachment handoff failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-image-retry');
    window.history.replaceState({}, '', `/?slot=${'tab-image-retry'}`);
    const user = userEvent.setup();

    render(<App />);
    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    await openAttachmentDialog(user);
    await uploadImages(user, [createImageFile('retry.png')]);
    await waitFor(() => expect(screen.queryByText('Processing')).toBeNull());
    expect(screen.getByText('Ready')).toBeInTheDocument();

    await closeAttachmentDialog(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('attachment handoff failed')).toBeInTheDocument());

    await openAttachmentDialog(user);
    expect(screen.getByText('retry.png')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});
