import { afterEach, describe, expect, test, vi } from "vitest";
import { conversationViewFixture } from "./conversation-view-test-fixtures";
import { restoreConversation } from "./api-client";

describe("restoreConversation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts to the restore endpoint and returns the restored Conversation View", async () => {
    const restoredConversation = conversationViewFixture();
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: restoredConversation
      })
    );
    vi.stubGlobal("fetch", fetch);

    const result = await restoreConversation({
      threadId: "thread-1",
      clientRequestId: "restore-request-1"
    });

    expect(result).toEqual(restoredConversation);
    expect(fetch).toHaveBeenCalledWith(
      "/api/conversation-view/threads/thread-1/restore",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientRequestId: "restore-request-1" })
      }
    );
  });

  test("does not duplicate threadId in the restore body", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: conversationViewFixture()
      })
    );
    vi.stubGlobal("fetch", fetch);

    await restoreConversation({ threadId: "thread-1" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/conversation-view/threads/thread-1/restore",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }
    );
  });

  test("encodes the Thread id in the restore endpoint path", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: conversationViewFixture()
      })
    );
    vi.stubGlobal("fetch", fetch);

    await restoreConversation({ threadId: "thread/id with space" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/conversation-view/threads/thread%2Fid%20with%20space/restore",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }
    );
  });

  test("throws a restore request failure when HTTP fails with a success body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: true,
            data: conversationViewFixture()
          },
          { ok: false }
        )
      )
    );

    await expect(
      restoreConversation({ threadId: "thread-1" })
    ).rejects.toThrow("Conversation restore request failed");
  });

  test("throws the API error message when restore is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: false,
            error: {
              code: "THREAD_NOT_FOUND",
              message: "Thread 不存在",
              retryable: false,
              target: { threadId: "thread-missing" }
            }
          },
          { ok: false }
        )
      )
    );

    await expect(
      restoreConversation({ threadId: "thread-missing" })
    ).rejects.toThrow("Thread 不存在");
  });
});

function jsonResponse(body: unknown, input?: { ok?: boolean }): Response {
  return {
    ok: input?.ok ?? true,
    json: async () => body
  } as Response;
}
