import { describe, expect, it } from "vitest";
import { createConversationEventBus } from "./conversation-event-bus";
import type { ConversationStreamEvent } from "@my-code-x/app-types";

const event: ConversationStreamEvent = {
  id: "1",
  type: "content-restore.status-changed",
  data: {
    status: {
      kind: "Restored"
    }
  }
};

describe("ConversationEventBus", () => {
  it("publishes events to subscribers of the same conversation", () => {
    const bus = createConversationEventBus();
    const received: ConversationStreamEvent[] = [];

    bus.subscribe({
      conversationId: "conv-1",
      subscriber: {
        publish(receivedEvent) {
          received.push(receivedEvent);
        }
      }
    });
    bus.publish({
      conversationId: "conv-1",
      event
    });

    expect(received).toEqual([event]);
  });

  it("does not publish events to other conversations", () => {
    const bus = createConversationEventBus();
    const received: ConversationStreamEvent[] = [];

    bus.subscribe({
      conversationId: "conv-2",
      subscriber: {
        publish(receivedEvent) {
          received.push(receivedEvent);
        }
      }
    });
    bus.publish({
      conversationId: "conv-1",
      event
    });

    expect(received).toEqual([]);
  });

  it("stops publishing to closed subscriptions", () => {
    const bus = createConversationEventBus();
    const received: ConversationStreamEvent[] = [];
    const subscription = bus.subscribe({
      conversationId: "conv-1",
      subscriber: {
        publish(receivedEvent) {
          received.push(receivedEvent);
        }
      }
    });

    subscription.close();
    bus.publish({
      conversationId: "conv-1",
      event
    });

    expect(received).toEqual([]);
  });
});
