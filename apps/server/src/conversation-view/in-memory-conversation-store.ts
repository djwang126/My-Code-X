import type {
  ContentRestoreStatus,
  ConversationSnapshot,
  Interaction,
  TranscriptEntry
} from "@my-code-x/app-types";

export interface RuntimeConversationRecord {
  id: string;
  contentRestore: ContentRestoreStatus;
  transcriptEntries: TranscriptEntry[];
  turns: ConversationSnapshot["turns"];
  pendingInteractions: Interaction[];
  cursor: string;
}

export interface ConversationRecordStore {
  exists(conversationId: string): boolean;
  get(conversationId: string): RuntimeConversationRecord | undefined;
  replace(record: RuntimeConversationRecord): void;
}

export function createInMemoryConversationStore(
  initialConversations: RuntimeConversationRecord[]
): ConversationRecordStore {
  const conversations: Record<string, RuntimeConversationRecord> = Object.fromEntries(
    initialConversations.map((conversation) => [conversation.id, structuredClone(conversation)])
  );

  return {
    exists(conversationId) {
      return conversations[conversationId] !== undefined;
    },

    get(conversationId) {
      const record = conversations[conversationId];

      if (record === undefined) {
        return undefined;
      }

      return structuredClone(record);
    },

    replace(record) {
      conversations[record.id] = structuredClone(record);
    }
  };
}
