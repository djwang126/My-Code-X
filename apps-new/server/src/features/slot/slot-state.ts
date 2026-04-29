import type { SlotDomainEvent, SlotSelection, SlotSnapshot } from './slot-events.js';

export type SlotState = SlotSnapshot;

export function createInitialSlotState(): SlotState {
  return {
    slots: [],
  };
}

export interface ApplySlotDomainEventInput {
  readonly state: SlotState;
  readonly event: SlotDomainEvent;
}

export function applySlotDomainEvent(input: ApplySlotDomainEventInput): SlotState {
  const { state, event } = input;

  switch (event.kind) {
    case 'slot-opened':
    case 'slot-thread-selected':
      return {
        slots: upsertSlotSelection(state.slots, event.slot),
      };

    case 'slot-closed':
      return {
        slots: state.slots.filter(slot => slot.slotId !== event.slotId),
      };
  }
}

function upsertSlotSelection(slots: readonly SlotSelection[], nextSlot: SlotSelection): readonly SlotSelection[] {
  const index = slots.findIndex(slot => slot.slotId === nextSlot.slotId);

  if (index === -1) {
    return [...slots, nextSlot];
  }

  return slots.map((slot, slotIndex) => slotIndex === index ? nextSlot : slot);
}
