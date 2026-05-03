import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeSandboxMode } from '../../../../ports/index.js';
import { CodexProtocolError } from '../../errors/codex-runtime-error.js';

export function encodeSandboxPolicy(sandboxMode: RuntimeSandboxMode | null): JsonValue | undefined {
  switch (sandboxMode) {
    case null:
      return undefined;
    case 'read-only':
      return { type: 'readOnly' };
    case 'workspace-write':
      return { type: 'workspaceWrite' };
    case 'danger-full-access':
      return { type: 'dangerFullAccess' };
  }

  throw new CodexProtocolError(`Unsupported runtime sandbox mode: ${String(sandboxMode)}`);
}

