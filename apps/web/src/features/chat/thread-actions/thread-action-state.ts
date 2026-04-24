export type ThreadActionIdleState = {
  status: 'idle';
};

export type StartThreadActionState = {
  status: 'starting-thread';
};

export type ResumeThreadActionState = {
  status: 'resuming-thread';
  threadId: string;
};

export type CompactThreadActionState = {
  status: 'compacting-thread';
  threadId: string;
  observedTurnId: string | null;
  observedCompactionSignal: boolean;
};

export type RollbackThreadActionState = {
  status: 'rolling-back-thread';
  threadId: string;
};

export type ForkThreadActionState = {
  status: 'forking-thread';
  threadId: string;
};

export type ThreadActionState =
  | ThreadActionIdleState
  | StartThreadActionState
  | ResumeThreadActionState
  | CompactThreadActionState
  | RollbackThreadActionState
  | ForkThreadActionState;

export function createIdleThreadActionState(): ThreadActionIdleState {
  return { status: 'idle' };
}

export function isThreadActionPending(state: ThreadActionState) {
  return state.status !== 'idle';
}
