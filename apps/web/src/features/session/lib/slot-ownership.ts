import { persistLocalStorageValue, readLocalStorageValue } from '../../../shared/lib/browser-storage';
import { createSlotScopedStorageKey } from '../../../shared/lib/slot-scoped-storage';

const slotOwnershipStorageSuffix = 'ownership';

export const SLOT_DISPLACED_MESSAGE = 'This slot was taken over by another window.';

export type SlotOwnershipRecord = {
  slotId: string;
  ownerInstanceId: string;
  updatedAt: string;
};

let pageOwnerInstanceId = '';

function normalizeStorageId(value: string | null | undefined) {
  return String(value || '').trim();
}

function createOwnerInstanceId() {
  const randomId = window.crypto?.randomUUID?.();
  if (randomId) {
    return `slot-owner-${randomId}`;
  }

  return `slot-owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPageOwnerInstanceId() {
  if (pageOwnerInstanceId) {
    return pageOwnerInstanceId;
  }

  pageOwnerInstanceId = createOwnerInstanceId();
  return pageOwnerInstanceId;
}

export function createSlotOwnershipStorageKey(slotId: string) {
  return createSlotScopedStorageKey(slotId, slotOwnershipStorageSuffix);
}

export function parseSlotOwnershipRecord({
  raw,
  slotId,
}: {
  raw: string | null;
  slotId: string;
}): SlotOwnershipRecord | null {
  if (!raw || !slotId) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const ownerInstanceId = normalizeStorageId(parsed?.ownerInstanceId);
    const updatedAt = String(parsed?.updatedAt || '').trim();

    if (!ownerInstanceId || !updatedAt) {
      return null;
    }

    return {
      slotId,
      ownerInstanceId,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function readSlotOwnership(slotId: string) {
  if (!slotId) {
    return null;
  }

  return parseSlotOwnershipRecord({
    raw: readLocalStorageValue(createSlotOwnershipStorageKey(slotId)),
    slotId,
  });
}

export function claimSlotOwnership(slotId: string) {
  const ownership = {
    slotId,
    ownerInstanceId: getPageOwnerInstanceId(),
    updatedAt: new Date().toISOString(),
  };

  if (slotId) {
    persistLocalStorageValue(createSlotOwnershipStorageKey(slotId), JSON.stringify(ownership));
  }

  return ownership;
}

export function isCurrentPageSlotOwner(slotId: string) {
  const ownership = readSlotOwnership(slotId);

  if (!ownership) {
    return true;
  }

  return ownership.ownerInstanceId === getPageOwnerInstanceId();
}
