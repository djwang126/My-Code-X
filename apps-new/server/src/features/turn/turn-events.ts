export type TurnCommand = TurnStartedCommand | TurnCompletedCommand | ClearTurnCommand;

export interface TurnStartedCommand {
  readonly kind: 'turn-started';
  readonly threadId: string;
  readonly turnId: string;
  readonly startedAt: number | null;
}

export interface TurnCompletedCommand {
  readonly kind: 'turn-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly status: TurnTerminalStatus;
  readonly error: TurnError | null;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
}

export interface ClearTurnCommand {
  readonly kind: 'clear-turn';
  readonly threadId: string;
}

export type TurnDomainEvent = TurnStartedEvent | TurnCompletedEvent | TurnClearedEvent;

export interface TurnStartedEvent {
  readonly kind: 'turn-started';
  readonly threadId: string;
  readonly turnId: string;
  readonly startedAt: number | null;
}

export interface TurnCompletedEvent {
  readonly kind: 'turn-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly status: TurnTerminalStatus;
  readonly error: TurnError | null;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
}

export interface TurnClearedEvent {
  readonly kind: 'turn-cleared';
  readonly threadId: string;
}

export type TurnStatus = 'inProgress' | TurnTerminalStatus;

export type TurnTerminalStatus = 'completed' | 'failed' | 'interrupted';

export interface TurnError {
  readonly message: string;
  readonly code: string | null;
}

export interface TurnRecord {
  readonly threadId: string;
  readonly turnId: string;
  readonly status: TurnStatus;
  readonly error: TurnError | null;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
}

export interface TurnSnapshot {
  readonly current: TurnRecord | null;
}
