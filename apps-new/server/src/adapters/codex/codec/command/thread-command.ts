import type {
  ArchiveRuntimeThreadCommand,
  ApproveRuntimeThreadGuardianDeniedActionCommand,
  CleanRuntimeThreadBackgroundTerminalsCommand,
  CompactRuntimeThreadCommand,
  DecrementRuntimeThreadElicitationCommand,
  IncrementRuntimeThreadElicitationCommand,
  InjectRuntimeThreadItemsCommand,
  ListLoadedRuntimeThreadsCommand,
  ListRuntimeThreadsCommand,
  ListRuntimeThreadTurnsCommand,
  ReadRuntimeThreadCommand,
  RollbackRuntimeThreadCommand,
  RunRuntimeThreadShellCommandCommand,
  SetRuntimeThreadMemoryModeCommand,
  SetRuntimeThreadNameCommand,
  UnarchiveRuntimeThreadCommand,
  UnsubscribeRuntimeThreadCommand,
  UpdateRuntimeThreadMetadataCommand,
} from '../../../../ports/index.js';
import type { CodexRequest } from '../../protocol/codex-request.js';
import { cleanJsonObject, nullToUndefined } from './clean-json-object.js';
import { encodeThreadIdRequest } from './thread-id-request.js';
import { assertNever } from '../../../../shared/index.js';

export type RuntimeThreadCommand =
  | ArchiveRuntimeThreadCommand
  | UnarchiveRuntimeThreadCommand
  | UnsubscribeRuntimeThreadCommand
  | IncrementRuntimeThreadElicitationCommand
  | DecrementRuntimeThreadElicitationCommand
  | SetRuntimeThreadNameCommand
  | UpdateRuntimeThreadMetadataCommand
  | SetRuntimeThreadMemoryModeCommand
  | CompactRuntimeThreadCommand
  | RunRuntimeThreadShellCommandCommand
  | ApproveRuntimeThreadGuardianDeniedActionCommand
  | CleanRuntimeThreadBackgroundTerminalsCommand
  | InjectRuntimeThreadItemsCommand
  | ReadRuntimeThreadCommand
  | ListRuntimeThreadsCommand
  | ListLoadedRuntimeThreadsCommand
  | ListRuntimeThreadTurnsCommand
  | RollbackRuntimeThreadCommand;

export function encodeThreadCommand(command: RuntimeThreadCommand): CodexRequest {
  switch (command.kind) {
    case 'archive-thread':
      return encodeThreadIdRequest({ method: 'thread/archive', threadId: command.threadId });

    case 'unarchive-thread':
      return encodeThreadIdRequest({ method: 'thread/unarchive', threadId: command.threadId });

    case 'unsubscribe-thread':
      return encodeThreadIdRequest({ method: 'thread/unsubscribe', threadId: command.threadId });

    case 'increment-thread-elicitation':
      return encodeThreadIdRequest({ method: 'thread/increment_elicitation', threadId: command.threadId });

    case 'decrement-thread-elicitation':
      return encodeThreadIdRequest({ method: 'thread/decrement_elicitation', threadId: command.threadId });

    case 'set-thread-name':
      return {
        method: 'thread/name/set',
        params: cleanJsonObject({
          threadId: command.threadId,
          name: command.name,
        }),
      };

    case 'update-thread-metadata':
      return {
        method: 'thread/metadata/update',
        params: cleanJsonObject({
          threadId: command.threadId,
          gitInfo: command.gitInfo,
        }),
      };

    case 'set-thread-memory-mode':
      return {
        method: 'thread/memoryMode/set',
        params: cleanJsonObject({
          threadId: command.threadId,
          mode: command.mode,
        }),
      };

    case 'compact-thread':
      return encodeThreadIdRequest({ method: 'thread/compact/start', threadId: command.threadId });

    case 'run-thread-shell-command':
      return {
        method: 'thread/shellCommand',
        params: cleanJsonObject({
          threadId: command.threadId,
          command: command.command,
        }),
      };

    case 'approve-thread-guardian-denied-action':
      return {
        method: 'thread/approveGuardianDeniedAction',
        params: cleanJsonObject({
          threadId: command.threadId,
          event: command.event,
        }),
      };

    case 'clean-thread-background-terminals':
      return encodeThreadIdRequest({ method: 'thread/backgroundTerminals/clean', threadId: command.threadId });

    case 'inject-thread-items':
      return {
        method: 'thread/inject_items',
        params: cleanJsonObject({
          threadId: command.threadId,
          items: [...command.items],
        }),
      };

    case 'read-thread':
      return {
        method: 'thread/read',
        params: cleanJsonObject({
          threadId: command.threadId,
          includeTurns: command.includeTurns,
        }),
      };

    case 'list-threads':
      return {
        method: 'thread/list',
        params: cleanJsonObject({
          cursor: nullToUndefined(command.cursor),
          cwd: command.workspace,
          limit: command.limit,
          sortKey: nullToUndefined(command.sortKey),
          sortDirection: nullToUndefined(command.sortDirection),
          modelProviders: nullToUndefined(command.modelProviders),
          sourceKinds: nullToUndefined(command.sourceKinds),
          archived: command.archived,
          useStateDbOnly: nullToUndefined(command.useStateDbOnly),
          searchTerm: nullToUndefined(command.searchTerm),
        }),
      };

    case 'list-loaded-threads':
      return {
        method: 'thread/loaded/list',
        params: cleanJsonObject({
          cursor: nullToUndefined(command.cursor),
          limit: nullToUndefined(command.limit),
        }),
      };

    case 'list-thread-turns':
      return {
        method: 'thread/turns/list',
        params: cleanJsonObject({
          threadId: command.threadId,
          cursor: nullToUndefined(command.cursor),
          limit: nullToUndefined(command.limit),
          sortDirection: nullToUndefined(command.sortDirection),
        }),
      };

    case 'rollback-thread':
      return {
        method: 'thread/rollback',
        params: cleanJsonObject({
          threadId: command.threadId,
          numTurns: command.numTurns,
        }),
      };
  }

  return assertNever(command, 'Unsupported runtime thread command');
}

