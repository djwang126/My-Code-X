import request from "supertest";
import { createServer, get } from "node:http";
import { describe, expect, it } from "vitest";
import { createApp } from "./create-app";
import type { ConversationViewRuntime } from "./conversation-view/conversation-view-runtime";

const app = createApp({
  config: {
    host: "127.0.0.1",
    port: 0
  }
});

interface ParsedSseEvent {
  event: string;
  id: string;
  data: unknown;
}

interface SseCollector {
  opened: Promise<void>;
  events: Promise<ParsedSseEvent[]>;
  close(): void;
}

function createTestApp() {
  return createApp({
    config: {
      host: "127.0.0.1",
      port: 0
    }
  });
}

async function withListeningServer(
  testApp: ReturnType<typeof createApp>,
  run: (baseUrl: string) => Promise<void>
) {
  const server = createServer(testApp);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected server to listen on a TCP address");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function parseSseFrame(frame: string): ParsedSseEvent {
  const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
  const idLine = frame.split("\n").find((line) => line.startsWith("id: "));
  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));

  if (eventLine === undefined || idLine === undefined || dataLine === undefined) {
    throw new Error(`Malformed SSE frame: ${frame}`);
  }

  return {
    event: eventLine.slice("event: ".length),
    id: idLine.slice("id: ".length),
    data: JSON.parse(dataLine.slice("data: ".length)) as unknown
  };
}

function takeCompletedSseEvents(buffer: string): { events: ParsedSseEvent[]; remaining: string } {
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() ?? "";

  return {
    events: parts.filter((part) => part.length > 0).map(parseSseFrame),
    remaining
  };
}

function openSseCollector(url: string, expectedCount: number): SseCollector {
  let openedResolve!: () => void;
  let openedReject!: (error: unknown) => void;
  const opened = new Promise<void>((resolve, reject) => {
    openedResolve = resolve;
    openedReject = reject;
  });

  let eventsResolve!: (events: ParsedSseEvent[]) => void;
  let eventsReject!: (error: unknown) => void;
  const events = new Promise<ParsedSseEvent[]>((resolve, reject) => {
    eventsResolve = resolve;
    eventsReject = reject;
  });

  let settled = false;
  let buffer = "";
  const collected: ParsedSseEvent[] = [];

  const clientRequest = get(url, (response) => {
    try {
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      openedResolve();
    } catch (error) {
      settled = true;
      openedReject(error);
      eventsReject(error);
      clientRequest.destroy();
      return;
    }

    response.on("data", (chunk: Buffer) => {
      try {
        buffer += chunk.toString("utf8");
        const parsed = takeCompletedSseEvents(buffer);
        buffer = parsed.remaining;
        collected.push(...parsed.events);

        if (collected.length !== expectedCount) {
          return;
        }

        settled = true;
        eventsResolve(collected);
        clientRequest.destroy();
      } catch (error) {
        settled = true;
        eventsReject(error);
        clientRequest.destroy();
      }
    });
  });

  clientRequest.on("error", (error: NodeJS.ErrnoException) => {
    if (settled && error.code === "ECONNRESET") {
      return;
    }

    openedReject(error);
    eventsReject(error);
  });

  return {
    opened,
    events,
    close() {
      settled = true;
      clientRequest.destroy();
    }
  };
}

function openNoEventGuard(url: string, unexpectedEventMessage: string) {
  let openedResolve!: () => void;
  let openedReject!: (error: unknown) => void;
  const opened = new Promise<void>((resolve, reject) => {
    openedResolve = resolve;
    openedReject = reject;
  });

  let unexpectedEventReject!: (error: unknown) => void;
  const unexpectedEvent = new Promise<never>((_resolve, reject) => {
    unexpectedEventReject = reject;
  });

  let buffer = "";
  const clientRequest = get(url, (response) => {
    try {
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      openedResolve();
    } catch (error) {
      openedReject(error);
      clientRequest.destroy();
      return;
    }

    response.on("data", (chunk: Buffer) => {
      try {
        buffer += chunk.toString("utf8");
        const parsed = takeCompletedSseEvents(buffer);
        buffer = parsed.remaining;

        for (const event of parsed.events) {
          unexpectedEventReject(new Error(`${unexpectedEventMessage}: ${event.event}`));
        }
      } catch (error) {
        unexpectedEventReject(error);
        clientRequest.destroy();
      }
    });
  });

  clientRequest.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "ECONNRESET") {
      return;
    }

    openedReject(error);
  });

  return {
    opened,
    unexpectedEvent,
    close() {
      clientRequest.destroy();
    }
  };
}

function expectedEntryAddedEvents(markdownSource: string): ParsedSseEvent[] {
  return [
    {
      event: "transcript.entry-added",
      id: "1",
      data: {
        entry: {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: markdownSource
          }
        }
      }
    },
    {
      event: "transcript.entry-added",
      id: "2",
      data: {
        entry: {
          id: "entry-2-agent",
          sequence: 2,
          body: {
            kind: "AgentReply",
            content: `echo: ${markdownSource}`,
            stream: "Completed"
          }
        }
      }
    }
  ];
}

describe("server walking skeleton", () => {
  it("reports health using the API contract response shape", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok"
    });
  });

  it("publishes a deterministic walking skeleton SSE event", async () => {
    const server = createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP address");
    }

    await new Promise<void>((resolve, reject) => {
      const clientRequest = get(
        `http://127.0.0.1:${address.port}/api/walking-skeleton/events`,
        (response) => {
          let body = "";
          let serverEndedStream = false;

          expect(response.statusCode).toBe(200);
          expect(response.headers["content-type"]).toContain("text/event-stream");

          response.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");

            if (body !== 'event: walking-skeleton.ready\nid: 1\ndata: {"status":"ready"}\n\n') {
              return;
            }

            setImmediate(() => {
              try {
                expect(serverEndedStream).toBe(false);
                clientRequest.destroy();
                server.close((error) => {
                  if (error) {
                    reject(error);
                    return;
                  }

                  resolve();
                });
              } catch (error) {
                reject(error);
              }
            });
          });

          response.on("end", () => {
            serverEndedStream = true;
          });
        }
      );

      clientRequest.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNRESET") {
          return;
        }

        reject(error);
      });
    });
  });

  it("reports malformed JSON using the API contract error shape", async () => {
    const response = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "malformed-request",
        message: "Malformed request"
      }
    });
  });
});

describe("Conversation View snapshot API", () => {
  it("returns an empty conversation snapshot", async () => {
    const response = await request(app).get("/api/conversations/conv-empty/snapshot");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
});

describe("Conversation View input API", () => {
  function createIsolatedApp() {
    return createApp({
      config: {
        host: "127.0.0.1",
        port: 0
      }
    });
  }

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
    const response = await request(createIsolatedApp()).post("/api/conversations/conv-empty/inputs").send({
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
    const response = await request(createIsolatedApp()).post("/api/conversations/conv-empty/inputs").send({});

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
    const response = await request(createIsolatedApp()).post("/api/conversations/missing/inputs").send({
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

describe("Conversation View event stream API", () => {
  interface ReceivedEventSubscriptionInput {
    conversationId: string;
    afterCursor: string | undefined;
  }

  function createCursorRecordingApp(receivedInputs: ReceivedEventSubscriptionInput[]) {
    const conversationView: ConversationViewRuntime = {
      getSnapshot: () => ({ kind: "ConversationNotFound" }),
      submitInput: async () => ({ kind: "ConversationNotFound" }),
      subscribeToEvents(input) {
        receivedInputs.push({
          conversationId: input.conversationId,
          afterCursor: input.afterCursor
        });

        return { kind: "ConversationNotFound" };
      }
    };

    return createApp({
      config: {
        host: "127.0.0.1",
        port: 0
      },
      conversationView
    });
  }

  it("passes the after query cursor to the event subscription port", async () => {
    const receivedInputs: ReceivedEventSubscriptionInput[] = [];
    const response = await request(createCursorRecordingApp(receivedInputs)).get(
      "/api/conversations/conv-events/events?after=cursor-42"
    );

    expect(response.status).toBe(404);
    expect(receivedInputs).toEqual([
      {
        conversationId: "conv-events",
        afterCursor: "cursor-42"
      }
    ]);
  });

  it("uses Last-Event-ID before the after query cursor", async () => {
    const receivedInputs: ReceivedEventSubscriptionInput[] = [];
    const response = await request(createCursorRecordingApp(receivedInputs))
      .get("/api/conversations/conv-events/events?after=query-cursor")
      .set("Last-Event-ID", "header-cursor");

    expect(response.status).toBe(404);
    expect(receivedInputs).toEqual([
      {
        conversationId: "conv-events",
        afterCursor: "header-cursor"
      }
    ]);
  });

  it("reports conversation-not-found for an unknown conversation event stream", async () => {
    const response = await request(createTestApp()).get("/api/conversations/missing/events");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "conversation-not-found",
        message: "Conversation not found"
      }
    });
  });

  it("publishes transcript entry added events when input is accepted", async () => {
    await withListeningServer(createTestApp(), async (baseUrl) => {
      const collector = openSseCollector(`${baseUrl}/api/conversations/conv-empty/events`, 2);
      await collector.opened;

      const postResponse = await request(baseUrl).post("/api/conversations/conv-empty/inputs").send({
        markdownSource: "hello"
      });

      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toEqual({
        outcome: "Accepted"
      });
      expect(await collector.events).toEqual(expectedEntryAddedEvents("hello"));
    });
  });

  it("broadcasts transcript entry added events to every subscriber", async () => {
    await withListeningServer(createTestApp(), async (baseUrl) => {
      const firstSubscriber = openSseCollector(`${baseUrl}/api/conversations/conv-empty/events`, 2);
      const secondSubscriber = openSseCollector(`${baseUrl}/api/conversations/conv-empty/events`, 2);
      await Promise.all([firstSubscriber.opened, secondSubscriber.opened]);

      const postResponse = await request(baseUrl).post("/api/conversations/conv-empty/inputs").send({
        markdownSource: "hello"
      });

      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toEqual({
        outcome: "Accepted"
      });
      await expect(firstSubscriber.events).resolves.toEqual(expectedEntryAddedEvents("hello"));
      await expect(secondSubscriber.events).resolves.toEqual(expectedEntryAddedEvents("hello"));
    });
  });

  it("does not leak transcript events across conversations", async () => {
    await withListeningServer(createTestApp(), async (baseUrl) => {
      const targetSubscriber = openSseCollector(`${baseUrl}/api/conversations/conv-empty/events`, 2);
      const otherSubscriber = openNoEventGuard(
        `${baseUrl}/api/conversations/conv-seeded/events`,
        "conv-seeded subscriber received an event for conv-empty"
      );
      await Promise.all([targetSubscriber.opened, otherSubscriber.opened]);

      const postResponse = await request(baseUrl).post("/api/conversations/conv-empty/inputs").send({
        markdownSource: "hello"
      });

      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toEqual({
        outcome: "Accepted"
      });
      const targetEvents = await Promise.race([
        targetSubscriber.events,
        otherSubscriber.unexpectedEvent
      ]);
      expect(targetEvents).toEqual(expectedEntryAddedEvents("hello"));
      otherSubscriber.close();
    });
  });
});
