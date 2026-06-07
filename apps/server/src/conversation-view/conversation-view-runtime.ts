import type {
  ContentRestoreStatus,
  ConversationSnapshot,
  ConversationStreamEvent,
  EntryBody,
  Interaction,
  TranscriptEntry
} from "@my-code-x/app-types";
import type {
  ClassificationResult,
  ContentRestoreOutcome,
  RestoreAgentContentInput
} from "../agent-cli/agent-cli-ports";
import { createConversationSnapshotReader } from "./conversation-snapshot-reader";

export type ConversationSnapshotResult =
  | { kind: "Found"; snapshot: ConversationSnapshot }
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
  restoreConversationContent(conversationId: string): Promise<void>;
  submitInput(input: SubmitConversationInput): Promise<SubmitConversationInputResult>;
  subscribeToEvents(input: SubscribeToConversationEventsInput): SubscribeToConversationEventsResult;
}

export interface RuntimeConversationRecord {
  id: string;
  contentRestore: ContentRestoreStatus;
  transcriptEntries: TranscriptEntry[];
  turns: ConversationSnapshot["turns"];
  pendingInteractions: Interaction[];
  cursor: string;
}

export interface ContentRestorePort {
  restoreContent(input: RestoreAgentContentInput): Promise<ContentRestoreOutcome>;
  classifyInformation?(input: { conversationId: string; raw: unknown }): ClassificationResult;
}

export interface CreateConversationViewRuntimeInput {
  conversations: RuntimeConversationRecord[];
  contentRestorePort: ContentRestorePort;
}

const defaultConversations: Record<string, RuntimeConversationRecord> = {
  "conv-empty": {
    id: "conv-empty",
    contentRestore: {
      kind: "RestoredEmpty"
    },
    transcriptEntries: [],
    turns: [],
    pendingInteractions: [],
    cursor: "0"
  },
  "conv-seeded": {
    id: "conv-seeded",
    contentRestore: {
      kind: "Restored"
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
  return createConversationViewRuntime({
    conversations: Object.values(structuredClone(defaultConversations)),
    contentRestorePort: {
      async restoreContent() {
        return { kind: "RestoredEmpty" };
      }
    }
  });
}

export function createConversationViewRuntime(
  input: CreateConversationViewRuntimeInput
): ConversationViewRuntime {
  const conversations: Record<string, RuntimeConversationRecord> = Object.fromEntries(
    input.conversations.map((conversation) => [conversation.id, structuredClone(conversation)])
  );
  const subscribersByConversation = new Map<string, Set<ConversationEventSubscriber>>();

  function getConversationRecord(conversationId: string): RuntimeConversationRecord {
    const record = conversations[conversationId];

    if (record === undefined) {
      throw new Error(`Conversation record not found: ${conversationId}`);
    }

    return record;
  }

  const snapshotReader = createConversationSnapshotReader({
    conversations: {
      exists(conversationId) {
        return conversations[conversationId] !== undefined;
      }
    },
    contentRestore: {
      getStatus(conversationId) {
        return getConversationRecord(conversationId).contentRestore;
      }
    },
    transcriptEntries: {
      listByConversation(conversationId) {
        return getConversationRecord(conversationId).transcriptEntries;
      }
    },
    turns: {
      listByConversation(conversationId) {
        return getConversationRecord(conversationId).turns;
      }
    },
    pendingInteractions: {
      listByConversation(conversationId) {
        return getConversationRecord(conversationId).pendingInteractions;
      }
    },
    cursors: {
      getCursor(conversationId) {
        return getConversationRecord(conversationId).cursor;
      }
    }
  });

  function appendEntryBodies(
    record: RuntimeConversationRecord,
    bodies: EntryBody[]
  ): { record: RuntimeConversationRecord; appendedEntries: TranscriptEntry[] } {
    const nextEntries: TranscriptEntry[] = [...record.transcriptEntries];
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
      record: {
        ...record,
        contentRestore: {
          kind: "Restored"
        },
        transcriptEntries: nextEntries,
        cursor: String(nextEntries.length)
      },
      appendedEntries
    };
  }

  function appendRestoredItems(
    record: RuntimeConversationRecord,
    items: unknown[],
    turns: RuntimeConversationRecord["turns"] = record.turns
  ): RuntimeConversationRecord {
    if (input.contentRestorePort.classifyInformation === undefined) {
      return {
        ...record,
        contentRestore: {
          kind: "Restored"
        },
        turns
      };
    }

    const transcriptEntries = [...record.transcriptEntries];

    for (const item of items) {
      const classified = input.contentRestorePort.classifyInformation({
        conversationId: record.id,
        raw: item
      });

      if (classified === null) {
        continue;
      }

      transcriptEntries.push({
        id: classified.entryId,
        sequence: transcriptEntries.length + 1,
        body: classified.body
      });
    }

    return {
      ...record,
      contentRestore: {
        kind: "Restored"
      },
      transcriptEntries,
      turns,
      cursor: String(transcriptEntries.length)
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
      return snapshotReader.getSnapshot(conversationId);
    },
    async restoreConversationContent(conversationId) {
      const record = conversations[conversationId];

      if (record === undefined) {
        return;
      }

      const outcome = await input.contentRestorePort.restoreContent({ conversationId });

      if (outcome.kind === "RestoredEmpty") {
        conversations[conversationId] = {
          ...record,
          contentRestore: {
            kind: "RestoredEmpty"
          }
        };
        return;
      }

      if (outcome.kind === "RestoreFailed") {
        conversations[conversationId] = {
          ...record,
          contentRestore: {
            kind: "RestoreFailed"
          }
        };
        return;
      }

      if (outcome.kind === "Restored") {
        conversations[conversationId] = appendRestoredItems(record, outcome.items, outcome.turns);
      }
    },
    async submitInput(input) {
      const record = conversations[input.conversationId];

      if (record === undefined) {
        return { kind: "ConversationNotFound" };
      }

      if (input.markdownSource === "") {
        return { kind: "EmptyInput" };
      }

      const result = appendEntryBodies(record, [
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
      conversations[input.conversationId] = result.record;
      publishEntryAddedEvents(input.conversationId, result.appendedEntries);

      return { kind: "Accepted" };
    },
    subscribeToEvents(input) {
      if (conversations[input.conversationId] === undefined) {
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
