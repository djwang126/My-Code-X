export interface AppScope {
  readonly slotId: string | null;
  readonly workspaceId: string | null;
  readonly threadId: string | null;
  readonly label: string;
}

export function readAppScope(): AppScope {
  const search = new URLSearchParams(window.location.search);
  const slotId = search.get('slotId');
  const workspaceId = search.get('workspaceId');
  const threadId = search.get('threadId');

  return {
    slotId,
    workspaceId,
    threadId,
    label: createScopeLabel({ slotId, workspaceId, threadId }),
  };
}

interface CreateScopeLabelInput {
  readonly slotId: string | null;
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}

function createScopeLabel(input: CreateScopeLabelInput): string {
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
