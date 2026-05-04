import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  clientActionResultSchema,
  clientActionSchema,
  clientSnapshotSchema,
  type ClientSnapshot,
  type PendingInteraction,
} from './index.js';
import { jsonObjectSchema } from './json.js';

describe('client protocol contracts', () => {
  test('accepts a complete client action envelope only', () => {
    assert.deepEqual(clientActionSchema.parse({
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    }), {
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    });
  });

  test('rejects client actions with runtime fields outside payload', () => {
    const parsed = clientActionSchema.safeParse({
      kind: 'send-message',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: 'thread-1',
      },
      payload: {},
      sandboxMode: 'danger-full-access',
      approvalPolicy: 'never',
    });

    assert.equal(parsed.success, false);
  });

  test('accepts the complete client snapshot shape', () => {
    const snapshot = createClientSnapshot();

    assert.deepEqual(clientSnapshotSchema.parse(snapshot), snapshot);
  });

  test('rejects partial client snapshots at the protocol boundary', () => {
    const parsed = clientSnapshotSchema.safeParse({
      conversation: {
        status: 'ready',
        revision: 0,
        items: [],
      },
    });

    assert.equal(parsed.success, false);
  });

  test('validates action results through the same snapshot and event contracts', () => {
    const result = {
      status: 'accepted',
      snapshot: createClientSnapshot(),
      events: [],
      workspacePanel: null,
    };

    assert.deepEqual(clientActionResultSchema.parse(result), result);
  });

  test('keeps JsonObject distinct from arrays', () => {
    assert.equal(jsonObjectSchema.safeParse([]).success, false);
    assert.equal(jsonObjectSchema.safeParse({ value: Number.POSITIVE_INFINITY }).success, false);
    assert.deepEqual(jsonObjectSchema.parse({ ok: true, nested: { count: 1 } }), {
      ok: true,
      nested: {
        count: 1,
      },
    });
  });
});

function createClientSnapshot() {
  return {
    app: {
      status: 'ready',
    },
    identity: {
      slotId: 'slot-1',
    },
    selection: {
      workspaceId: null,
      threadId: null,
    },
    workspace: {
      status: 'none',
    },
    thread: {
      status: 'none',
      title: null,
    },
    turn: {
      current: null,
    },
    conversation: {
      status: 'ready',
      revision: 0,
      items: [],
    },
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled',
      revision: 'initial',
    },
  };
}


function assertReadonlyPublicArrays(snapshot: ClientSnapshot, interaction: PendingInteraction): void {
  // @ts-expect-error protocol arrays are readonly at compile time.
  snapshot.pendingInteractions.push(interaction);
  // @ts-expect-error nested protocol arrays are readonly at compile time.
  snapshot.capabilities.actions.push('send-message');
  // @ts-expect-error pending interaction controls are readonly at compile time.
  interaction.controls.push({
    kind: 'button',
    id: 'approve',
    label: 'Approve',
    style: 'primary',
  });

  if (interaction.controls[0]?.kind === 'choice') {
    // @ts-expect-error nested pending interaction choices are readonly at compile time.
    interaction.controls[0].choices.push({
      id: 'one',
      label: 'One',
      description: 'One choice',
    });
  }
}

void assertReadonlyPublicArrays;
