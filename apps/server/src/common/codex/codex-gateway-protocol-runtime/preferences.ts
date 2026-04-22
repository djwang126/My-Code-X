import { hasOwnKey, readRuntimeNumber } from './shared.js';
import type { LooseRecord, RuntimePreferences } from '../codex-types.js';

export function createDefaultRuntimePreferences(): RuntimePreferences {
  return {
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    reasoningSummary: null,
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
  };
}

export function mapCodexConfigToRuntimePreferences(configReadResponse: LooseRecord | null | undefined) {
  if (!configReadResponse || typeof configReadResponse !== 'object') {
    return null;
  }

  const config = configReadResponse?.config ?? configReadResponse ?? {};
  const fallback = createDefaultRuntimePreferences();

  const runtimePreferences: RuntimePreferences = {
    model: typeof config.model === 'string' && config.model ? config.model : fallback.model,
    reasoningEffort:
      typeof config.modelReasoningEffort === 'string' && config.modelReasoningEffort
        ? config.modelReasoningEffort
        : typeof config.model_reasoning_effort === 'string' && config.model_reasoning_effort
          ? config.model_reasoning_effort
          : fallback.reasoningEffort,
    reasoningSummary:
      typeof config.modelReasoningSummary === 'string' && config.modelReasoningSummary
        ? config.modelReasoningSummary
        : typeof config.model_reasoning_summary === 'string' && config.model_reasoning_summary
          ? config.model_reasoning_summary
          : fallback.reasoningSummary,
    approvalPolicy:
      typeof config.approvalPolicy === 'string' && config.approvalPolicy
        ? config.approvalPolicy
        : typeof config.approval_policy === 'string' && config.approval_policy
          ? config.approval_policy
          : fallback.approvalPolicy,
    sandboxMode:
      typeof config.sandboxMode === 'string' && config.sandboxMode
        ? config.sandboxMode
        : typeof config.sandbox_mode === 'string' && config.sandbox_mode
          ? config.sandbox_mode
          : fallback.sandboxMode,
  };

  const modelContextWindow = readRuntimeNumber(
    hasOwnKey(config, 'model_context_window') ? config.model_context_window : config.modelContextWindow,
  );
  const modelAutoCompactTokenLimit = readRuntimeNumber(
    hasOwnKey(config, 'model_auto_compact_token_limit')
      ? config.model_auto_compact_token_limit
      : config.modelAutoCompactTokenLimit,
  );

  if (modelContextWindow !== undefined && modelContextWindow !== null) {
    runtimePreferences.modelContextWindow = modelContextWindow;
  }

  if (modelAutoCompactTokenLimit !== undefined && modelAutoCompactTokenLimit !== null) {
    runtimePreferences.modelAutoCompactTokenLimit = modelAutoCompactTokenLimit;
  }

  return runtimePreferences;
}
