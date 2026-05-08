import type { RuntimeSettings } from '../settings-types';
import { persistSlotScopedStorageValue, readSlotScopedStorageValue } from '../../../../shared/lib/slot-scoped-storage';

const runtimePreferencesStorageSuffix = 'runtime-preferences';

function parseStoredRuntimePreferences(raw: string | null): Partial<RuntimeSettings> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<RuntimeSettings>) : null;
  } catch {
    return null;
  }
}

export function loadStoredRuntimePreferences(slotId: string): Partial<RuntimeSettings> | null {
  return parseStoredRuntimePreferences(readSlotScopedStorageValue(slotId, runtimePreferencesStorageSuffix));
}

export function persistRuntimePreferences(slotId: string, preferences: RuntimeSettings) {
  if (!slotId) {
    return;
  }

  persistSlotScopedStorageValue(slotId, runtimePreferencesStorageSuffix, JSON.stringify(preferences));
}
