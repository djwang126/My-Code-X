import type {
  ConversationSnapshotView,
  ConversationStreamEvent,
  EntryBody,
  TranscriptEntry
} from "@my-code-x/app-types";

export type ConversationSnapshotResult =
  | { kind: "Found"; snapshot: ConversationSnapshotView }
  | { kind: "ConversationNotFound" };

export interface SubmitConversationInput {
  conversationId: string;
  markdownSource: string;
}

export type SubmitConversationInputResult =
  | { kind: "Accepted" }
  | { kind: "ConversationNotFound" }
  | { kind: "EmptyInput" };

export interface ConversationEventSubscriber {
  publish(event: ConversationStreamEvent): void;
}

export interface ConversationEventSubscription {
  close(): void;
}

export interface SubscribeToConversationEventsInput {
  conversationId: string;
  afterCursor?: string;
  subscriber: ConversationEventSubscriber;
}

export type SubscribeToConversationEventsResult =
  | { kind: "Subscribed"; subscription: ConversationEventSubscription }
  | { kind: "ConversationNotFound" };

export interface ConversationViewRuntime {
  getSnapshot(conversationId: string): ConversationSnapshotResult;
  submitInput(input: SubmitConversationInput): Promise<SubmitConversationInputResult>;
  subscribeToEvents(input: SubscribeToConversationEventsInput): SubscribeToConversationEventsResult;
}

const defaultSnapshots: Record<string, ConversationSnapshotView> = {
  "conv-empty": {
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
  },
  "conv-seeded": {
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
  }
};

export function createDefaultConversationViewRuntime(): ConversationViewRuntime {
  const snapshots: Record<string, ConversationSnapshotView> = structuredClone(defaultSnapshots);
  const subscribersByConversation = new Map<string, Set<ConversationEventSubscriber>>();

  function appendEntryBodies(
    snapshot: ConversationSnapshotView,
    bodies: EntryBody[]
  ): { snapshot: ConversationSnapshotView; appendedEntries: TranscriptEntry[] } {
    const nextEntries: TranscriptEntry[] = [...snapshot.transcriptEntries];
    const appendedEntries: TranscriptEntry[] = [];

    for (const body of bodies) {
      const sequence = nextEntries.length + 1;
      const actor = body.kind === "UserInput" ? "user" : "agent";

      const entry = {
        id: `entry-${sequence}-${actor}`,
        sequence,
        body
      };

      nextEntries.push(entry);
      appendedEntries.push(entry);
    }

    return {
      snapshot: {
        ...snapshot,
        conversation: {
          ...snapshot.conversation,
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: nextEntries,
        cursor: String(nextEntries.length)
      },
      appendedEntries
    };
  }

  function publishEntryAddedEvents(conversationId: string, entries: TranscriptEntry[]) {
    const subscribers = subscribersByConversation.get(conversationId);

    if (subscribers === undefined) {
      return;
    }

    for (const entry of entries) {
      const event: ConversationStreamEvent = {
        id: String(entry.sequence),
        type: "transcript.entry-added",
        data: {
          entry
        }
      };

      for (const subscriber of subscribers) {
        subscriber.publish(event);
      }
    }
  }

  return {
    getSnapshot(conversationId) {
      const snapshot = snapshots[conversationId];

      if (snapshot === undefined) {
        return { kind: "ConversationNotFound" };
      }

      return {
        kind: "Found",
        snapshot
      };
    },
    async submitInput(input) {
      const snapshot = snapshots[input.conversationId];

      if (snapshot === undefined) {
        return { kind: "ConversationNotFound" };
      }

      if (input.markdownSource === "") {
        return { kind: "EmptyInput" };
      }

      const result = appendEntryBodies(snapshot, [
        {
          kind: "UserInput",
          markdown: input.markdownSource
        },
        {
          kind: "AgentReply",
          content: `echo: ${input.markdownSource}`,
          stream: "Completed"
        }
      ]);
      snapshots[input.conversationId] = result.snapshot;
      publishEntryAddedEvents(input.conversationId, result.appendedEntries);

      return { kind: "Accepted" };
    },
    subscribeToEvents(input) {
      if (snapshots[input.conversationId] === undefined) {
        return { kind: "ConversationNotFound" };
      }

      let subscribers = subscribersByConversation.get(input.conversationId);

      if (subscribers === undefined) {
        subscribers = new Set();
        subscribersByConversation.set(input.conversationId, subscribers);
      }

      subscribers.add(input.subscriber);

      return {
        kind: "Subscribed",
        subscription: {
          close() {
            subscribers.delete(input.subscriber);
          }
        }
      };
    }
  };
}
