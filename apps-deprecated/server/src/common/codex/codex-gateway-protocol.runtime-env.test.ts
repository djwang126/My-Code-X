import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeRuntimePreferencesWithEnvDefaults,
  readRuntimePreferencesEnvDefaults,
} from './codex-gateway-protocol.js';

test('readRuntimePreferencesEnvDefaults returns null when runtime env defaults are unset', () => {
  assert.equal(readRuntimePreferencesEnvDefaults({ env: {} }), null);
});

test('readRuntimePreferencesEnvDefaults reads configured runtime env defaults', () => {
  assert.deepEqual(
    readRuntimePreferencesEnvDefaults({
      env: {
        MY_CODE_X_RUNTIME_DEFAULT_MODEL: 'gpt-5.2',
        MY_CODE_X_RUNTIME_DEFAULT_REASONING_EFFORT: 'high',
        MY_CODE_X_RUNTIME_DEFAULT_REASONING_SUMMARY: 'detailed',
        MY_CODE_X_RUNTIME_DEFAULT_APPROVAL_POLICY: 'on-request',
        MY_CODE_X_RUNTIME_DEFAULT_SANDBOX_MODE: 'workspace-write',
        MY_CODE_X_RUNTIME_DEFAULT_MODEL_CONTEXT_WINDOW: '200000',
        MY_CODE_X_RUNTIME_DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT: '150000',
      },
    }),
    {
      model: 'gpt-5.2',
      reasoningEffort: 'high',
      reasoningSummary: 'detailed',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      modelContextWindow: 200000,
      modelAutoCompactTokenLimit: 150000,
    },
  );
});

test('readRuntimePreferencesEnvDefaults rejects invalid numeric overrides', () => {
  assert.throws(
    () =>
      readRuntimePreferencesEnvDefaults({
        env: {
          MY_CODE_X_RUNTIME_DEFAULT_MODEL_CONTEXT_WINDOW: 'not-a-number',
        },
      }),
    /MY_CODE_X_RUNTIME_DEFAULT_MODEL_CONTEXT_WINDOW must be a positive integer/,
  );
});

test('mergeRuntimePreferencesWithEnvDefaults overlays env defaults on Codex config preferences', () => {
  assert.deepEqual(
    mergeRuntimePreferencesWithEnvDefaults({
      runtimePreferences: {
        model: 'gpt-5.4',
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
      },
      env: {
        MY_CODE_X_RUNTIME_DEFAULT_REASONING_EFFORT: 'high',
        MY_CODE_X_RUNTIME_DEFAULT_APPROVAL_POLICY: 'on-request',
      },
    }),
    {
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
      approvalPolicy: 'on-request',
      sandboxMode: 'danger-full-access',
    },
  );
});

test('mergeRuntimePreferencesWithEnvDefaults seeds built-in defaults when only env defaults exist', () => {
  assert.deepEqual(
    mergeRuntimePreferencesWithEnvDefaults({
      runtimePreferences: null,
      env: {
        MY_CODE_X_RUNTIME_DEFAULT_MODEL: 'gpt-5.2',
      },
    }),
    {
      model: 'gpt-5.2',
      reasoningEffort: 'medium',
      reasoningSummary: null,
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    },
  );
});
