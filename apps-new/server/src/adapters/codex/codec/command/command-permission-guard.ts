import type { JsonValue } from '@my-code-x/contracts-new/json';
import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import type { RuntimeSettings } from '../../../../ports/index.js';

export interface RuntimeThreadPermissionInput {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly permissionProfile?: JsonValue;
}

export interface RuntimeTurnPermissionInput {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly sandboxPolicy?: JsonValue;
  readonly permissionProfile?: JsonValue;
}

export function assertNoThreadPermissionConflict(input: RuntimeThreadPermissionInput): void {
  if (input.permissionProfile !== undefined && input.permissionProfile !== null && input.runtimeSettings?.sandboxMode) {
    throw new CodexProtocolError('Codex thread request cannot combine permissionProfile with sandbox');
  }
}

export function assertNoTurnPermissionConflict(input: RuntimeTurnPermissionInput): void {
  const hasRuntimeSandboxMode = input.runtimeSettings?.sandboxMode !== undefined && input.runtimeSettings.sandboxMode !== null;
  const hasSandboxPolicy = (input.sandboxPolicy !== undefined && input.sandboxPolicy !== null) || hasRuntimeSandboxMode;

  if (input.permissionProfile !== undefined && input.permissionProfile !== null && hasSandboxPolicy) {
    throw new CodexProtocolError('Codex turn request cannot combine permissionProfile with sandboxPolicy');
  }
}
