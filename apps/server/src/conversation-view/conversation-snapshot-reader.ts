import type {
  ContentRestoreStatus,
  ConversationSnapshot,
  Interaction,
  TranscriptEntry,
  Turn
} from "@my-code-x/app-types";

export type ConversationSnapshotResult =
  | { kind: "Found"; snapshot: ConversationSnapshot }
  | { kind: "ConversationNotFound" };

export interface ConversationRepository {
  exists(conversationId: string): boolean;
}

export interface ContentRestoreReadRepository {
  getStatus(conversationId: string): ContentRestoreStatus;
}

export interface TranscriptEntryReadRepository {
  listByConversation(conversationId: string): TranscriptEntry[];
}

export interface TurnReadRepository {
  listByConversation(conversationId: string): Turn[];
}

export interface PendingInteractionReadRepository {
  listByConversation(conversationId: string): Interaction[];
}

export interface ConversationCursorReadRepository {
  getCursor(conversationId: string): string;
}

export interface CreateConversationSnapshotReaderInput {
  conversations: ConversationRepository;
  contentRestore: ContentRestoreReadRepository;
  transcriptEntries: TranscriptEntryReadRepository;
  turns: TurnReadRepository;
  pendingInteractions: PendingInteractionReadRepository;
  cursors: ConversationCursorReadRepository;
}

export interface ConversationSnapshotReader {
  getSnapshot(conversationId: string): ConversationSnapshotResult;
}

export function createConversationSnapshotReader(
  input: CreateConversationSnapshotReaderInput
): ConversationSnapshotReader {
  return {
    getSnapshot(conversationId) {
      if (!input.conversations.exists(conversationId)) {
        return { kind: "ConversationNotFound" };
      }

      return {
        kind: "Found",
        snapshot: {
          conversation: {
            id: conversationId,
            contentRestore: input.contentRestore.getStatus(conversationId)
          },
          transcriptEntries: [...input.transcriptEntries.listByConversation(conversationId)].sort(
            byEntrySequence
          ),
          turns: input.turns.listByConversation(conversationId),
          pendingInteractions: input.pendingInteractions.listByConversation(conversationId),
          cursor: input.cursors.getCursor(conversationId)
        }
      };
    }
  };
}

function byEntrySequence(left: TranscriptEntry, right: TranscriptEntry): number {
  return left.sequence - right.sequence;
}
