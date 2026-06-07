import { describe, expect, it } from "vitest";
import { entryFixture, snapshotFixture, turnFixture } from "@my-code-x/app-types/test-fixtures";
import {
  createConversationSnapshotReader,
  type CreateConversationSnapshotReaderInput
} from "./conversation-snapshot-reader";
import type { ConversationSnapshot } from "@my-code-x/app-types";

function createReaderInputFromSnapshots(
  snapshots: ConversationSnapshot[] = []
): CreateConversationSnapshotReaderInput {
  const snapshotsByConversation = new Map(
    snapshots.map((snapshot) => [snapshot.conversation.id, snapshot])
  );

  return {
    conversations: {
      exists(conversationId) {
        return snapshotsByConversation.has(conversationId);
      }
    },
    contentRestore: {
      getStatus(conversationId) {
        return snapshotsByConversation.get(conversationId)!.conversation.contentRestore;
      }
    },
    transcriptEntries: {
      listByConversation(conversationId) {
        return snapshotsByConversation.get(conversationId)!.transcriptEntries;
      }
    },
    turns: {
      listByConversation(conversationId) {
        return snapshotsByConversation.get(conversationId)!.turns;
      }
    },
    pendingInteractions: {
      listByConversation(conversationId) {
        return snapshotsByConversation.get(conversationId)!.pendingInteractions;
      }
    },
    cursors: {
      getCursor(conversationId) {
        return snapshotsByConversation.get(conversationId)!.cursor;
      }
    }
  };
}

describe("ConversationSnapshotReader", () => {
  it("returns content restore status and empty snapshot collections", () => {
    const readerInput = createReaderInputFromSnapshots([
      snapshotFixture({
        conversation: {
          id: "conv-restoring",
          contentRestore: {
            kind: "Restoring"
          }
        },
        cursor: "7"
      })
    ]);
    const reader = createConversationSnapshotReader(readerInput);

    const result = reader.getSnapshot("conv-restoring");

    expect(result).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restoring",
          contentRestore: {
            kind: "Restoring"
          }
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "7"
      }
    });
  });

  it("returns transcript entries ordered by sequence", () => {
    const readerInput = createReaderInputFromSnapshots([
      snapshotFixture({
        conversation: {
          id: "conv-seeded",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          entryFixture.agentReply({
            id: "entry-3-agent",
            sequence: 3,
            content: "third"
          }),
          entryFixture.userInput({
            id: "entry-1-user",
            sequence: 1,
            markdown: "first"
          }),
          entryFixture.agentReply({
            id: "entry-2-agent",
            sequence: 2,
            content: "second"
          })
        ],
        cursor: "3"
      })
    ]);
    const reader = createConversationSnapshotReader(readerInput);

    const result = reader.getSnapshot("conv-seeded");

    expect(result).toEqual({
      kind: "Found",
      snapshot: {
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
              markdown: "first"
            }
          },
          {
            id: "entry-2-agent",
            sequence: 2,
            body: {
              kind: "AgentReply",
              content: "second",
              stream: "Completed"
            }
          },
          {
            id: "entry-3-agent",
            sequence: 3,
            body: {
              kind: "AgentReply",
              content: "third",
              stream: "Completed"
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "3"
      }
    });
  });

  it("returns turns for toolbar rendering", () => {
    const readerInput = createReaderInputFromSnapshots([
      snapshotFixture({
        conversation: {
          id: "conv-turns",
          contentRestore: {
            kind: "Restored"
          }
        },
        turns: [
          turnFixture.completed({
            id: "turn-completed",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-06T06:00:00.000Z",
            lastAgentReplyRef: "entry-2-agent",
            lastReplyCompletedTime: "2026-06-06T06:01:00.000Z"
          }),
          turnFixture.inProgress({
            id: "turn-in-progress",
            firstUserInputRef: "entry-3-user",
            userInputTime: "2026-06-06T06:02:00.000Z"
          })
        ],
        cursor: "4"
      })
    ]);
    const reader = createConversationSnapshotReader(readerInput);

    const result = reader.getSnapshot("conv-turns");

    expect(result).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-turns",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [],
        turns: [
          {
            id: "turn-completed",
            status: {
              kind: "Completed",
              firstUserInputRef: "entry-1-user",
              userInputTime: "2026-06-06T06:00:00.000Z",
              lastAgentReplyRef: "entry-2-agent",
              lastReplyCompletedTime: "2026-06-06T06:01:00.000Z"
            }
          },
          {
            id: "turn-in-progress",
            status: {
              kind: "InProgress",
              firstUserInputRef: "entry-3-user",
              userInputTime: "2026-06-06T06:02:00.000Z"
            }
          }
        ],
        pendingInteractions: [],
        cursor: "4"
      }
    });
  });

  it("reports conversation not found for unknown conversations", () => {
    const reader = createConversationSnapshotReader(createReaderInputFromSnapshots());

    const result = reader.getSnapshot("missing");

    expect(result).toEqual({
      kind: "ConversationNotFound"
    });
  });
});
