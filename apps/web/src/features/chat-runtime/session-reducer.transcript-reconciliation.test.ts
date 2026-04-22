import { describe, expect, it } from 'vitest';

import { readRuntimeSettings } from '../runtime-settings';
import { bootstrapPayload, runtimePreferences } from './test/sessionReducerHarness';
import { sessionReducer } from './state/session-reducer';
import { createInitialSessionState } from './state/session-state';

describe('sessionReducer transcript reconciliation', () => {
  it('reconciles a stream snapshot as the authoritative in-progress transcript', () => {
    const next = sessionReducer(
      sessionReducer(createInitialSessionState(), {
        type: 'bootstrap/succeeded',
        payload: bootstrapPayload,
      }),
      {
        type: 'stream/snapshot',
        payload: {
          threadId: 'thread-1',
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
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
              text: 'new partial',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-1',
            },
          ],
        },
      },
    );

    expect(next.turnExecution.activeTurnId).toBe('turn-1');
    expect(next.turnExecution.turnLifecycle).toBe('running');
    expect(next.messages[1]?.text).toBe('new partial');
  });

  it('updates prompt override preferences from an authoritative stream snapshot', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        preferences: {
          ...runtimePreferences,
          promptOverride: 'cat',
        },
      },
    });

    const next = sessionReducer(hydrated, {
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'running',
        },
        promptOverride: 'normal',
        messages: bootstrapPayload.conversation.messages,
      },
    });

    expect(readRuntimeSettings(next.preferences)?.promptOverride).toBe('normal');
  });

  it('keeps collaboration mode unset when an authoritative stream snapshot reports none', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        preferences: {
          ...runtimePreferences,
          collaborationModeKind: null,
        },
        session: {
          ...bootstrapPayload.session,
          collaborationModeKind: null,
        },
      },
    });

    const next = sessionReducer(hydrated, {
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'completed',
        },
        collaborationModeKind: null,
        messages: bootstrapPayload.conversation.messages,
      },
    });

    expect(readRuntimeSettings(next.preferences)?.collaborationModeKind).toBeNull();
  });

  it('clears a stale prompt override when an authoritative stream snapshot reports none', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        preferences: {
          ...runtimePreferences,
          promptOverride: 'cat',
        },
      },
    });

    const next = sessionReducer(hydrated, {
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'completed',
        },
        promptOverride: null,
        messages: bootstrapPayload.conversation.messages,
      },
    });

    expect(readRuntimeSettings(next.preferences)?.promptOverride).toBeNull();
  });

  it('applies batched assistant deltas and turn completion stream events', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const withDelta = sessionReducer(hydrated, {
      type: 'stream/assistant-deltas',
      payloads: [
        {
          threadId: 'thread-1',
          turnId: 'turn-1',
          messageId: 'assistant:1',
          delta: ' plus more',
          text: 'still thinking plus more',
        },
      ],
      latestPayload: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        messageId: 'assistant:1',
        delta: ' plus more',
        text: 'still thinking plus more',
      },
    });

    const completed = sessionReducer(withDelta, {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'completed',
        },
        error: null,
      },
    });

    expect(withDelta.messages[1]?.text).toBe('still thinking plus more');
    expect(withDelta.turnExecution.turnLifecycle).toBe('running');
    expect(completed.turnExecution.turnLifecycle).toBe('completed');
  });

  it('hydrates typed special and fallback timeline rows while reconciling duplicate item ids', () => {
    const state = createInitialSessionState();

    const next = sessionReducer(state, {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        conversation: {
          messages: [
            {
              id: 'user-1',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'hello',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
              content: [
                { type: 'text', text: 'hello' },
                { type: 'mention', name: 'repo', path: 'app://repo' },
              ],
              raw: {
                type: 'userMessage',
                id: 'user-1',
                content: [
                  { type: 'text', text: 'hello' },
                  { type: 'mention', name: 'repo', path: 'app://repo' },
                ],
              },
            },
            {
              id: 'plan-1',
              kind: 'special',
              itemType: 'plan',
              text: 'Inspect the failing tests',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
              raw: {
                type: 'plan',
                id: 'plan-1',
                text: 'Inspect the failing tests',
              },
            },
            {
              id: 'assistant-1',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'older text',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
              raw: {
                type: 'agentMessage',
                id: 'assistant-1',
                text: 'older text',
              },
            },
            {
              id: 'assistant-1',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'newer text',
              state: 'streaming',
              threadId: 'thread-1',
              turnId: 'turn-1',
              raw: {
                type: 'agentMessage',
                id: 'assistant-1',
                text: 'newer text',
              },
            },
            {
              id: 'fallback-1',
              kind: 'fallback',
              itemType: 'totallyUnknownThing',
              text: '[totallyUnknownThing]',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
              raw: {
                type: 'totallyUnknownThing',
                id: 'fallback-1',
                payload: { nested: true },
              },
            },
          ],
        },
      },
    });

    expect(next.messages).toEqual([
      {
        id: 'user:turn-1',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'hello',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'mention', name: 'repo', path: 'app://repo' },
        ],
        raw: {
          type: 'userMessage',
          id: 'user-1',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'mention', name: 'repo', path: 'app://repo' },
          ],
        },
      },
      {
        id: 'plan-1',
        kind: 'special',
        itemType: 'plan',
        text: 'Inspect the failing tests',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'plan',
          id: 'plan-1',
          text: 'Inspect the failing tests',
        },
      },
      {
        id: 'assistant-1',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'newer text',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'agentMessage',
          id: 'assistant-1',
          text: 'newer text',
        },
      },
      {
        id: 'fallback-1',
        kind: 'fallback',
        itemType: 'totallyUnknownThing',
        text: '[totallyUnknownThing]',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'totallyUnknownThing',
          id: 'fallback-1',
          payload: { nested: true },
        },
      },
    ]);
  });

  it('keeps plan prompt state empty after turn completion until the controller derives it', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        preferences: {
          ...runtimePreferences,
          collaborationModeKind: 'plan',
        },
        session: {
          ...bootstrapPayload.session,
          collaborationModeKind: 'plan',
        },
        conversation: {
          messages: [
            ...bootstrapPayload.conversation.messages,
            {
              id: 'plan-1',
              kind: 'special',
              itemType: 'plan',
              text: 'Inspect the failing tests',
              state: 'complete',
              threadId: 'thread-1',
              turnId: 'turn-1',
              raw: {
                type: 'plan',
                id: 'plan-1',
                text: 'Inspect the failing tests',
              },
            },
          ],
        },
      },
    });

    const completed = sessionReducer(hydrated, {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'completed',
        },
        error: null,
      },
    });

    expect(completed.turnExecution.turnLifecycle).toBe('completed');
    expect(completed.messages).toEqual(hydrated.messages);
  });

  it('keeps plan-related state derived from stream data instead of storing extra prompt state', () => {
    const completed = sessionReducer(createInitialSessionState(), {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'completed',
        },
        error: null,
      },
    });

    expect(completed.turnExecution.turnLifecycle).toBe('completed');
  });

});

