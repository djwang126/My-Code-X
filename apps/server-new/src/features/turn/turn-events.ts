export type TurnCommand = StartTurnCommand | MarkTurnWaitingCommand | FinishTurnCommand | ResetTurnCommand;

export interface StartTurnCommand {
  readonly kind: 'start-turn';
  readonly turnId: string;
}

export interface MarkTurnWaitingCommand {
  readonly kind: 'mark-turn-waiting';
  readonly turnId: string;
}

export interface FinishTurnCommand {
  readonly kind: 'finish-turn';
  readonly turnId: string;
  readonly outcome: TurnTerminalOutcome;
}

export interface ResetTurnCommand {
  readonly kind: 'reset-turn';
}

export type TurnDomainEvent = TurnStartedEvent | TurnWaitingEvent | TurnFinishedEvent | TurnResetEvent;

export interface TurnStartedEvent {
  readonly kind: 'turn-started';
  readonly turnId: string;
}

export interface TurnWaitingEvent {
  readonly kind: 'turn-waiting';
  readonly turnId: string;
}

export interface TurnFinishedEvent {
  readonly kind: 'turn-finished';
  readonly turnId: string;
  readonly outcome: TurnTerminalOutcome;
}

export interface TurnResetEvent {
  readonly kind: 'turn-reset';
}

export type TurnTerminalOutcome = 'completed' | 'failed' | 'interrupted';

export type TurnSnapshot =
  | { readonly lifecycle: 'idle'; readonly activeTurnId: null }
  | { readonly lifecycle: 'starting' | 'streaming' | 'waiting-for-input'; readonly activeTurnId: string }
  | { readonly lifecycle: 'completed' | 'failed' | 'interrupted'; readonly activeTurnId: string };
