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
