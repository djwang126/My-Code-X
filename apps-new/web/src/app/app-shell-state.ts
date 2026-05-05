import type { ClientConversationView, ClientSnapshot } from '@my-code-x/contracts-new';
import type { AppScope } from './app-scope.js';

export interface AppShellState {
  readonly scope: AppScope;
  readonly conversation: ClientConversationView;
}

export function applyResumeSnapshotToAppShellState(input: {
  readonly state: AppShellState;
  readonly snapshot: ClientSnapshot;
}): AppShellState {
  return {
    scope: createScopeFromSnapshot(input.snapshot),
    conversation: input.snapshot.conversation,
  };
}

export function createScopeFromSnapshot(snapshot: ClientSnapshot): AppScope {
  const scope = {
    slotId: snapshot.identity.slotId,
    workspaceId: snapshot.selection.workspaceId,
    threadId: snapshot.selection.threadId,
  };

  return {
    ...scope,
    label: createScopeLabel(scope),
  };
}

function createScopeLabel(input: {
  readonly slotId: string | null;
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}): string {
  if (input.threadId) {
    return `thread ${input.threadId}`;
  }

  if (input.workspaceId) {
    return `workspace ${input.workspaceId}`;
  }

  if (input.slotId) {
    return `slot ${input.slotId}`;
  }

  return 'no scope selected';
}
