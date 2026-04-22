import { describe, expect, it } from 'vitest';

import {
  getCollaborationModeOptions,
  withSelectedOption,
  mergeRuntimeSettings,
  normalizeRuntimeSettings,
  applySessionRuntimeMetadata,
  readRuntimeOptions,
  readRuntimeSettings,
} from '../../runtime-settings';

describe('runtime settings collaboration mode integration', () => {
  it('leaves collaboration mode unset when reading stored runtime settings without a saved mode', () => {
    expect(
      readRuntimeSettings({
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    });
  });

  it('merges stored collaboration mode with backend runtime defaults', () => {
    expect(
      mergeRuntimeSettings({
        defaults: {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          collaborationModeKind: 'default',
        },
        stored: {
          collaborationModeKind: 'plan',
        },
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      collaborationModeKind: 'plan',
    });
  });

  it('keeps collaboration mode unset when session metadata reports none', () => {
    expect(
      applySessionRuntimeMetadata(
        {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          collaborationModeKind: 'plan',
        },
        {
          collaborationModeKind: null,
        },
      ),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      collaborationModeKind: null,
    });
  });

  it('reads collaboration modes from runtime options and preserves an unavailable selected mode', () => {
    const runtimeOptions = readRuntimeOptions({
      models: [],
      approvalPolicies: [],
      sandboxModes: [],
      collaborationModes: [{ kind: 'default', label: 'Default', model: null }],
    });
    const runtimeSettings = readRuntimeSettings({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      collaborationModeKind: 'plan',
    });

    expect(runtimeOptions).not.toBeNull();
    expect(runtimeSettings).not.toBeNull();
    expect(getCollaborationModeOptions(runtimeOptions!, runtimeSettings!)).toEqual([
      { kind: 'plan', label: 'Unavailable: plan', model: null },
      { kind: 'default', label: 'Default', model: null },
    ]);
  });

  it('reads and merges a stored prompt override with runtime defaults', () => {
    expect(
      readRuntimeSettings({
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        promptOverride: 'normal',
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      promptOverride: 'normal',
    });

    expect(
      normalizeRuntimeSettings({
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        promptOverride: null,
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      promptOverride: null,
    });

    expect(
      mergeRuntimeSettings({
        defaults: {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          promptOverride: null,
        },
        stored: {
          promptOverride: 'cat',
        },
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      promptOverride: 'cat',
    });
  });

  it('reads prompt override options and preserves an unavailable selected prompt', () => {
    const runtimeOptions = readRuntimeOptions({
      models: [],
      approvalPolicies: [],
      sandboxModes: [],
      collaborationModes: [],
      promptOverrides: [{ value: 'normal', label: 'normal' }],
    });

    expect(runtimeOptions).not.toBeNull();
    expect(runtimeOptions?.promptOverrides).toEqual([{ value: 'normal', label: 'normal', description: '' }]);
    expect(withSelectedOption(runtimeOptions?.promptOverrides ?? [], 'cat')).toEqual([
      {
        value: 'cat',
        label: 'Unavailable: cat',
        description: 'Previously selected option is no longer available.',
        unavailable: true,
      },
      { value: 'normal', label: 'normal', description: '' },
    ]);
  });

  it('keeps an unavailable stored prompt override when merging with backend defaults', () => {
    expect(
      mergeRuntimeSettings({
        defaults: {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          promptOverride: null,
        },
        stored: {
          promptOverride: 'missing-prompt',
        },
      }),
    ).toEqual({
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      promptOverride: 'missing-prompt',
    });
  });
});
