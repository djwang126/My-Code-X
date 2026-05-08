import {
  clearLocalStorageValue,
  persistLocalStorageValue,
  readLocalStorageValue,
} from './browser-storage';

const slotScopedStoragePrefix = 'my-code-x-slot:';

export function createSlotScopedStorageKey(slotId: string, suffix: string) {
  return `${slotScopedStoragePrefix}${slotId}:${suffix}`;
}

export function readSlotScopedStorageValue(slotId: string, suffix: string) {
  if (!slotId) {
    return null;
  }

  return readLocalStorageValue(createSlotScopedStorageKey(slotId, suffix));
}

export function persistSlotScopedStorageValue(slotId: string, suffix: string, value: string) {
  if (!slotId) {
    return;
  }

  persistLocalStorageValue(createSlotScopedStorageKey(slotId, suffix), value);
}

export function clearSlotScopedStorageValue(slotId: string, suffix: string) {
  if (!slotId) {
    return;
  }

  clearLocalStorageValue(createSlotScopedStorageKey(slotId, suffix));
}
