export type SessionPhase = 'idle' | 'loading' | 'ready' | 'auth-required' | 'error';

export interface SessionState {
  phase: SessionPhase;
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
  serverInstanceId: string;
  statusMessage: string;
  errorMessage: string;
}

export type SessionAction =
  | { type: 'bootstrap/started'; viewerId: string; slotId: string; workspace: string; threadId: string }
  | {
      type: 'bootstrap/succeeded';
      viewerId: string;
      slotId: string;
      workspace: string;
      threadId: string;
      serverInstanceId: string;
    }
  | { type: 'bootstrap/auth-required'; viewerId: string; slotId: string }
  | { type: 'bootstrap/failed'; viewerId: string; slotId: string; errorMessage: string }
  | { type: 'slot/displaced'; viewerId: string; slotId: string; errorMessage: string }
  | { type: 'selection/updated'; workspace: string; threadId: string }
  | { type: 'server/instance-synced'; serverInstanceId: string };

import { readBootstrapScope } from '../lib/session-identity';

export function createInitialSessionState(): SessionState {
  const scope = readBootstrapScope();

  return {
    phase: 'idle',
    viewerId: '',
    slotId: scope.slotId,
    workspace: scope.workspace,
    threadId: scope.threadId,
    serverInstanceId: '',
    statusMessage: 'Loading session…',
    errorMessage: '',
  };
}
