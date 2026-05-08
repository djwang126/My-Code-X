import { type CollaborationModeOption, normalizeCollaborationModeKind } from '../../../../shared/lib/collaboration-mode';
import type { RuntimeModelOption, RuntimeOption, RuntimeOptions, RuntimeSettings } from '../settings-types';

export function getUnavailableRuntimeOption(value: string): RuntimeOption {
  return {
    value,
    label: `Unavailable: ${value}`,
    description: 'Previously selected option is no longer available.',
    unavailable: true,
  };
}

export function getUnavailableCollaborationModeOption(kind: string): CollaborationModeOption {
  const normalizedKind = normalizeCollaborationModeKind(kind);
  return {
    kind: normalizedKind,
    label: `Unavailable: ${normalizedKind}`,
    model: null,
  };
}

export function withSelectedOption(options: RuntimeOption[], selectedValue: string | null): RuntimeOption[] {
  if (!selectedValue) {
    return options;
  }

  if (options.some(option => option.value === selectedValue)) {
    return options;
  }

  return [getUnavailableRuntimeOption(selectedValue), ...options];
}

export function withSelectedCollaborationModeOption(
  options: CollaborationModeOption[],
  selectedKind: string,
): CollaborationModeOption[] {
  const normalizedKind = normalizeCollaborationModeKind(selectedKind);

  if (options.some(option => option.kind === normalizedKind)) {
    return options;
  }

  return [getUnavailableCollaborationModeOption(normalizedKind), ...options];
}

export function findSelectedModelOption(runtimeOptions: RuntimeOptions, modelValue: string): RuntimeModelOption | null {
  const match = runtimeOptions.models.find(option => option.value === modelValue);
  return match ?? null;
}

export function getReasoningEffortOptions(
  runtimeOptions: RuntimeOptions,
  runtimeSettings: RuntimeSettings,
): RuntimeOption[] {
  const selectedModel = findSelectedModelOption(runtimeOptions, runtimeSettings.model);
  return withSelectedOption(selectedModel?.reasoningEfforts ?? [], runtimeSettings.reasoningEffort);
}

export function getReasoningSummaryOptions(
  runtimeOptions: RuntimeOptions,
  runtimeSettings: RuntimeSettings,
): RuntimeOption[] {
  return withSelectedOption(runtimeOptions.reasoningSummaryOptions, runtimeSettings.reasoningSummary ?? null);
}

export function getCollaborationModeOptions(
  runtimeOptions: RuntimeOptions,
  runtimeSettings: RuntimeSettings,
): CollaborationModeOption[] {
  return runtimeSettings.collaborationModeKind
    ? withSelectedCollaborationModeOption(runtimeOptions.collaborationModes, runtimeSettings.collaborationModeKind)
    : runtimeOptions.collaborationModes;
}

export function getPromptOverrideOptions(
  runtimeOptions: RuntimeOptions,
  runtimeSettings: RuntimeSettings,
): RuntimeOption[] {
  return withSelectedOption(runtimeOptions.promptOverrides, runtimeSettings.promptOverride ?? null);
}
