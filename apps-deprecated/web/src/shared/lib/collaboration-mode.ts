export const DEFAULT_COLLABORATION_MODE_KIND = 'default' as const;

export type CollaborationModeKind = string;

export type CollaborationModeOption = {
  kind: CollaborationModeKind;
  label: string;
  model: string | null;
  reasoningEffort?: string | null;
};

export function normalizeCollaborationModeKind(value: unknown): CollaborationModeKind {
  if (typeof value !== 'string') {
    throw new Error('collaboration mode kind must be a string');
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error('collaboration mode kind must not be empty');
  }

  return normalizedValue;
}

export function readOptionalCollaborationModeKind(value: unknown): CollaborationModeKind | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

export function resolveCollaborationModeKindOrDefault(value: unknown): CollaborationModeKind {
  return readOptionalCollaborationModeKind(value) ?? DEFAULT_COLLABORATION_MODE_KIND;
}

export function findCollaborationModeOption(
  options: CollaborationModeOption[],
  kind: CollaborationModeKind,
): CollaborationModeOption | null {
  return options.find(option => option.kind === kind) ?? null;
}

export function resolveBootstrapCollaborationModeKind({
  threadId,
  payloadKind,
  storedKind,
}: {
  threadId: string;
  payloadKind: unknown;
  storedKind: unknown;
}): CollaborationModeKind | null {
  const normalizedPayloadKind = readOptionalCollaborationModeKind(payloadKind);

  if (typeof threadId === 'string' && threadId.trim()) {
    return normalizedPayloadKind ?? null;
  }

  const normalizedStoredKind = readOptionalCollaborationModeKind(storedKind);
  return normalizedPayloadKind ?? normalizedStoredKind ?? null;
}

export function cycleCollaborationModeKind(
  options: CollaborationModeOption[],
  currentKind: CollaborationModeKind,
): CollaborationModeKind {
  if (!options.length) {
    return currentKind;
  }

  const currentIndex = options.findIndex(option => option.kind === currentKind);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
  return options[nextIndex]?.kind ?? currentKind;
}
