import { describe, expect, test, vi } from "vitest";
import type { ConversationHostView, ConversationView } from "@my-code-x/app-types";
import { loadInitialConversationHost } from "./load-initial-conversation-host";

type SelectedConversationHostView = Extract<
  ConversationHostView,
  { kind: "conversationTargetSelected" }
>;

describe("loadInitialConversationHost", () => {
  test("restores the selected Thread before returning the initial host view", async () => {
    const selectedHost = selectedConversationHost(emptyConversation());
    const restoredConversation = conversationWithMessage();
    const getCurrentConversation = vi.fn().mockResolvedValue(selectedHost);
    const restoreConversation = vi.fn().mockResolvedValue(restoredConversation);

    const result = await loadInitialConversationHost({
      getCurrentConversation,
      restoreConversation
    });

    expect(result).toEqual(
      selectedConversationHost(restoredConversation)
    );
    expect(restoreConversation).toHaveBeenCalledWith({
      threadId: "thread-1"
    });
  });

  test("does not restore when no Thread is selected", async () => {
    const noConversationTarget: ConversationHostView = {
      kind: "noConversationTarget"
    };
    const restoreConversation = vi.fn();

    const result = await loadInitialConversationHost({
      getCurrentConversation: vi.fn().mockResolvedValue(noConversationTarget),
      restoreConversation
    });

    expect(result).toEqual(noConversationTarget);
    expect(restoreConversation).not.toHaveBeenCalled();
  });

  test("keeps the selected Thread context when restore fails", async () => {
    const selectedHost = selectedConversationHost(emptyConversation());
    const getCurrentConversation = vi.fn().mockResolvedValue(selectedHost);
    const restoreConversation = vi.fn().mockRejectedValue(
      new Error("恢复历史失败")
    );

    const result = await loadInitialConversationHost({
      getCurrentConversation,
      restoreConversation
    });

    expect(result).toEqual(
      selectedConversationHost({
        ...selectedHost.conversation,
        pageState: {
          kind: "restoreFailed",
          message: "恢复历史失败"
        }
      })
    );
  });
});

function selectedConversationHost(
  conversation: ConversationView
): SelectedConversationHostView {
  return {
    kind: "conversationTargetSelected",
    threadId: "thread-1",
    conversation
  };
}

function emptyConversation(): ConversationView {
  return {
    thread: {
      threadId: "thread-1",
      title: "Restore message history",
      cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      updatedAt: "2026-05-21T10:00:00.000Z",
      status: "idle"
    },
    pageState: { kind: "empty" },
    timeline: [],
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

function conversationWithMessage(): ConversationView {
  return {
    ...emptyConversation(),
    pageState: { kind: "ready" },
    timeline: [
      {
        id: "item-agent",
        turnId: "turn-1",
        occurredAt: "2026-05-21T10:01:00.000Z",
        status: "completed",
        kind: "message",
        message: {
          role: "agent",
          text: "恢复完成",
          markdown: true,
          copyText: "恢复完成"
        }
      }
    ]
  };
}
