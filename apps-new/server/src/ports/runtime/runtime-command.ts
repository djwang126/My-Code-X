import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeContentItem } from './runtime-content.js';
import type { RuntimeSettings } from './runtime-settings.js';

export type RuntimeCommand =
  | StartRuntimeThreadCommand
  | ResumeRuntimeThreadCommand
  | ForkRuntimeThreadCommand
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
  | RollbackRuntimeThreadCommand
  | StartRuntimeTurnCommand
  | SteerRuntimeTurnCommand
  | StartRuntimeReviewCommand
  | InterruptRuntimeTurnCommand
  | RespondToRuntimeHostRequestCommand;

export interface RuntimeThreadConfigCommandBase {
  readonly workspace: string | null;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
  readonly developerInstructions?: string | null;
  readonly modelProvider?: string | null;
  readonly serviceTier?: JsonValue;
  readonly approvalsReviewer?: JsonValue;
  readonly permissionProfile?: JsonValue;
  readonly personality?: JsonValue;
  readonly config?: JsonObject | null;
}

export interface StartRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'start-thread';
  readonly workspace: string;
  readonly serviceName?: string | null;
  readonly ephemeral?: boolean | null;
  readonly sessionStartSource?: JsonValue;
  readonly experimentalRawEvents?: boolean | null;
}

export interface ResumeRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'resume-thread';
  readonly threadId: string;
  readonly workspace: string;
  readonly history?: readonly JsonValue[] | null;
  readonly path?: string | null;
}

export interface ForkRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'fork-thread';
  readonly threadId: string;
  readonly workspace: string | null;
  readonly path?: string | null;
  readonly ephemeral?: boolean | null;
}

export interface ArchiveRuntimeThreadCommand {
  readonly kind: 'archive-thread';
  readonly threadId: string;
}

export interface UnarchiveRuntimeThreadCommand {
  readonly kind: 'unarchive-thread';
  readonly threadId: string;
}

export interface UnsubscribeRuntimeThreadCommand {
  readonly kind: 'unsubscribe-thread';
  readonly threadId: string;
}

export interface IncrementRuntimeThreadElicitationCommand {
  readonly kind: 'increment-thread-elicitation';
  readonly threadId: string;
}

export interface DecrementRuntimeThreadElicitationCommand {
  readonly kind: 'decrement-thread-elicitation';
  readonly threadId: string;
}

export interface SetRuntimeThreadNameCommand {
  readonly kind: 'set-thread-name';
  readonly threadId: string;
  readonly name: string;
}

export interface UpdateRuntimeThreadMetadataCommand {
  readonly kind: 'update-thread-metadata';
  readonly threadId: string;
  readonly gitInfo?: JsonValue;
}

export type RuntimeThreadMemoryMode = 'enabled' | 'disabled';

export interface SetRuntimeThreadMemoryModeCommand {
  readonly kind: 'set-thread-memory-mode';
  readonly threadId: string;
  readonly mode: RuntimeThreadMemoryMode;
}

export interface CompactRuntimeThreadCommand {
  readonly kind: 'compact-thread';
  readonly threadId: string;
}

export interface RunRuntimeThreadShellCommandCommand {
  readonly kind: 'run-thread-shell-command';
  readonly threadId: string;
  readonly command: string;
}

export interface ApproveRuntimeThreadGuardianDeniedActionCommand {
  readonly kind: 'approve-thread-guardian-denied-action';
  readonly threadId: string;
  readonly event: JsonValue;
}

export interface CleanRuntimeThreadBackgroundTerminalsCommand {
  readonly kind: 'clean-thread-background-terminals';
  readonly threadId: string;
}

export interface InjectRuntimeThreadItemsCommand {
  readonly kind: 'inject-thread-items';
  readonly threadId: string;
  readonly items: readonly JsonValue[];
}

export interface ReadRuntimeThreadCommand {
  readonly kind: 'read-thread';
  readonly threadId: string;
  readonly includeTurns: boolean;
}

export interface ListRuntimeThreadsCommand {
  readonly kind: 'list-threads';
  readonly workspace: string;
  readonly limit: number;
  readonly archived: boolean;
  readonly cursor?: string | null;
  readonly sortKey?: 'created_at' | 'updated_at' | null;
  readonly sortDirection?: 'asc' | 'desc' | null;
  readonly modelProviders?: readonly string[] | null;
  readonly sourceKinds?: readonly string[] | null;
  readonly useStateDbOnly?: boolean | null;
  readonly searchTerm?: string | null;
}

export interface ListLoadedRuntimeThreadsCommand {
  readonly kind: 'list-loaded-threads';
  readonly cursor?: string | null;
  readonly limit?: number | null;
}

export interface ListRuntimeThreadTurnsCommand {
  readonly kind: 'list-thread-turns';
  readonly threadId: string;
  readonly cursor?: string | null;
  readonly limit?: number | null;
  readonly sortDirection?: 'asc' | 'desc' | null;
}

export interface RollbackRuntimeThreadCommand {
  readonly kind: 'rollback-thread';
  readonly threadId: string;
  readonly numTurns: number;
}

export interface RuntimeTurnConfigCommandBase {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly cwd?: string | null;
  readonly approvalPolicy?: string | null;
  readonly approvalsReviewer?: JsonValue;
  readonly sandboxPolicy?: JsonValue;
  readonly permissionProfile?: JsonValue;
  readonly serviceTier?: JsonValue;
  readonly summary?: JsonValue;
  readonly personality?: JsonValue;
  readonly outputSchema?: JsonValue;
  readonly collaborationMode?: JsonValue;
  readonly responsesapiClientMetadata?: JsonObject | null;
  readonly environments?: readonly RuntimeTurnEnvironment[] | null;
}

export interface RuntimeTurnEnvironment {
  readonly environmentId: string;
  readonly cwd: string;
}

export interface StartRuntimeTurnCommand extends RuntimeTurnConfigCommandBase {
  readonly kind: 'start-turn';
  readonly threadId: string;
  readonly message: string;
  readonly content: readonly RuntimeContentItem[];
}

export interface SteerRuntimeTurnCommand {
  readonly kind: 'steer-turn';
  readonly threadId: string;
  readonly expectedTurnId: string;
  readonly message: string;
  readonly content: readonly RuntimeContentItem[];
  readonly responsesapiClientMetadata?: JsonObject | null;
}

export interface StartRuntimeReviewCommand {
  readonly kind: 'start-review';
  readonly threadId: string;
  readonly target: JsonValue;
  readonly delivery?: JsonValue;
}

export interface InterruptRuntimeTurnCommand {
  readonly kind: 'interrupt-turn';
  readonly threadId: string;
  readonly turnId: string | null;
}

export interface RespondToRuntimeHostRequestCommand {
  readonly kind: 'respond-to-runtime-host-request';
  readonly requestId: string;
  readonly response: JsonValue;
}

