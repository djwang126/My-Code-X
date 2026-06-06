import { describe, expect, it } from "vitest";
import { createConversationViewClient } from "./conversation-view-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("ConversationViewClient", () => {
  it("parses a valid conversation snapshot response", async () => {
    const client = createConversationViewClient({
      fetch: async () =>
        jsonResponse({
          conversation: {
            id: "conv-1",
            contentRestore: { kind: "RestoredEmpty" }
          },
          transcriptEntries: [],
          turns: [],
          pendingInteractions: [],
          cursor: "0"
        }),
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    });

    await expect(client.getSnapshot("conv-1")).resolves.toEqual({
      conversation: {
        id: "conv-1",
        contentRestore: { kind: "RestoredEmpty" }
      },
      transcriptEntries: [],
      turns: [],
      pendingInteractions: [],
      cursor: "0"
    });
  });

  it("rejects an invalid conversation snapshot response", async () => {
    const client = createConversationViewClient({
      fetch: async () =>
        jsonResponse({
          conversation: {
            id: "conv-1",
            contentRestore: { kind: "RestoredEmpty" }
          },
          transcriptEntries: [],
          turns: [],
          pendingInteractions: []
        }),
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    });

    await expect(client.getSnapshot("conv-1")).rejects.toMatchObject({
      name: "ZodError"
    });
  });

  it("parses a valid input send outcome response", async () => {
    const sentRequests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createConversationViewClient({
      fetch: async (url, init) => {
        sentRequests.push({ url: String(url), init });
        return jsonResponse({ outcome: "Accepted" });
      },
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    });

    await expect(
      client.sendInput({
        conversationId: "conv-1",
        markdownSource: "你好 Codex 👋\n第二行"
      })
    ).resolves.toEqual({ outcome: "Accepted" });
    expect(sentRequests).toEqual([
      {
        url: "/api/conversations/conv-1/inputs",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdownSource: "你好 Codex 👋\n第二行" })
        }
      }
    ]);
  });

  it("rejects an invalid input send outcome response", async () => {
    const client = createConversationViewClient({
      fetch: async () => jsonResponse({ status: "ok" }),
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    });

    await expect(
      client.sendInput({
        conversationId: "conv-1",
        markdownSource: "hello"
      })
    ).rejects.toMatchObject({
      name: "ZodError"
    });
  });

  it("opens conversation events at the API events endpoint", () => {
    const openedEventSourceUrls: string[] = [];
    const eventSource = {
      addEventListener: () => undefined,
      close: () => undefined
    };
    const client = createConversationViewClient({
      fetch: async () => jsonResponse({ status: "ok" }),
      createEventSource: (url) => {
        openedEventSourceUrls.push(url);
        return eventSource;
      }
    });

    expect(
      client.createEventSource({
        conversationId: "conv with spaces/and/slashes",
        cursor: "cursor-42"
      })
    ).toBe(eventSource);
    expect(openedEventSourceUrls).toEqual([
      "/api/conversations/conv%20with%20spaces%2Fand%2Fslashes/events"
    ]);
  });
});
