import request from "supertest";
import { describe, expect, it } from "vitest";
import { conversationSnapshotSchema, type ConversationSnapshot } from "@my-code-x/app-types";
import { entryFixture, snapshotFixture } from "@my-code-x/app-types/test-fixtures";
import { createApp } from "../create-app";
import type { ConversationViewRuntime } from "./conversation-view-runtime";

const app = createApp({
  config: {
    host: "127.0.0.1",
    port: 0
  }
});

function parseSnapshotResponse(body: unknown): ConversationSnapshot {
  return conversationSnapshotSchema.parse(body);
}

describe("Conversation View snapshot API", () => {
  it("returns an empty conversation snapshot", async () => {
    const response = await request(app).get("/api/conversations/conv-empty/snapshot");
    const snapshot = parseSnapshotResponse(response.body);

    expect(response.status).toBe(200);
    expect(snapshot).toEqual({
      conversation: {
        id: "conv-empty",
        contentRestore: {
          kind: "RestoredEmpty"
        }
      },
      transcriptEntries: [],
      turns: [],
      pendingInteractions: [],
      cursor: "0"
    });
  });

  it("returns existing ordinary conversation entries ordered by sequence", async () => {
    const response = await request(app).get("/api/conversations/conv-seeded/snapshot");
    const snapshot = parseSnapshotResponse(response.body);

    expect(response.status).toBe(200);
    expect(snapshot).toEqual({
      conversation: {
        id: "conv-seeded",
        contentRestore: {
          kind: "Restored"
        }
      },
      transcriptEntries: [
        {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: "hello"
          }
        },
        {
          id: "entry-2-agent",
          sequence: 2,
          body: {
            kind: "AgentReply",
            content: "echo: hello",
            stream: "Completed"
          }
        }
      ],
      turns: [],
      pendingInteractions: [],
      cursor: "2"
    });
  });

  it("reports conversation-not-found for an unknown conversation", async () => {
    const response = await request(app).get("/api/conversations/missing/snapshot");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "conversation-not-found",
        message: "Conversation not found"
      }
    });
  });

  it("returns historical entries from snapshot without subscribing to SSE", async () => {
    const conversationView: ConversationViewRuntime = {
      getSnapshot: () => ({
        kind: "Found",
        snapshot: snapshotFixture({
          conversation: {
            id: "conv-history",
            contentRestore: {
              kind: "Restored"
            }
          },
          transcriptEntries: [
            entryFixture.userInput({
              id: "entry-1-user",
              sequence: 1,
              markdown: "history"
            }),
            entryFixture.agentReply({
              id: "entry-2-agent",
              sequence: 2,
              content: "restored history"
            })
          ],
          cursor: "2"
        })
      }),
      restoreConversationContent: async () => {},
      submitInput: async () => ({ kind: "ConversationNotFound" }),
      subscribeToEvents: () => {
        throw new Error("Snapshot endpoint must not subscribe to events");
      }
    };
    const snapshotOnlyApp = createApp({
      config: {
        host: "127.0.0.1",
        port: 0
      },
      conversationView
    });

    const response = await request(snapshotOnlyApp).get("/api/conversations/conv-history/snapshot");
    const snapshot = parseSnapshotResponse(response.body);

    expect(response.status).toBe(200);
    expect(snapshot).toEqual({
      conversation: {
        id: "conv-history",
        contentRestore: {
          kind: "Restored"
        }
      },
      transcriptEntries: [
        {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: "history"
          }
        },
        {
          id: "entry-2-agent",
          sequence: 2,
          body: {
            kind: "AgentReply",
            content: "restored history",
            stream: "Completed"
          }
        }
      ],
      turns: [],
      pendingInteractions: [],
      cursor: "2"
    });
  });
});
