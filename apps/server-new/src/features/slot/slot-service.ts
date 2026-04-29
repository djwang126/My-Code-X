import { applySlotDomainEvent, createInitialSlotState } from './slot-state.js';
import type {
  CloseSlotCommand,
  OpenSlotCommand,
  SelectSlotThreadCommand,
  SlotDomainEvent,
  SlotSelection,
  SlotSnapshot,
} from './slot-events.js';
import type { SlotDependencies } from './slot-ports.js';

export interface SlotService {
  open(input: OpenSlotCommand): SlotSelection;
  selectThread(input: SelectSlotThreadCommand): SlotSelection;
  close(input: CloseSlotCommand): void;
  get(slotId: string): SlotSelection | null;
  snapshot(): SlotSnapshot;
}

function createSlotSelection(input: OpenSlotCommand | SelectSlotThreadCommand): SlotSelection {
  return {
    slotId: input.slotId,
    workspace: input.workspace,
    threadId: input.threadId,
  };
}

export function createSlotService(dependencies: SlotDependencies): SlotService {
  let state = createInitialSlotState();

  function publish(event: SlotDomainEvent) {
    state = applySlotDomainEvent({ state, event });
    dependencies.events.publish(event);
  }

  return {
    open(input: OpenSlotCommand): SlotSelection {
      const slot = createSlotSelection(input);
      publish({ kind: 'slot-opened', slot });
      return slot;
    },

    selectThread(input: SelectSlotThreadCommand): SlotSelection {
      const slot = createSlotSelection(input);
      publish({ kind: 'slot-thread-selected', slot });
      return slot;
    },

    close(input: CloseSlotCommand) {
      publish({ kind: 'slot-closed', slotId: input.slotId });
    },

    get(slotId: string): SlotSelection | null {
      return state.slots.find(slot => slot.slotId === slotId) ?? null;
    },

    snapshot(): SlotSnapshot {
      return state;
    },
  };
}
