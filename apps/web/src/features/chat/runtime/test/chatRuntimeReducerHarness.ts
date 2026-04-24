import type { SessionPayload } from '../session-types';

export const runtimePreferences: SessionPayload['preferences'] = {
  model: 'gpt-5.4',
  reasoningEffort: 'medium',
  approvalPolicy: 'never',
  sandboxMode: 'danger-full-access',
  collaborationModeKind: 'default',
  promptOverride: 'cat',
};

export const bootstrapPayload = {
  server: { ok: true, serverInstanceId: 'hydrate-test', authRequired: false },
  viewer: { viewerId: 'viewer-3', slotId: 'tab-9' },
  session: {
    workspace: 'D:/workspaces/sample',
    threadId: 'thread-1',
    latestTurn: {
      id: 'turn-1',
      status: 'inProgress',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
    collaborationModeKind: 'default',
    lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    threadName: '',
    threadStatusText: '',
    tokenUsageText: '',
  },
  conversation: {
    messages: [
      {
        id: 'user:turn-1',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'hello',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
      {
        id: 'assistant:1',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'still thinking',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ],
  },
  stream: {
    url: '/api/v2/chat/events?slotId=tab-9&threadId=thread-1',
  },
  preferences: runtimePreferences,
  options: {},
  notices: [],
} satisfies SessionPayload;
