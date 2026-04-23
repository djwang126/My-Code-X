import type { RuntimeSettings } from '../../../features/chat/settings';

export type RuntimeSettingsUpdateInput = {
  slotId: string;
  nextRuntimeSettings: RuntimeSettings;
};

export type RuntimeSettingsUpdateResult = {
  preferences: RuntimeSettings;
  persistSlotId: string | null;
};

export function prepareRuntimeSettingsUpdate(
  input: RuntimeSettingsUpdateInput,
): RuntimeSettingsUpdateResult {
  return {
    preferences: input.nextRuntimeSettings,
    persistSlotId: input.slotId || null,
  };
}
