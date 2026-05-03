import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeErrorInfo } from './runtime-error.js';
import type { RuntimeHostRequest } from './runtime-host-request.js';
import type {
  RuntimeTerminalTurnStatus,
  RuntimeThread,
  RuntimeThreadItem,
  RuntimeThreadStatus,
  RuntimeTurn,
} from './runtime-thread.js';

export type RuntimeEvent =
  | RuntimeHostRequestEvent
  | RuntimeHostRequestResolvedEvent
  | RuntimeThreadStartedEvent
  | RuntimeThreadStatusChangedEvent
  | RuntimeThreadNameUpdatedEvent
  | RuntimeThreadArchivedEvent
  | RuntimeThreadUnarchivedEvent
  | RuntimeThreadClosedEvent
  | RuntimeThreadTokenUsageUpdatedEvent
  | RuntimeTurnStartedEvent
  | RuntimeItemStartedEvent
  | RuntimeItemDeltaEvent
  | RuntimeItemCompletedEvent
  | RuntimeTurnDiffUpdatedEvent
  | RuntimeTurnPlanUpdatedEvent
  | RuntimeTurnCompletedEvent
  | RuntimeSystemNoticeEvent
  | RuntimeErrorEvent;

export interface RuntimeHostRequestEvent extends RuntimeHostRequest {
  readonly kind: 'runtime-host-requested';
}

export interface RuntimeHostRequestResolvedEvent {
  readonly kind: 'runtime-host-request-resolved';
  readonly threadId: string;
  readonly requestId: string;
}

export interface RuntimeThreadStartedEvent {
  readonly kind: 'runtime-thread-started';
  readonly thread: RuntimeThread;
}

export interface RuntimeThreadStatusChangedEvent {
  readonly kind: 'runtime-thread-status-changed';
  readonly threadId: string;
  readonly status?: RuntimeThreadStatus;
}

export interface RuntimeThreadNameUpdatedEvent {
  readonly kind: 'runtime-thread-name-updated';
  readonly threadId: string;
  readonly name?: string | null;
}

export interface RuntimeThreadArchivedEvent {
  readonly kind: 'runtime-thread-archived';
  readonly threadId: string;
}

export interface RuntimeThreadUnarchivedEvent {
  readonly kind: 'runtime-thread-unarchived';
  readonly threadId: string;
}

export interface RuntimeThreadClosedEvent {
  readonly kind: 'runtime-thread-closed';
  readonly threadId: string;
}

export interface RuntimeThreadTokenUsageUpdatedEvent {
  readonly kind: 'runtime-thread-token-usage-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly tokenUsage: JsonObject;
}

export interface RuntimeTurnStartedEvent {
  readonly kind: 'runtime-turn-started';
  readonly threadId: string;
  readonly turn?: RuntimeTurn;
  readonly turnId: string;
}

export interface RuntimeItemStartedEvent {
  readonly kind: 'runtime-item-started';
  readonly threadId: string;
  readonly turnId: string;
  readonly item: RuntimeThreadItem;
}

export type RuntimeItemDeltaKind =
  | 'agent-message'
  | 'plan'
  | 'reasoning-summary-text'
  | 'reasoning-summary-part'
  | 'reasoning-text'
  | 'command-output'
  | 'terminal-interaction'
  | 'file-change-output'
  | 'file-change-patch'
  | 'mcp-tool-progress';

export interface RuntimeItemDeltaEvent {
  readonly kind: 'runtime-item-delta';
  readonly threadId: string;
  readonly turnId: string;
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly text: string | null;
  readonly data?: JsonObject;
}

export interface RuntimeItemCompletedEvent {
  readonly kind: 'runtime-item-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly item: RuntimeThreadItem;
}

export interface RuntimeTurnDiffUpdatedEvent {
  readonly kind: 'runtime-turn-diff-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly diff: string;
}

export interface RuntimeTurnPlanUpdatedEvent {
  readonly kind: 'runtime-turn-plan-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly explanation: string | null;
  readonly plan: readonly JsonValue[];
}

export interface RuntimeTurnCompletedEvent {
  readonly kind: 'runtime-turn-completed';
  readonly threadId: string;
  readonly turn?: RuntimeTurn;
  readonly turnId: string;
  readonly status: RuntimeTerminalTurnStatus;
  readonly error: RuntimeErrorInfo | null;
}

export interface RuntimeSystemNoticeEvent {
  readonly kind: 'runtime-system-notice';
  readonly threadId: string | null;
  readonly level: 'info' | 'warning' | 'error';
  readonly message: string;
}

export interface RuntimeErrorEvent {
  readonly kind: 'runtime-error';
  readonly threadId: string | null;
  readonly turnId: string | null;
  readonly error: RuntimeErrorInfo;
}

