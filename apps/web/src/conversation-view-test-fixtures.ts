import type {
  ConversationHostView,
  ConversationPageState,
  ConversationView,
  TimelineItem
} from "@my-code-x/app-types";

type SelectedConversationHostView = Extract<
  ConversationHostView,
  { kind: "conversationTargetSelected" }
>;

export function conversationViewFixture(input?: {
  pageState?: ConversationPageState;
  timeline?: TimelineItem[];
}): ConversationView {
  return {
    thread: {
      threadId: "thread-1",
      title: "Restore message history",
      cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      updatedAt: "2026-05-21T10:00:00.000Z",
      status: "idle"
    },
    pageState: input?.pageState ?? { kind: "empty" },
    timeline: input?.timeline ?? [],
    composer: {
      threadId: "thread-1",
      draft: "",
      action: {
        kind: "disabled",
        enabled: false,
        reason: "emptyDraft"
      }
    },
    notices: [],
    sync: {
      connection: "connected",
      freshness: "fresh",
      lastSyncedAt: "2026-05-21T10:00:00.000Z"
    }
  };
}

export function selectedConversationHostFixture(
  conversation: ConversationView = conversationViewFixture()
): SelectedConversationHostView {
  return {
    kind: "conversationTargetSelected",
    threadId: "thread-1",
    conversation
  };
}

export function conversationHostWithTimelineFixture(
  timeline: TimelineItem[],
  input?: { pageState?: ConversationPageState }
): SelectedConversationHostView {
  return selectedConversationHostFixture(
    conversationViewFixture({
      pageState: input?.pageState ?? { kind: "ready" },
      timeline
    })
  );
}

export function messageTimelineItemFixture(input: {
  id: string;
  occurredAt?: string;
  role: "user" | "agent";
  text: string;
}): TimelineItem {
  return {
    id: input.id,
    turnId: "turn-1",
    occurredAt: input.occurredAt ?? null,
    status: "completed",
    kind: "message",
    message: {
      role: input.role,
      text: input.text,
      markdown: input.role === "agent",
      copyText: input.text
    }
  };
}
