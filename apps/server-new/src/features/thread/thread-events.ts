import type { RuntimeSettings, RuntimeThread, RuntimeTurnStartedEvent } from '../../ports/index.js';

export type ThreadCommand = CreateThreadCommand | OpenThreadCommand | ListWorkspaceThreadsCommand;

export interface CreateThreadCommand {
  readonly kind: 'create-thread';
  readonly workspace: string;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
}

export interface OpenThreadCommand {
  readonly kind: 'open-thread';
  readonly threadId: string;
  readonly workspace: string;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
}

export interface ListWorkspaceThreadsCommand {
  readonly kind: 'list-workspace-threads';
  readonly workspace: string;
  readonly limit: number;
  readonly archived: boolean;
}

export type ThreadRuntimeEvent = RuntimeTurnStartedEvent;

export type ThreadDomainEvent = ThreadStartedEvent | ThreadTurnAttachedEvent | ThreadsListedEvent;

export interface ThreadStartedEvent {
  readonly kind: 'thread-started';
  readonly threadId: string;
}

export interface ThreadTurnAttachedEvent {
  readonly kind: 'thread-turn-attached';
  readonly threadId: string;
  readonly turnId: string;
}

export interface ThreadsListedEvent {
  readonly kind: 'threads-listed';
  readonly threads: readonly RuntimeThread[];
}

export interface ThreadSnapshot {
  readonly currentThreadId: string | null;
  readonly activeTurnId: string | null;
  readonly threads: readonly RuntimeThread[];
}
