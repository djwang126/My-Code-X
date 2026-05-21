import type { ConversationHostView, ConversationView } from "@my-code-x/app-types";
import type { CodexThreadBrowser, CodexThreadListItem } from "./codex-thread-browser";

export interface GetCurrentConversationInput {
  codexThreadBrowser: CodexThreadBrowser;
  defaultCodexCwd: string;
}

export async function getCurrentConversation(
  input: GetCurrentConversationInput
): Promise<ConversationHostView> {
  const threads = await input.codexThreadBrowser.listThreads({
    cwd: input.defaultCodexCwd,
    limit: 1
  });
  const firstThread = threads[0];

  if (firstThread) {
    return {
      kind: "conversationTargetSelected",
      threadId: firstThread.id,
      conversation: createEmptyConversationView(firstThread)
    };
  }

  return {
    kind: "noConversationTarget"
  };
}

function createEmptyConversationView(thread: CodexThreadListItem): ConversationView {
  return {
    thread: {
      threadId: thread.id,
      title: threadTitle(thread),
      cwd: thread.cwd,
      updatedAt: thread.updatedAt === null ? null : new Date(thread.updatedAt * 1000).toISOString(),
      ...threadContextStatus(thread)
    },
    pageState: {
      kind: "empty"
    },
    timeline: [],
    composer: {
      threadId: thread.id,
      draft: "",
      action: {
        kind: "disabled",
        enabled: false,
        reason: "emptyDraft"
      }
    },
    notices: [],
    sync: {
      connection: "unknown",
      freshness: "unknown",
      lastSyncedAt: null
    }
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
  | { status: "active"; activeTurnId: string }
  | { status: "unknown" } {
  if (thread.status.type === "idle") {
    return { status: "idle" };
  }

  if (thread.status.type === "notLoaded") {
    return { status: "notLoaded" };
  }

  if (thread.status.type === "systemError" && thread.status.message) {
    return {
      status: "systemError",
      message: thread.status.message
    };
  }

  if (thread.status.type === "active" && thread.status.activeTurnId) {
    return {
      status: "active",
      activeTurnId: thread.status.activeTurnId
    };
  }

  return { status: "unknown" };
}
