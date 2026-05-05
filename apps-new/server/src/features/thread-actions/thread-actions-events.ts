import type { RuntimeTimelineItem, RuntimeTurn } from '../../ports/index.js';

export type ThreadActionCommand = CreateThreadCommand | OpenThreadCommand;

export interface CreateThreadCommand {
  readonly workspace: string;
}

export interface OpenThreadCommand {
  readonly threadId: string;
  readonly workspace: string;
}

export type ThreadActionsDomainEvent = ThreadCreatedEvent | ThreadOpenedEvent;

export interface ThreadCreatedEvent {
  readonly kind: 'thread-created';
  readonly thread: ThreadActionResult;
}

export interface ThreadOpenedEvent {
  readonly kind: 'thread-opened';
  readonly thread: ThreadActionResult;
}

export interface ThreadActionResult {
  readonly threadId: string;
  readonly workspace: string;
  readonly title: string | null;
  readonly updatedAt: string | null;
}

export type OpenThreadActionResult = OpenThreadReadyActionResult | OpenThreadFailedActionResult;

export interface OpenThreadReadyActionResult {
  readonly status: 'ready';
  readonly thread: ThreadActionResult;
  readonly restoredItems: readonly RuntimeTimelineItem[];
  readonly restoredTurns: readonly RuntimeTurn[] | null;
}

export interface OpenThreadFailedActionResult {
  readonly status: 'failed';
  readonly error: ThreadOpenError;
}

export interface ThreadOpenError {
  readonly message: string;
}
