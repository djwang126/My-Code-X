export type ClientTurnStatus = 'inProgress' | 'completed' | 'failed' | 'interrupted';

export interface ClientTurnError {
  readonly message: string;
  readonly code: string | null;
}

export interface ClientTurnRecord {
  readonly threadId: string;
  readonly turnId: string;
  readonly status: ClientTurnStatus;
  readonly error: ClientTurnError | null;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
}

export interface ClientTurnView {
  readonly current: ClientTurnRecord | null;
}
