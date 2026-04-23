import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import App from '../../../../app';
import { createSlotOwnershipStorageKey } from '../../../session';
import type { SessionTimelineMessageItem, SessionTimelineItem } from '../session-types';

export class MockEventSource {
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

export function setDocumentVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

export function dispatchSlotOwnershipChange({
  slotId,
  ownerInstanceId = 'other-owner',
  updatedAt = '2026-04-03T12:34:56.000Z',
}: {
  slotId: string;
  ownerInstanceId?: string;
  updatedAt?: string;
}) {
  const key = createSlotOwnershipStorageKey(slotId);
  const newValue = JSON.stringify({
    slotId,
    ownerInstanceId,
    updatedAt,
  });

  window.localStorage.setItem(key, newValue);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      newValue,
      oldValue: null,
      storageArea: window.localStorage,
      url: window.location.href,
    }),
  );
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

export function createUserMessage(id: string, text: string, threadId: string, turnId: string): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'user', text, threadId, turnId });
}

export function createAssistantMessage(
  id: string,
  text: string,
  threadId: string,
  turnId: string,
  state: SessionTimelineMessageItem['state'] = 'complete',
): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'assistant', text, state, threadId, turnId });
}

export function createSessionResponse({
  viewerId,
  slotId,
  threadId = 'thread-ready',
  workspace = 'D:/workspace/example-app',
  collaborationModeKind = 'default',
  messages,
  preferences = {
    model: 'gpt-5.1-codex',
    reasoningEffort: 'medium',
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
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
    approvalPolicies: [
      { value: 'never', label: 'Never', description: 'Never ask' },
      { value: 'on-request', label: 'On request', description: 'Ask when requested' },
    ],
    sandboxModes: [
      { value: 'danger-full-access', label: 'Danger full access', description: 'Full access' },
      { value: 'workspace-write', label: 'Workspace write', description: 'Workspace only' },
    ],
    collaborationModes: [
      { kind: 'plan', label: 'Plan', model: null, reasoningEffort: 'medium' },
      { kind: 'default', label: 'Default', model: null, reasoningEffort: null },
    ],
  },
}: {
  viewerId: string | null;
  slotId: string | null;
  threadId?: string;
  workspace?: string;
  collaborationModeKind?: string | null;
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
      collaborationModeKind,
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

export const sessionGateServer = setupServer(
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

export function registerChatRuntimeTestLifecycle() {
  beforeAll(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    sessionGateServer.listen();
  });

  afterEach(() => {
    cleanup();
    sessionGateServer.resetHandlers();
    vi.restoreAllMocks();
    setDocumentVisibility('visible');
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    MockEventSource.reset();
  });

  afterAll(() => {
    sessionGateServer.close();
  });
}

export function renderApp(ui = <App />) {
  return render(ui);
}

export function setTextboxValue(name: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name }), {
    target: { value },
  });
}

export async function openRuntimeSettings(user?: ReturnType<typeof userEvent.setup>) {
  if (user) {
    await user.click(screen.getByRole('button', { name: 'Toggle settings' }));
  } else {
    screen.getByRole('button', { name: 'Toggle settings' }).click();
  }

  await screen.findByRole('combobox', { name: 'Model' });
}

export { fireEvent, http, HttpResponse, render, screen, userEvent, waitFor };
