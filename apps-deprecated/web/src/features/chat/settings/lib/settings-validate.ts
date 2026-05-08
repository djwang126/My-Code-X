import type { RuntimeOptions, RuntimeSettings } from '../settings-types';
import {
  getCollaborationModeOptions,
  getPromptOverrideOptions,
  getReasoningEffortOptions,
  getReasoningSummaryOptions,
} from './settings-options';

export function validateRuntimeSettings(
  runtimeSettings: RuntimeSettings | null,
  runtimeOptions: RuntimeOptions | null,
): string | null {
  if (!runtimeSettings || !runtimeOptions) {
    return null;
  }

  if (!runtimeOptions.models.some(option => option.value === runtimeSettings.model)) {
    return `Selected model is unavailable: ${runtimeSettings.model}`;
  }

  if (!runtimeOptions.approvalPolicies.some(option => option.value === runtimeSettings.approvalPolicy)) {
    return `Selected approval policy is unavailable: ${runtimeSettings.approvalPolicy}`;
  }

  if (!runtimeOptions.sandboxModes.some(option => option.value === runtimeSettings.sandboxMode)) {
    return `Selected sandbox mode is unavailable: ${runtimeSettings.sandboxMode}`;
  }

  if (runtimeSettings.reasoningEffort) {
    const reasoningOptions = getReasoningEffortOptions(runtimeOptions, runtimeSettings);
    if (!reasoningOptions.some(option => option.value === runtimeSettings.reasoningEffort && !option.unavailable)) {
      return `Selected reasoning effort is unavailable: ${runtimeSettings.reasoningEffort}`;
    }
  }

  if (runtimeSettings.reasoningSummary && runtimeOptions.reasoningSummaryOptions.length > 0) {
    const reasoningSummaryOptions = getReasoningSummaryOptions(runtimeOptions, runtimeSettings);
    if (
      !reasoningSummaryOptions.some(
        option => option.value === runtimeSettings.reasoningSummary && !option.unavailable,
      )
    ) {
      return `Selected reasoning summary is unavailable: ${runtimeSettings.reasoningSummary}`;
    }
  }

  if (runtimeSettings.promptOverride && runtimeOptions.promptOverrides.length > 0) {
    const promptOverrideOptions = getPromptOverrideOptions(runtimeOptions, runtimeSettings);
    if (!promptOverrideOptions.some(option => option.value === runtimeSettings.promptOverride && !option.unavailable)) {
      return `Selected prompt override is unavailable: ${runtimeSettings.promptOverride}`;
    }
  }

  if (
    runtimeSettings.modelContextWindow !== undefined &&
    runtimeSettings.modelContextWindow !== null &&
    (!Number.isInteger(runtimeSettings.modelContextWindow) || runtimeSettings.modelContextWindow <= 0)
  ) {
    return 'Model context window must be a positive integer.';
  }

  if (
    runtimeSettings.modelAutoCompactTokenLimit !== undefined &&
    runtimeSettings.modelAutoCompactTokenLimit !== null &&
    (!Number.isInteger(runtimeSettings.modelAutoCompactTokenLimit) ||
      runtimeSettings.modelAutoCompactTokenLimit <= 0)
  ) {
    return 'Auto-compact token limit must be a positive integer.';
  }

  if (
    runtimeSettings.collaborationModeKind &&
    !getCollaborationModeOptions(runtimeOptions, runtimeSettings).some(option => option.kind === runtimeSettings.collaborationModeKind)
  ) {
    return `Selected collaboration mode is unavailable: ${runtimeSettings.collaborationModeKind}`;
  }

  return null;
}
