import type { ContentRestoreStatus } from "@my-code-x/app-types";
import type {
  ClassificationResult,
  ContentRestoreOutcome,
  RestoreAgentContentInput
} from "../agent-cli/agent-cli-ports";
import type { ConversationEventBus } from "./conversation-event-bus";
import { nextConversationCursor } from "./conversation-cursor";
import type {
  ConversationRecordStore,
  RuntimeConversationRecord
} from "./in-memory-conversation-store";

export interface ConversationAgentCliAdapter {
  restoreContent(input: RestoreAgentContentInput): Promise<ContentRestoreOutcome>;
  classifyInformation(input: { conversationId: string; raw: unknown }): ClassificationResult;
}

export interface RestoreConversationContentService {
  restore(conversationId: string): Promise<void>;
}

export interface CreateRestoreConversationContentServiceInput {
  store: ConversationRecordStore;
  agentCli: ConversationAgentCliAdapter;
  eventBus: ConversationEventBus;
}

export function createRestoreConversationContentService(
  input: CreateRestoreConversationContentServiceInput
): RestoreConversationContentService {
  function publishContentRestoreStatusChanged(
    record: RuntimeConversationRecord,
    status: ContentRestoreStatus
  ): void {
    input.eventBus.publish({
      conversationId: record.id,
      event: {
        id: record.cursor,
        type: "content-restore.status-changed",
        data: {
          status
        }
      }
    });
  }

  function startRestore(record: RuntimeConversationRecord): RuntimeConversationRecord | null {
    if (record.contentRestore.kind === "Restoring") {
      return null;
    }

    const restoringRecord: RuntimeConversationRecord = {
      ...record,
      contentRestore: {
        kind: "Restoring"
      },
      cursor: nextConversationCursor(record.cursor)
    };

    input.store.replace(restoringRecord);
    publishContentRestoreStatusChanged(restoringRecord, restoringRecord.contentRestore);

    return restoringRecord;
  }

  function appendRestoredItems(
    record: RuntimeConversationRecord,
    items: unknown[],
    turns: RuntimeConversationRecord["turns"] = record.turns
  ): RuntimeConversationRecord {
    const transcriptEntries = [...record.transcriptEntries];

    for (const item of items) {
      const classified = input.agentCli.classifyInformation({
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
      cursor: record.cursor
    };
  }

  function completeRestore(
    record: RuntimeConversationRecord,
    nextRecord: RuntimeConversationRecord
  ): void {
    const cursor = nextConversationCursor(record.cursor);
    const completedRecord = {
      ...nextRecord,
      cursor
    };

    input.store.replace(completedRecord);
    publishContentRestoreStatusChanged(completedRecord, completedRecord.contentRestore);
  }

  return {
    async restore(conversationId) {
      const record = input.store.get(conversationId);

      if (record === undefined) {
        return;
      }

      const restoringRecord = startRestore(record);
      if (restoringRecord === null) {
        return;
      }

      const outcome = await input.agentCli.restoreContent({ conversationId });

      if (outcome.kind === "RestoredEmpty") {
        completeRestore(restoringRecord, {
          ...restoringRecord,
          contentRestore: {
            kind: "RestoredEmpty"
          }
        });
        return;
      }

      if (outcome.kind === "RestoreFailed") {
        completeRestore(restoringRecord, {
          ...restoringRecord,
          contentRestore: {
            kind: "RestoreFailed"
          }
        });
        return;
      }

      if (outcome.kind === "Restored") {
        completeRestore(
          restoringRecord,
          appendRestoredItems(restoringRecord, outcome.items, outcome.turns)
        );
      }
    }
  };
}
