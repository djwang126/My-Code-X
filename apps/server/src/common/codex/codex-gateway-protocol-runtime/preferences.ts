import { hasOwnKey, readRuntimeNumber } from './shared.js';
import type { LooseRecord, RuntimePreferences } from '../codex-types.js';

type ProcessEnv = typeof process.env;

const ENV_KEYS = {
  model: 'MY_CODE_X_RUNTIME_DEFAULT_MODEL',
  reasoningEffort: 'MY_CODE_X_RUNTIME_DEFAULT_REASONING_EFFORT',
  reasoningSummary: 'MY_CODE_X_RUNTIME_DEFAULT_REASONING_SUMMARY',
  approvalPolicy: 'MY_CODE_X_RUNTIME_DEFAULT_APPROVAL_POLICY',
  sandboxMode: 'MY_CODE_X_RUNTIME_DEFAULT_SANDBOX_MODE',
  modelContextWindow: 'MY_CODE_X_RUNTIME_DEFAULT_MODEL_CONTEXT_WINDOW',
  modelAutoCompactTokenLimit: 'MY_CODE_X_RUNTIME_DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT',
} as const;

interface ReadRuntimePreferencesEnvDefaultsInput {
  env?: ProcessEnv;
}

interface MergeRuntimePreferencesWithEnvDefaultsInput {
  runtimePreferences: RuntimePreferences | null;
  env?: ProcessEnv;
}

export function createDefaultRuntimePreferences(): RuntimePreferences {
  return {
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    reasoningSummary: null,
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
  };
}

function readOptionalEnvString(env: ProcessEnv, key: string): string | undefined {
  const value = String(env[key] || '').trim();
  return value || undefined;
}

function readOptionalPositiveIntegerFromEnv(env: ProcessEnv, key: string): number | undefined {
  const rawValue = String(env[key] || '').trim();
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsedValue;
}

export function readRuntimePreferencesEnvDefaults({
  env = process.env,
}: ReadRuntimePreferencesEnvDefaultsInput = {}): Partial<RuntimePreferences> | null {
  const runtimePreferences: Partial<RuntimePreferences> = {};

  const model = readOptionalEnvString(env, ENV_KEYS.model);
  if (model) {
    runtimePreferences.model = model;
  }

  const reasoningEffort = readOptionalEnvString(env, ENV_KEYS.reasoningEffort);
  if (reasoningEffort) {
    runtimePreferences.reasoningEffort = reasoningEffort;
  }

  const reasoningSummary = readOptionalEnvString(env, ENV_KEYS.reasoningSummary);
  if (reasoningSummary) {
    runtimePreferences.reasoningSummary = reasoningSummary;
  }

  const approvalPolicy = readOptionalEnvString(env, ENV_KEYS.approvalPolicy);
  if (approvalPolicy) {
    runtimePreferences.approvalPolicy = approvalPolicy;
  }

  const sandboxMode = readOptionalEnvString(env, ENV_KEYS.sandboxMode);
  if (sandboxMode) {
    runtimePreferences.sandboxMode = sandboxMode;
  }

  const modelContextWindow = readOptionalPositiveIntegerFromEnv(env, ENV_KEYS.modelContextWindow);
  if (modelContextWindow !== undefined) {
    runtimePreferences.modelContextWindow = modelContextWindow;
  }

  const modelAutoCompactTokenLimit = readOptionalPositiveIntegerFromEnv(env, ENV_KEYS.modelAutoCompactTokenLimit);
  if (modelAutoCompactTokenLimit !== undefined) {
    runtimePreferences.modelAutoCompactTokenLimit = modelAutoCompactTokenLimit;
  }

  return Object.keys(runtimePreferences).length ? runtimePreferences : null;
}

export function mergeRuntimePreferencesWithEnvDefaults({
  runtimePreferences,
  env = process.env,
}: MergeRuntimePreferencesWithEnvDefaultsInput): RuntimePreferences | null {
  const envDefaults = readRuntimePreferencesEnvDefaults({ env });
  if (!runtimePreferences && !envDefaults) {
    return null;
  }

  return {
    ...(runtimePreferences ?? createDefaultRuntimePreferences()),
    ...(envDefaults ?? {}),
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
