import type { ConversationStreamEvent } from "@my-code-x/app-types";

export interface ConversationEventSubscriber {
  publish(event: ConversationStreamEvent): void;
}

export interface ConversationEventSubscription {
  close(): void;
}

export interface SubscribeToConversationEventBusInput {
  conversationId: string;
  subscriber: ConversationEventSubscriber;
}

export interface PublishConversationEventInput {
  conversationId: string;
  event: ConversationStreamEvent;
}

export interface ConversationEventBus {
  subscribe(input: SubscribeToConversationEventBusInput): ConversationEventSubscription;
  publish(input: PublishConversationEventInput): void;
}

export function createConversationEventBus(): ConversationEventBus {
  const subscribersByConversation = new Map<string, Set<ConversationEventSubscriber>>();

  return {
    subscribe(input) {
      let subscribers = subscribersByConversation.get(input.conversationId);

      if (subscribers === undefined) {
        subscribers = new Set();
        subscribersByConversation.set(input.conversationId, subscribers);
      }

      subscribers.add(input.subscriber);

      return {
        close() {
          subscribers.delete(input.subscriber);
        }
      };
    },

    publish(input) {
      const subscribers = subscribersByConversation.get(input.conversationId);

      if (subscribers === undefined) {
        return;
      }

      for (const subscriber of subscribers) {
        subscriber.publish(input.event);
      }
    }
  };
}
