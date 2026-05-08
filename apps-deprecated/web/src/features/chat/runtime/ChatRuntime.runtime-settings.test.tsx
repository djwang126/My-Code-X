import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '../../../app';
import type { SessionTimelineMessageItem, SessionTimelineItem } from './session-types';

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  closed = false;

  constructor(url: string | URL) {
    this.url = String(url);
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

function createMessageItem({
  id,
  role,
  text,
  state = 'complete',
  threadId,
  turnId,
}: {
  id: string;
  role: SessionTimelineMessageItem['role'];
  text: string;
  state?: SessionTimelineMessageItem['state'];
  threadId: string;
  turnId: string;
}): SessionTimelineMessageItem {
  return {
    id,
    kind: 'message',
    itemType: role === 'assistant' ? 'agentMessage' : 'userMessage',
    role,
    text,
    state,
    threadId,
    turnId,
  };
}

function createUserMessage(id: string, text: string, threadId: string, turnId: string): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'user', text, threadId, turnId });
}

function createAssistantMessage(
  id: string,
  text: string,
  threadId: string,
  turnId: string,
  state: SessionTimelineMessageItem['state'] = 'complete',
): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'assistant', text, state, threadId, turnId });
}

function createSessionResponse({
  viewerId,
  slotId,
  threadId = 'thread-ready',
  workspace = 'D:/workspace/example-app',
  messages,
  preferences = {
    model: 'gpt-5.1-codex',
    reasoningEffort: 'medium',
    reasoningSummary: 'auto',
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
    promptOverride: null,
  },
  options = {
    models: [
      {
        value: 'gpt-5.1-codex',
        label: 'GPT-5.1 Codex',
        description: 'Stable default',
        reasoningEfforts: [
          { value: 'medium', label: 'Medium', description: 'Balanced' },
          { value: 'high', label: 'High', description: 'More reasoning' },
        ],
        defaultReasoningEffort: 'medium',
      },
      {
        value: 'gpt-5.4',
        label: 'GPT-5.4',
        description: 'Latest',
        reasoningEfforts: [
          { value: 'high', label: 'High', description: 'Deep reasoning' },
          { value: 'xhigh', label: 'Extra high', description: 'Deepest reasoning' },
        ],
        defaultReasoningEffort: 'high',
      },
    ],
    reasoningSummaryOptions: [
      { value: 'auto', label: 'Auto', description: 'Use the model default summary.' },
      { value: 'concise', label: 'Concise', description: 'Short summary.' },
      { value: 'detailed', label: 'Detailed', description: 'Detailed summary.' },
      { value: 'none', label: 'None', description: 'No summary.' },
    ],
    approvalPolicies: [
      { value: 'never', label: 'Never', description: 'Never ask' },
      { value: 'on-request', label: 'On request', description: 'Ask when requested' },
    ],
    sandboxModes: [
      { value: 'danger-full-access', label: 'Danger full access', description: 'Full access' },
      { value: 'workspace-write', label: 'Workspace write', description: 'Workspace only' },
    ],
    collaborationModes: [
      { kind: 'default', label: 'Default', model: null, reasoningEffort: null },
      { kind: 'plan', label: 'Plan', model: null, reasoningEffort: 'medium' },
    ],
    promptOverrides: [
      { value: 'normal', label: 'normal', description: '' },
      { value: 'cat', label: 'cat', description: '' },
    ],
  },
}: {
  viewerId: string | null;
  slotId: string | null;
  threadId?: string;
  workspace?: string;
  messages?: SessionTimelineItem[];
  preferences?: Record<string, unknown>;
  options?: Record<string, unknown>;
}) {
  const transcriptTurnId = 'turn-ready';

  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace,
      threadId,
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    },
    conversation: {
      messages:
        messages ??
        [
          createUserMessage('user:turn-ready', 'hello', threadId, transcriptTurnId),
          createAssistantMessage('assistant:turn-ready', 'hi there', threadId, transcriptTurnId),
        ],
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId || ''}&threadId=${threadId}`,
    },
    preferences,
    options,
  });
}

const server = setupServer(
  http.get('/api/v2/session', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('viewerId') === 'viewer-auth') {
      return new HttpResponse(null, { status: 401 });
    }
    if (url.searchParams.get('viewerId') === 'viewer-error') {
      return new HttpResponse('thread/resume failed: thread not found', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return createSessionResponse({
      viewerId: url.searchParams.get('viewerId'),
      slotId: url.searchParams.get('slotId'),
      threadId: url.searchParams.get('threadId') || 'thread-ready',
    });
  }),
  http.get('/api/v2/thread/history', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      data: [
        {
          id: 'thread-ready',
          name: 'Ready thread',
          preview: 'hello',
          workspace: url.searchParams.get('workspace') || '',
          createdAt: 1_744_000_000,
          updatedAt: 1_744_000_500,
          statusText: 'idle',
        },
      ],
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  MockEventSource.reset();
});
afterAll(() => server.close());

async function openRuntimeSettings(user?: ReturnType<typeof userEvent.setup>) {
  if (user) {
    await user.click(screen.getByRole('button', { name: 'Toggle settings' }));
  } else {
    screen.getByRole('button', { name: 'Toggle settings' }).click();
  }

  await screen.findByRole('combobox', { name: 'Model' });
}

describe('ChatRuntime', () => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', MockEventSource);
  });

  function setTextboxValue(name: string, value: string) {
    fireEvent.change(screen.getByRole('textbox', { name }), {
      target: { value },
    });
  }

  function setSpinbuttonValue(name: string, value: number) {
    fireEvent.change(screen.getByRole('spinbutton', { name }), {
      target: { value: String(value) },
    });
  }

  it('keeps stored unsupported runtime settings instead of overwriting them with backend defaults', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-runtime-stored');
    window.history.replaceState({}, '', `/?slot=${'tab-runtime-stored'}`);
    window.localStorage.setItem(
      'my-code-x-slot:tab-runtime-stored:runtime-preferences',
      JSON.stringify({
        model: 'gpt-legacy',
        reasoningEffort: 'high',
        reasoningSummary: 'detailed',
        approvalPolicy: 'never',
        sandboxMode: 'workspace-write',
        promptOverride: 'missing-prompt',
        modelContextWindow: 128000,
        modelAutoCompactTokenLimit: 96000,
      }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openRuntimeSettings();

    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('gpt-legacy');
    expect(screen.getByRole('option', { name: 'Unavailable: gpt-legacy' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Prompt override' })).toHaveValue('missing-prompt');
    expect(screen.getByRole('combobox', { name: 'Reasoning summary' })).toHaveValue('detailed');
    expect(screen.getByRole('combobox', { name: 'Sandbox mode' })).toHaveValue('workspace-write');
    expect(screen.getByRole('spinbutton', { name: 'Model context window' })).toHaveValue(128000);
  });

  it('shows the official model context window max for the selected model', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          preferences: {
            model: 'gpt-5.1-codex',
            reasoningEffort: 'medium',
            reasoningSummary: 'auto',
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access',
          },
        });
      }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openRuntimeSettings();

    expect(screen.getByPlaceholderText('max: 400000')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Model' }), 'gpt-5.4');

    expect(screen.getByPlaceholderText('max: 1050000')).toBeInTheDocument();
  });

  it('sends the selected runtime settings with chat messages', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-runtime-send',
          turnId: 'turn-runtime-send',
          turnLifecycle: 'running',
          stream: {
            url: '/api/v2/chat/events?slotId=tab-runtime-send&threadId=thread-runtime-send',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-runtime-send');
    window.history.replaceState({}, '', `/?slot=${'tab-runtime-send'}`);

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openRuntimeSettings(user);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Model' }), 'gpt-5.4');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'plan');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prompt override' }), 'normal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reasoning effort' }), 'xhigh');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reasoning summary' }), 'detailed');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Approval policy' }), 'on-request');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sandbox mode' }), 'workspace-write');
    setSpinbuttonValue('Model context window', 200000);
    setTextboxValue('chat input', 'Use the selected runtime');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(requestBody).toEqual({
        viewerId: 'viewer-runtime-send',
        slotId: expect.stringMatching(/^(slot|tab)-/),
        workspace: 'D:/workspace/example-app',
        threadId: 'thread-ready',
        content: [{ type: 'text', text: 'Use the selected runtime' }],
        runtimeSettings: {
          model: 'gpt-5.4',
          reasoningEffort: 'xhigh',
          reasoningSummary: 'detailed',
          approvalPolicy: 'on-request',
          sandboxMode: 'workspace-write',
          collaborationModeKind: 'plan',
          promptOverride: 'normal',
          modelContextWindow: 200000,
          modelAutoCompactTokenLimit: 180000,
        },
      }),
    );

    expect(
      window.localStorage.getItem('my-code-x-slot:tab-runtime-send:runtime-preferences'),
    ).toContain('"model":"gpt-5.4"');
  }, 15000);

  it('keeps mode set to none after bootstrap sync', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-mode-none');
    window.history.replaceState({}, '', `/?slot=${'tab-mode-none'}`);
    window.localStorage.setItem(
      'my-code-x-slot:tab-mode-none:runtime-preferences',
      JSON.stringify({
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: null,
      }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openRuntimeSettings();

    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('');
  });
});
