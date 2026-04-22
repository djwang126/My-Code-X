import { normalizeCollaborationModeKind, readOptionalCollaborationModeKind } from '../../../shared/lib/collaboration-mode';
import { OFFICIAL_MODEL_CONTEXT_WINDOW_MAX, type RuntimeSettings } from '../runtime-settings-types';

export function normalizeOptionalStringSelection(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return undefined;
}

export function getOfficialModelContextWindowMax(model: string): number | null {
  return OFFICIAL_MODEL_CONTEXT_WINDOW_MAX[model] ?? null;
}

export function deriveModelAutoCompactTokenLimit(
  runtimeSettings: Pick<RuntimeSettings, 'modelContextWindow'>,
): number | null {
  if (
    runtimeSettings.modelContextWindow !== undefined &&
    runtimeSettings.modelContextWindow !== null &&
    Number.isInteger(runtimeSettings.modelContextWindow) &&
    runtimeSettings.modelContextWindow > 0
  ) {
    return Math.floor(runtimeSettings.modelContextWindow * 0.9);
  }

  return null;
}

export function normalizeRuntimeSettings(runtimeSettings: RuntimeSettings): RuntimeSettings {
  const normalizedRuntimeSettings: RuntimeSettings = {
    ...runtimeSettings,
  };

  if (runtimeSettings.collaborationModeKind === null) {
    normalizedRuntimeSettings.collaborationModeKind = null;
  } else if (
    typeof runtimeSettings.collaborationModeKind === 'string' &&
    runtimeSettings.collaborationModeKind.trim()
  ) {
    normalizedRuntimeSettings.collaborationModeKind = normalizeCollaborationModeKind(runtimeSettings.collaborationModeKind);
  } else {
    delete normalizedRuntimeSettings.collaborationModeKind;
  }

  const normalizedPromptOverride = normalizeOptionalStringSelection(runtimeSettings.promptOverride);
  if (normalizedPromptOverride === undefined) {
    delete normalizedRuntimeSettings.promptOverride;
  } else {
    normalizedRuntimeSettings.promptOverride = normalizedPromptOverride;
  }

  if (normalizedRuntimeSettings.modelContextWindow == null) {
    delete normalizedRuntimeSettings.modelContextWindow;
  }

  const derivedModelAutoCompactTokenLimit = deriveModelAutoCompactTokenLimit(runtimeSettings);
  if (derivedModelAutoCompactTokenLimit == null) {
    delete normalizedRuntimeSettings.modelAutoCompactTokenLimit;
  } else {
    normalizedRuntimeSettings.modelAutoCompactTokenLimit = derivedModelAutoCompactTokenLimit;
  }

  return normalizedRuntimeSettings;
}

export function applySessionRuntimeMetadata(
  runtimeSettings: RuntimeSettings | null,
  { collaborationModeKind, promptOverride }: { collaborationModeKind: unknown; promptOverride?: unknown },
): RuntimeSettings | null {
  if (!runtimeSettings) {
    return null;
  }

  const nextCollaborationModeKind = readOptionalCollaborationModeKind(collaborationModeKind);
  const nextRuntimeSettings: RuntimeSettings = {
    ...runtimeSettings,
    collaborationModeKind: nextCollaborationModeKind ?? null,
  };

  if (promptOverride !== undefined) {
    nextRuntimeSettings.promptOverride = normalizeOptionalStringSelection(promptOverride) ?? null;
  }

  return normalizeRuntimeSettings(nextRuntimeSettings);
}
