import type { RespondToRuntimeHostRequestCommand, RuntimeCommand } from '../../../../ports/index.js';
import type { CodexRequest } from '../../protocol/codex-request.js';
import { encodeBaseThreadCommand } from './base-thread-command.js';
import { encodeThreadCommand } from './thread-command.js';
import { encodeTurnCommand } from './turn-command.js';
import { assertNever } from '../../../../shared/index.js';
import type { EncodeRuntimeCommandInput } from './encode-runtime-command-input.js';

type CodexRequestRuntimeCommand = Exclude<RuntimeCommand, RespondToRuntimeHostRequestCommand>;

export type { EncodeRuntimeCommandInput } from './encode-runtime-command-input.js';

export function encodeRuntimeCommandToCodexRequest(command: CodexRequestRuntimeCommand, input: EncodeRuntimeCommandInput): CodexRequest {
  switch (command.kind) {
    case 'start-thread':
    case 'resume-thread':
    case 'fork-thread':
      return encodeBaseThreadCommand(command, input);

    case 'archive-thread':
    case 'unarchive-thread':
    case 'unsubscribe-thread':
    case 'increment-thread-elicitation':
    case 'decrement-thread-elicitation':
    case 'set-thread-name':
    case 'update-thread-metadata':
    case 'set-thread-memory-mode':
    case 'compact-thread':
    case 'run-thread-shell-command':
    case 'approve-thread-guardian-denied-action':
    case 'clean-thread-background-terminals':
    case 'inject-thread-items':
    case 'read-thread':
    case 'list-threads':
    case 'list-loaded-threads':
    case 'list-thread-turns':
    case 'rollback-thread':
      return encodeThreadCommand(command);

    case 'start-turn':
    case 'steer-turn':
    case 'start-review':
    case 'interrupt-turn':
      return encodeTurnCommand(command);
  }

  return assertNever(command, 'Unsupported runtime command');
}
