import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createSlotService } from './slot-service.js';
import type { DomainEvent } from '../../ports/index.js';

function createPublishedEvents() {
  const events: DomainEvent[] = [];

  return {
    events,
    bus: {
      publish(event: DomainEvent) {
        events.push(event);
      },

      subscribe() {
        return () => {};
      },
    },
  };
}

describe('createSlotService', () => {
  test('stores only the current slot selection', () => {
    const published = createPublishedEvents();
    const service = createSlotService({ events: published.bus });

    const slot = service.open({
      slotId: 'slot-1',
      workspace: 'workspace-1',
      threadId: 'thread-1',
    });

    assert.deepEqual(slot, {
      slotId: 'slot-1',
      workspace: 'workspace-1',
      threadId: 'thread-1',
    });
    assert.deepEqual(service.get('slot-1'), slot);
    assert.deepEqual(service.snapshot(), { slots: [slot] });
    assert.deepEqual(published.events, [
      {
        kind: 'slot-opened',
        slot,
      },
    ]);
  });

  test('closes a slot without lifecycle state', () => {
    const published = createPublishedEvents();
    const service = createSlotService({ events: published.bus });

    service.open({
      slotId: 'slot-1',
      workspace: null,
      threadId: null,
    });
    service.close({
      slotId: 'slot-1',
    });

    assert.equal(service.get('slot-1'), null);
    assert.deepEqual(service.snapshot(), { slots: [] });
  });
});
