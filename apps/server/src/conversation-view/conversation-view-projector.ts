import type {
  ConversationPageState,
  ConversationSyncState,
  TimelineItem,
  ConversationView,
  ThreadContext
} from "@my-code-x/app-types";
import type { CodexThreadListItem } from "../codex-thread-browser/codex-thread-browser";
import { emptyDraftComposerAction } from "./composer-policy";
import type { CodexRestoredThread } from "./codex-conversation-history-gateway";
import { classifyRestoredThreadItem } from "./timeline-classifier";

export function createEmptyConversationView(
  thread: CodexThreadListItem
): ConversationView {
  const threadContext = toThreadContext(thread);

  return {
    thread: threadContext,
    pageState: emptyPageState(),
    timeline: [],
    composer: {
      threadId: thread.id,
      draft: "",
      action: emptyDraftComposerAction({
        sourceStatus: thread.status.type,
        thread: threadContext
      })
    },
    notices: [],
    sync: unknownSyncState()
  };
}

export function createRestoredConversationView(
  thread: CodexRestoredThread
): ConversationView {
  const timeline = restoreTimeline(thread);
  const view = createEmptyConversationView(thread);

  return {
    ...view,
    pageState: timeline.length === 0 ? view.pageState : { kind: "ready" },
    timeline
  };
}

function restoreTimeline(thread: CodexRestoredThread): TimelineItem[] {
  const timeline: TimelineItem[] = [];

  for (const turn of thread.turns) {
    for (const item of turn.items) {
      const timelineItem = classifyRestoredThreadItem({
        threadId: thread.id,
        turnId: turn.id,
        item
      });

      if (timelineItem) {
        timeline.push(timelineItem);
      }
    }
  }

  return timeline;
}

function toThreadContext(thread: CodexThreadListItem): ThreadContext {
  return {
    threadId: thread.id,
    title: threadTitle(thread),
    cwd: thread.cwd,
    updatedAt:
      thread.updatedAt === null ? null : new Date(thread.updatedAt * 1000).toISOString(),
    ...threadContextStatus(thread)
  };
}

function emptyPageState(): ConversationPageState {
  return {
    kind: "empty"
  };
}

function unknownSyncState(): ConversationSyncState {
  return {
    connection: "unknown",
    freshness: "unknown",
    lastSyncedAt: null
  };
}

function threadTitle(thread: CodexThreadListItem): string | null {
  const name = thread.name?.trim();
  if (name) {
    return name;
  }

  const preview = thread.preview.trim();
  if (preview) {
    return preview;
  }

  return null;
}

function threadContextStatus(
  thread: CodexThreadListItem
):
  | { status: "idle" }
  | { status: "notLoaded" }
  | { status: "systemError"; message: string }
  | { status: "unknown" } {
  if (thread.status.type === "idle") {
    return { status: "idle" };
  }

  if (thread.status.type === "notLoaded") {
    return { status: "notLoaded" };
  }

  if (thread.status.type === "unknown") {
    return { status: "unknown" };
  }

  if (thread.status.type === "systemError" && thread.status.message) {
    return {
      status: "systemError",
      message: thread.status.message
    };
  }

  return { status: "unknown" };
}
