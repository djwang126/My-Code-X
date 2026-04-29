export interface OpenSlotCommand {
  readonly slotId: string;
  readonly workspace: string | null;
  readonly threadId: string | null;
}

export interface SelectSlotThreadCommand {
  readonly slotId: string;
  readonly workspace: string | null;
  readonly threadId: string | null;
}

export interface CloseSlotCommand {
  readonly slotId: string;
}

export type SlotDomainEvent = SlotOpenedEvent | SlotThreadSelectedEvent | SlotClosedEvent;

export interface SlotOpenedEvent {
  readonly kind: 'slot-opened';
  readonly slot: SlotSelection;
}

export interface SlotThreadSelectedEvent {
  readonly kind: 'slot-thread-selected';
  readonly slot: SlotSelection;
}

export interface SlotClosedEvent {
  readonly kind: 'slot-closed';
  readonly slotId: string;
}

export interface SlotSelection {
  readonly slotId: string;
  readonly workspace: string | null;
  readonly threadId: string | null;
}

export interface SlotSnapshot {
  readonly slots: readonly SlotSelection[];
}
