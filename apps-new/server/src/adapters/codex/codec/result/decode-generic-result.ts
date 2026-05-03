import type { RuntimeResult } from '../../../../ports/index.js';
import type { DecodeCodexResultInput } from './codex-result-input.js';

export function decodeGenericResult(input: DecodeCodexResultInput): RuntimeResult | null {
  switch (input.command.kind) {
    case 'archive-thread':
    case 'set-thread-name':
    case 'set-thread-memory-mode':
    case 'compact-thread':
    case 'run-thread-shell-command':
    case 'approve-thread-guardian-denied-action':
    case 'clean-thread-background-terminals':
    case 'inject-thread-items':
      return {
        kind: 'ok',
      };

    case 'respond-to-runtime-host-request':
      return {
        kind: 'runtime-host-request-responded',
        requestId: input.command.requestId,
      };

    default:
      return null;
  }
}
