import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeThread, RuntimeThreadSnapshot, RuntimeTurn } from './runtime-thread.js';

export type RuntimeResult =
  | RuntimeOkResult
  | RuntimeThreadStartedResult
  | RuntimeThreadResumedResult
  | RuntimeThreadForkedResult
  | RuntimeThreadUpdatedResult
  | RuntimeThreadUnsubscribeResult
  | RuntimeThreadLoadedListResult
  | RuntimeThreadElicitationResult
  | RuntimeThreadReadResult
  | RuntimeThreadsListedResult
  | RuntimeThreadTurnsListedResult
  | RuntimeTurnStartedResult
  | RuntimeTurnSteeredResult
  | RuntimeReviewStartedResult
  | RuntimeHostRequestRespondedResult;

export interface RuntimeOkResult {
  readonly kind: 'ok';
}

export interface RuntimeThreadEffectiveConfig {
  readonly model: string | null;
  readonly modelProvider?: string | null;
  readonly serviceTier: JsonValue;
  readonly cwd?: string | null;
  readonly instructionSources: readonly string[];
  readonly approvalPolicy: JsonValue;
  readonly approvalsReviewer: JsonValue;
  readonly sandbox: JsonValue;
  readonly permissionProfile: JsonValue;
  readonly reasoningEffort: string | null;
}

export interface RuntimeThreadStartedResult {
  readonly kind: 'thread-started';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
}

export interface RuntimeThreadResumedResult {
  readonly kind: 'thread-resumed';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
  readonly snapshot: RuntimeThreadSnapshot;
}

export interface RuntimeThreadForkedResult {
  readonly kind: 'thread-forked';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
  readonly snapshot: RuntimeThreadSnapshot;
}

export type RuntimeThreadUpdateOperation = 'unarchive' | 'metadata-update' | 'rollback';

export interface RuntimeThreadUpdatedResult {
  readonly kind: 'thread-updated';
  readonly operation: RuntimeThreadUpdateOperation;
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly snapshot?: RuntimeThreadSnapshot;
}

export type RuntimeThreadUnsubscribeStatus = 'notLoaded' | 'notSubscribed' | 'unsubscribed';

export interface RuntimeThreadUnsubscribeResult {
  readonly kind: 'thread-unsubscribed';
  readonly threadId: string;
  readonly status: RuntimeThreadUnsubscribeStatus;
}

export interface RuntimeThreadLoadedListResult {
  readonly kind: 'loaded-threads-listed';
  readonly threadIds: readonly string[];
  readonly nextCursor?: string | null;
}

export interface RuntimeThreadElicitationResult {
  readonly kind: 'thread-elicitation-updated';
  readonly threadId: string;
  readonly count: number;
  readonly paused: boolean;
}

export interface RuntimeThreadReadResult {
  readonly kind: 'thread-read';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly snapshot: RuntimeThreadSnapshot;
}

export interface RuntimeThreadsListedResult {
  readonly kind: 'threads-listed';
  readonly threads: readonly RuntimeThread[];
  readonly nextCursor?: string | null;
  readonly backwardsCursor?: string | null;
}

export interface RuntimeThreadTurnsListedResult {
  readonly kind: 'thread-turns-listed';
  readonly threadId: string;
  readonly turns?: readonly RuntimeTurn[];
  readonly nextCursor?: string | null;
  readonly backwardsCursor?: string | null;
}

export interface RuntimeTurnStartedResult {
  readonly kind: 'turn-started';
  readonly turnId: string;
  readonly turn?: RuntimeTurn;
}

export interface RuntimeTurnSteeredResult {
  readonly kind: 'turn-steered';
  readonly turnId: string;
}

export interface RuntimeReviewStartedResult {
  readonly kind: 'review-started';
  readonly turnId: string;
  readonly reviewThreadId: string;
  readonly turn?: RuntimeTurn;
}

export interface RuntimeHostRequestRespondedResult {
  readonly kind: 'runtime-host-request-responded';
  readonly requestId: string;
}
