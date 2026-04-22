import {
  readOptionalCollaborationModeKind,
  type CollaborationModeOption,
} from '../../../shared/lib/collaboration-mode';
import type { RuntimeModelOption, RuntimeOption, RuntimeOptions, RuntimeSettings } from '../runtime-settings-types';
import { assignOptionalRuntimeNumber, hasOwnKey, isRecord } from './runtime-settings-helpers';
import { normalizeOptionalStringSelection, normalizeRuntimeSettings } from './runtime-settings-normalize';

function readOption(value: unknown): RuntimeOption | null {
  if (!isRecord(value)) return null;
  if (typeof value.value !== 'string' || !value.value) return null;

  return {
    value: value.value,
    label: typeof value.label === 'string' && value.label ? value.label : value.value,
    description: typeof value.description === 'string' ? value.description : '',
    ...(value.unavailable === true ? { unavailable: true } : {}),
  };
}

function readModelOption(value: unknown): RuntimeModelOption | null {
  const option = readOption(value);
  if (!option || !isRecord(value)) return null;

  return {
    ...option,
    reasoningEfforts: Array.isArray(value.reasoningEfforts)
      ? value.reasoningEfforts.map(readOption).filter((entry): entry is RuntimeOption => Boolean(entry))
      : [],
    defaultReasoningEffort:
      typeof value.defaultReasoningEffort === 'string' && value.defaultReasoningEffort ? value.defaultReasoningEffort : null,
  };
}

function readCollaborationModeOption(value: unknown): CollaborationModeOption | null {
  if (!isRecord(value)) return null;

  const kind = readOptionalCollaborationModeKind(value.kind);
  if (!kind) {
    return null;
  }
  const label = typeof value.label === 'string' && value.label ? value.label : kind;

  return {
    kind,
    label,
    model: typeof value.model === 'string' && value.model ? value.model : null,
    reasoningEffort:
      Object.prototype.hasOwnProperty.call(value, 'reasoningEffort') &&
      !(typeof value.reasoningEffort === 'string' && value.reasoningEffort)
        ? null
        : typeof value.reasoningEffort === 'string' && value.reasoningEffort
          ? value.reasoningEffort
          : undefined,
  };
}

export function readRuntimeSettings(value: unknown): RuntimeSettings | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.model !== 'string' ||
    !value.model ||
    typeof value.approvalPolicy !== 'string' ||
    !value.approvalPolicy ||
    typeof value.sandboxMode !== 'string' ||
    !value.sandboxMode
  ) {
    return null;
  }

  const runtimeSettings: RuntimeSettings = {
    model: value.model,
    reasoningEffort:
      typeof value.reasoningEffort === 'string' && value.reasoningEffort ? value.reasoningEffort : null,
    approvalPolicy: value.approvalPolicy,
    sandboxMode: value.sandboxMode,
  };

  if (hasOwnKey(value, 'collaborationModeKind')) {
    runtimeSettings.collaborationModeKind = readOptionalCollaborationModeKind(value.collaborationModeKind) ?? null;
  }

  if (hasOwnKey(value, 'promptOverride')) {
    runtimeSettings.promptOverride = normalizeOptionalStringSelection(value.promptOverride) ?? null;
  }

  if (typeof value.reasoningSummary === 'string' && value.reasoningSummary) {
    runtimeSettings.reasoningSummary = value.reasoningSummary;
  } else if (value.reasoningSummary === null) {
    runtimeSettings.reasoningSummary = null;
  }

  assignOptionalRuntimeNumber({
    target: runtimeSettings,
    source: value,
    key: 'modelContextWindow',
  });
  assignOptionalRuntimeNumber({
    target: runtimeSettings,
    source: value,
    key: 'modelAutoCompactTokenLimit',
  });

  return normalizeRuntimeSettings(runtimeSettings);
}

export function readRuntimeOptions(value: unknown): RuntimeOptions | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.models) || !Array.isArray(value.approvalPolicies) || !Array.isArray(value.sandboxModes)) {
    return null;
  }

  return {
    models: value.models.map(readModelOption).filter((entry): entry is RuntimeModelOption => Boolean(entry)),
    reasoningSummaryOptions: Array.isArray(value.reasoningSummaryOptions)
      ? value.reasoningSummaryOptions.map(readOption).filter((entry): entry is RuntimeOption => Boolean(entry))
      : [],
    approvalPolicies: value.approvalPolicies.map(readOption).filter((entry): entry is RuntimeOption => Boolean(entry)),
    sandboxModes: value.sandboxModes.map(readOption).filter((entry): entry is RuntimeOption => Boolean(entry)),
    collaborationModes: Array.isArray(value.collaborationModes)
      ? value.collaborationModes
          .map(readCollaborationModeOption)
          .filter((entry): entry is CollaborationModeOption => Boolean(entry))
      : [],
    promptOverrides: Array.isArray(value.promptOverrides)
      ? value.promptOverrides.map(readOption).filter((entry): entry is RuntimeOption => Boolean(entry))
      : [],
  };
}

export function mergeRuntimeSettings({
  defaults,
  stored,
}: {
  defaults: RuntimeSettings | null;
  stored: Partial<RuntimeSettings> | null;
}): RuntimeSettings | null {
  if (!defaults && !stored) {
    return null;
  }

  const fallback = defaults ?? {
    model: '',
    reasoningEffort: null,
    approvalPolicy: '',
    sandboxMode: '',
    collaborationModeKind: null,
  };

  const next = {
    ...fallback,
    ...(stored ?? {}),
  };

  if (!next.model || !next.approvalPolicy || !next.sandboxMode) {
    return null;
  }

  const runtimeSettings: RuntimeSettings = {
    model: next.model,
    reasoningEffort: next.reasoningEffort || null,
    approvalPolicy: next.approvalPolicy,
    sandboxMode: next.sandboxMode,
  };

  if (isRecord(next) && hasOwnKey(next, 'collaborationModeKind')) {
    runtimeSettings.collaborationModeKind = readOptionalCollaborationModeKind(next.collaborationModeKind) ?? null;
  }

  if (isRecord(next) && hasOwnKey(next, 'reasoningSummary')) {
    runtimeSettings.reasoningSummary =
      typeof next.reasoningSummary === 'string' && next.reasoningSummary ? next.reasoningSummary : null;
  }

  if (isRecord(next) && hasOwnKey(next, 'promptOverride')) {
    runtimeSettings.promptOverride = normalizeOptionalStringSelection(next.promptOverride) ?? null;
  }

  if (isRecord(next)) {
    assignOptionalRuntimeNumber({
      target: runtimeSettings,
      source: next,
      key: 'modelContextWindow',
    });
    assignOptionalRuntimeNumber({
      target: runtimeSettings,
      source: next,
      key: 'modelAutoCompactTokenLimit',
    });
  }

  return normalizeRuntimeSettings(runtimeSettings);
}
