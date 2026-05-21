import type {
  ConversationPageState,
  ConversationSyncState,
  TimelineItem,
  ConversationView,
  ThreadContext
} from "@my-code-x/app-types";
import type { CodexThreadListItem } from "../codex-thread-browser/codex-thread-browser";
import { emptyDraftComposerAction } from "./composer-policy";
import type {
  CodexRestoredAgentMessage,
  CodexRestoredThread,
  CodexRestoredThreadItem,
  CodexRestoredUserMessage,
  CodexRestoredUserInput
} from "./codex-conversation-history-gateway";

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
      const timelineItem = projectRestoredThreadItem({
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

interface ProjectRestoredThreadItemInput {
  threadId: string;
  turnId: string;
  item: CodexRestoredThreadItem;
}

function projectRestoredThreadItem(
  input: ProjectRestoredThreadItemInput
): TimelineItem | null {
  if (isRestoredUserMessage(input.item)) {
    const text = input.item.content
      .filter(isTextInput)
      .map((entry) => entry.text)
      .join("\n");

    if (!text) {
      return null;
    }

    return messageTimelineItem({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id,
      role: "user",
      text
    });
  }

  if (isRestoredAgentMessage(input.item)) {
    return messageTimelineItem({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id,
      role: "agent",
      text: input.item.text
    });
  }

  return null;
}

function isRestoredUserMessage(
  item: CodexRestoredThreadItem
): item is CodexRestoredUserMessage {
  return (
    item.type === "userMessage" &&
    typeof item.id === "string" &&
    "content" in item &&
    Array.isArray(item.content)
  );
}

function isRestoredAgentMessage(
  item: CodexRestoredThreadItem
): item is CodexRestoredAgentMessage {
  return (
    item.type === "agentMessage" &&
    typeof item.id === "string" &&
    "text" in item &&
    typeof item.text === "string"
  );
}

function isTextInput(
  input: CodexRestoredUserInput
): input is Extract<CodexRestoredUserInput, { type: "text" }> {
  return input.type === "text" && "text" in input && typeof input.text === "string";
}

interface MessageTimelineItemInput extends CodexThreadItemIdInput {
  role: "user" | "agent";
  text: string;
}

function messageTimelineItem(input: MessageTimelineItemInput): TimelineItem {
  return {
    id: codexThreadItemId(input),
    turnId: input.turnId,
    occurredAt: null,
    status: "completed",
    kind: "message",
    message: {
      role: input.role,
      text: input.text,
      markdown: true,
      copyText: input.text
    }
  };
}

interface CodexThreadItemIdInput {
  threadId: string;
  turnId: string;
  itemId: string;
}

function codexThreadItemId(input: CodexThreadItemIdInput): string {
  return `codexThreadItem(${input.threadId},${input.turnId},${input.itemId})`;
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
