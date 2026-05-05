import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { ClientSnapshot } from '@my-code-x/contracts-new';
import { applyResumeSnapshotToAppShellState } from './app-shell-state.js';

describe('app shell state', () => {
  test('applies a resume snapshot to conversation and current scope', () => {
    const state = applyResumeSnapshotToAppShellState({
      state: {
        scope: {
          slotId: 'slot-1',
          workspaceId: null,
          threadId: null,
          label: 'slot slot-1',
        },
        conversation: {
          status: 'ready',
          revision: 0,
          items: [],
        },
      },
      snapshot: createSnapshot({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
      }),
    });

    assert.deepEqual(state, {
      scope: {
        slotId: 'slot-1',
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
        label: 'thread thread-2',
      },
      conversation: {
        status: 'ready',
        revision: 2,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'restored',
          },
        ],
      },
    });
  });
});

function createSnapshot(input: {
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}): ClientSnapshot {
  return {
    app: {
      status: 'ready',
    },
    identity: {
      slotId: 'slot-1',
    },
    selection: {
      workspaceId: input.workspaceId,
      threadId: input.threadId,
    },
    workspace: {
      status: input.workspaceId === null ? 'none' : 'selected',
    },
    thread: {
      status: input.threadId === null ? 'none' : 'ready',
      title: input.threadId,
    },
    turn: {
      current: null,
    },
    conversation: {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'restored',
        },
      ],
    },
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled',
      revision: 'resume-2',
    },
  };
}
