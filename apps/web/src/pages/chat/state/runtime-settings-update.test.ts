import { describe, expect, it } from 'vitest';

import { prepareRuntimeSettingsUpdate } from './runtime-settings-update';

describe('prepareRuntimeSettingsUpdate', () => {
  it('prepares one immediate-save runtime settings payload for the current slot', () => {
    const result = prepareRuntimeSettingsUpdate({
      slotId: 'slot-1',
      nextRuntimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
    });

    expect(result).toEqual({
      persistSlotId: 'slot-1',
      preferences: {
        model: 'gpt-5.4',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
    });
  });

  it('does not request persistence when the slot id is missing', () => {
    const result = prepareRuntimeSettingsUpdate({
      slotId: '',
      nextRuntimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
      },
    });

    expect(result.persistSlotId).toBeNull();
    expect(result.preferences).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    });
  });

  it('treats collaboration mode like any other immediate-save runtime setting', () => {
    const result = prepareRuntimeSettingsUpdate({
      slotId: 'slot-9',
      nextRuntimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
        promptOverride: null,
      },
    });

    expect(result.preferences.collaborationModeKind).toBe('default');
    expect(result.persistSlotId).toBe('slot-9');
  });
});
