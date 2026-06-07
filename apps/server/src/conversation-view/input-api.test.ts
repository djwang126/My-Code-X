import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app";

function createIsolatedApp() {
  return createApp({
    config: {
      host: "127.0.0.1",
      port: 0
    }
  });
}

describe("Conversation View input API", () => {
  it("accepts normal input without changing the markdown source", async () => {
    const response = await request(createIsolatedApp())
      .post("/api/conversations/conv-empty/inputs")
      .send({
        markdownSource: "你好 Codex 👋\n第二行"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      outcome: "Accepted"
    });
  });

  it("rejects empty input", async () => {
    const response = await request(createIsolatedApp())
      .post("/api/conversations/conv-empty/inputs")
      .send({
        markdownSource: ""
      });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "empty-input",
        message: "Input must not be empty"
      }
    });
  });

  it("reports validation-failed when markdownSource is missing", async () => {
    const response = await request(createIsolatedApp())
      .post("/api/conversations/conv-empty/inputs")
      .send({});

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "validation-failed",
        message: "markdownSource is required"
      }
    });
  });

  it("reports validation-failed when markdownSource is not text", async () => {
    const response = await request(createIsolatedApp())
      .post("/api/conversations/conv-empty/inputs")
      .send({
        markdownSource: 42
      });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "validation-failed",
        message: "markdownSource must be a string"
      }
    });
  });

  it("reports conversation-not-found when posting to an unknown conversation", async () => {
    const response = await request(createIsolatedApp())
      .post("/api/conversations/missing/inputs")
      .send({
        markdownSource: "hello"
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "conversation-not-found",
        message: "Conversation not found"
      }
    });
  });

  it("makes accepted input visible through a later snapshot", async () => {
    const isolatedApp = createIsolatedApp();

    const postResponse = await request(isolatedApp).post("/api/conversations/conv-empty/inputs").send({
      markdownSource: "hello"
    });

    expect(postResponse.status).toBe(200);
    expect(postResponse.body).toEqual({
      outcome: "Accepted"
    });

    const snapshotResponse = await request(isolatedApp).get("/api/conversations/conv-empty/snapshot");

    expect(snapshotResponse.status).toBe(200);
    expect(snapshotResponse.body).toEqual({
      conversation: {
        id: "conv-empty",
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

  it("preserves UTF-8 CJK emoji and newlines through the echo round trip", async () => {
    const isolatedApp = createIsolatedApp();
    const markdownSource = "你好 Codex 👋\n第二行";

    const postResponse = await request(isolatedApp).post("/api/conversations/conv-empty/inputs").send({
      markdownSource
    });

    expect(postResponse.status).toBe(200);
    expect(postResponse.body).toEqual({
      outcome: "Accepted"
    });

    const snapshotResponse = await request(isolatedApp).get("/api/conversations/conv-empty/snapshot");

    expect(snapshotResponse.status).toBe(200);
    expect(snapshotResponse.body.transcriptEntries).toEqual([
      {
        id: "entry-1-user",
        sequence: 1,
        body: {
          kind: "UserInput",
          markdown: markdownSource
        }
      },
      {
        id: "entry-2-agent",
        sequence: 2,
        body: {
          kind: "AgentReply",
          content: `echo: ${markdownSource}`,
          stream: "Completed"
        }
      }
    ]);
  });
});
