export type ThreadCommand = RememberThreadCommand | RememberThreadsCommand | ForgetThreadCommand;

export interface RememberThreadCommand {
  readonly kind: 'remember-thread';
  readonly thread: ThreadRecord;
}

export interface RememberThreadsCommand {
  readonly kind: 'remember-threads';
  readonly threads: readonly ThreadRecord[];
}

export interface ForgetThreadCommand {
  readonly kind: 'forget-thread';
  readonly threadId: string;
}

export type ThreadDomainEvent = ThreadRememberedEvent | ThreadsRememberedEvent | ThreadForgottenEvent;

export interface ThreadRememberedEvent {
  readonly kind: 'thread-remembered';
  readonly thread: ThreadRecord;
}

export interface ThreadsRememberedEvent {
  readonly kind: 'threads-remembered';
  readonly threads: readonly ThreadRecord[];
}

export interface ThreadForgottenEvent {
  readonly kind: 'thread-forgotten';
  readonly threadId: string;
}

export interface ThreadRecord {
  readonly threadId: string;
  readonly workspace: string | null;
  readonly title: string | null;
  readonly updatedAt: string | null;
}

export interface ThreadSnapshot {
  readonly threads: readonly ThreadRecord[];
}
