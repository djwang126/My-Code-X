import type { JsonObject } from '@my-code-x/contracts-new/json';
import type { RuntimeSettings } from '../../../../ports/index.js';
import { cleanJsonObject, nullToUndefined } from './clean-json-object.js';

export function encodeRuntimeSettingsToThreadParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: nullToUndefined(settings.model),
    approvalPolicy: nullToUndefined(settings.approvalPolicy),
    sandbox: nullToUndefined(settings.sandboxMode),
  });
}

export function encodeRuntimeSettingsToTurnParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: nullToUndefined(settings.model),
    effort: nullToUndefined(settings.reasoningEffort),
    approvalPolicy: nullToUndefined(settings.approvalPolicy),
  });
}

export function mergeThreadConfig(settings: RuntimeSettings | null, config: JsonObject | null | undefined): JsonObject | undefined {
  const runtimeConfig = cleanJsonObject({
    model_reasoning_effort: nullToUndefined(settings?.reasoningEffort ?? null),
    prompt_override: nullToUndefined(settings?.promptOverride ?? null),
  });
  const merged = cleanJsonObject({
    ...config,
    ...runtimeConfig,
  });

  return Object.keys(merged).length ? merged : undefined;
}
