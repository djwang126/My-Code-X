import type {
  ConversationSnapshot,
  ConversationStreamEvent,
  EntryBody,
  TranscriptEntry
} from "@my-code-x/app-types";
import { createConversationSnapshotReader } from "./conversation-snapshot-reader";
import {
  createConversationEventBus,
  type ConversationEventSubscriber,
  type ConversationEventSubscription
} from "./conversation-event-bus";
import { nextConversationCursor } from "./conversation-cursor";
import {
  createInMemoryConversationStore,
  type RuntimeConversationRecord
} from "./in-memory-conversation-store";
import {
  createRestoreConversationContentService,
  type ConversationAgentCliAdapter
} from "./restore-conversation-content-service";

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

export interface CreateConversationViewRuntimeInput {
  conversations: RuntimeConversationRecord[];
  agentCli: ConversationAgentCliAdapter;
}

interface AppendedEntryEvent {
  eventId: string;
  entry: TranscriptEntry;
}

export function createConversationViewRuntime(
  input: CreateConversationViewRuntimeInput
): ConversationViewRuntime {
  const store = createInMemoryConversationStore(input.conversations);
  const eventBus = createConversationEventBus();

  function getConversationRecord(conversationId: string): RuntimeConversationRecord {
    const record = store.get(conversationId);

    if (record === undefined) {
      throw new Error(`Conversation record not found: ${conversationId}`);
    }

    return record;
  }

  const snapshotReader = createConversationSnapshotReader({
    conversations: {
      exists(conversationId) {
        return store.exists(conversationId);
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
  const restoreService = createRestoreConversationContentService({
    store,
    agentCli: input.agentCli,
    eventBus
  });

  function appendEntryBodies(
    record: RuntimeConversationRecord,
    bodies: EntryBody[]
  ): { record: RuntimeConversationRecord; appendedEvents: AppendedEntryEvent[] } {
    const nextEntries: TranscriptEntry[] = [...record.transcriptEntries];
    const appendedEvents: AppendedEntryEvent[] = [];
    let cursor = record.cursor;

    for (const body of bodies) {
      const sequence = nextEntries.length + 1;
      const actor = body.kind === "UserInput" ? "user" : "agent";
      cursor = nextConversationCursor(cursor);

      const entry = {
        id: `entry-${sequence}-${actor}`,
        sequence,
        body
      };

      nextEntries.push(entry);
      appendedEvents.push({
        eventId: cursor,
        entry
      });
    }

    return {
      record: {
        ...record,
        contentRestore: {
          kind: "Restored"
        },
        transcriptEntries: nextEntries,
        cursor
      },
      appendedEvents
    };
  }

  function publishEvent(conversationId: string, event: ConversationStreamEvent) {
    eventBus.publish({
      conversationId,
      event
    });
  }

  function publishEntryAddedEvents(conversationId: string, events: AppendedEntryEvent[]) {
    for (const event of events) {
      publishEvent(conversationId, {
        id: event.eventId,
        type: "transcript.entry-added",
        data: {
          entry: event.entry
        }
      });
    }
  }

  return {
    getSnapshot(conversationId) {
      return snapshotReader.getSnapshot(conversationId);
    },
    async restoreConversationContent(conversationId) {
      await restoreService.restore(conversationId);
    },
    async submitInput(input) {
      const record = store.get(input.conversationId);

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
      store.replace(result.record);
      publishEntryAddedEvents(input.conversationId, result.appendedEvents);

      return { kind: "Accepted" };
    },
    subscribeToEvents(input) {
      if (!store.exists(input.conversationId)) {
        return { kind: "ConversationNotFound" };
      }

      return {
        kind: "Subscribed",
        subscription: eventBus.subscribe({
          conversationId: input.conversationId,
          subscriber: input.subscriber
        })
      };
    }
  };
}
