import { describe, expect, test, vi } from "vitest";
import type { ConversationHostView } from "@my-code-x/app-types";
import {
  conversationViewFixture,
  messageTimelineItemFixture,
  selectedConversationHostFixture
} from "./conversation-view-test-fixtures";
import { loadInitialConversationHost } from "./load-initial-conversation-host";

describe("loadInitialConversationHost", () => {
  test("restores the selected Thread before returning the initial host view", async () => {
    const selectedHost = selectedConversationHostFixture();
    const restoredConversation = conversationWithMessage();
    const getCurrentConversation = vi.fn().mockResolvedValue(selectedHost);
    const restoreConversation = vi.fn().mockResolvedValue(restoredConversation);

    const result = await loadInitialConversationHost({
      getCurrentConversation,
      restoreConversation
    });

    expect(result).toEqual(
      selectedConversationHostFixture(restoredConversation)
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
    const selectedHost = selectedConversationHostFixture();
    const getCurrentConversation = vi.fn().mockResolvedValue(selectedHost);
    const restoreConversation = vi.fn().mockRejectedValue(
      new Error("恢复历史失败")
    );

    const result = await loadInitialConversationHost({
      getCurrentConversation,
      restoreConversation
    });

    expect(result).toEqual(
      selectedConversationHostFixture({
        ...selectedHost.conversation,
        pageState: {
          kind: "restoreFailed",
          message: "恢复历史失败"
        }
      })
    );
  });
});

function conversationWithMessage() {
  return conversationViewFixture({
    pageState: { kind: "ready" },
    timeline: [
      messageTimelineItemFixture({
        id: "item-agent",
        occurredAt: "2026-05-21T10:01:00.000Z",
        role: "agent",
        text: "恢复完成"
      })
    ]
  });
}
