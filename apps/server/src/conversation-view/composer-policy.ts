import type {
  ComposerAction,
  ThreadContext
} from "@my-code-x/app-types";

export interface EmptyDraftComposerActionInput {
  sourceStatus: "idle" | "notLoaded" | "systemError" | "active" | "unknown";
  thread: ThreadContext;
}

export function emptyDraftComposerAction(
  input: EmptyDraftComposerActionInput
): ComposerAction {
  if (input.sourceStatus === "active") {
    return disabledComposerAction("unreliableTurnTarget");
  }

  if (input.thread.status === "notLoaded") {
    return disabledComposerAction("unreliableThreadTarget");
  }

  if (input.thread.status === "systemError") {
    return disabledComposerAction("systemError");
  }

  if (input.thread.status === "unknown") {
    return disabledComposerAction("unknown");
  }

  return disabledComposerAction("emptyDraft");
}

function disabledComposerAction(
  reason: Extract<ComposerAction, { kind: "disabled" }>["reason"]
): ComposerAction {
  return {
    kind: "disabled",
    enabled: false,
    reason
  };
}
