import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app";
import { withListeningServer } from "../test-support/http-server";
import {
  expectedEntryAddedEvents,
  openNoEventGuard,
  openSseCollector
} from "../test-support/sse";
import { createTestConversationViewRuntime } from "../test-support/conversation-view-runtime";
import type { ConversationViewRuntime } from "./conversation-view-runtime";

function createTestApp() {
  return createApp({
    config: {
      host: "127.0.0.1",
      port: 0
    },
    conversationView: createTestConversationViewRuntime()
  });
}

describe("Conversation View event stream API", () => {
  interface ReceivedEventSubscriptionInput {
    conversationId: string;
    afterCursor: string | undefined;
  }

  function createCursorRecordingApp(receivedInputs: ReceivedEventSubscriptionInput[]) {
    const conversationView: ConversationViewRuntime = {
      getSnapshot: () => ({ kind: "ConversationNotFound" }),
      restoreConversationContent: async () => {},
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
