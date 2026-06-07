import { describe, expect, it } from "vitest";
import type { ConversationStreamEvent } from "@my-code-x/app-types";
import { createConversationEventBus } from "./conversation-event-bus";
import { createInMemoryConversationStore } from "./in-memory-conversation-store";
import { createRestoreConversationContentService } from "./restore-conversation-content-service";

describe("RestoreConversationContentService", () => {
  it("restores classified history and publishes restore status transitions", async () => {
    const store = createInMemoryConversationStore([
      {
        id: "conv-restore",
        contentRestore: {
          kind: "RestoredEmpty"
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "0"
      }
    ]);
    const eventBus = createConversationEventBus();
    const events: ConversationStreamEvent[] = [];
    eventBus.subscribe({
      conversationId: "conv-restore",
      subscriber: {
        publish(event) {
          events.push(event);
        }
      }
    });
    const service = createRestoreConversationContentService({
      store,
      eventBus,
      agentCli: {
        async restoreContent() {
          return {
            kind: "Restored",
            items: ["raw-user"]
          };
        },
        classifyInformation(input) {
          expect(input).toEqual({
            conversationId: "conv-restore",
            raw: "raw-user"
          });

          return {
            entryId: "entry-1-user",
            body: {
              kind: "UserInput",
              markdown: "hello"
            }
          };
        }
      }
    });

    await service.restore("conv-restore");

    expect(store.get("conv-restore")).toEqual({
      id: "conv-restore",
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
        }
      ],
      turns: [],
      pendingInteractions: [],
      cursor: "2"
    });
    expect(events).toEqual([
      {
        id: "1",
        type: "content-restore.status-changed",
        data: {
          status: {
            kind: "Restoring"
          }
        }
      },
      {
        id: "2",
        type: "content-restore.status-changed",
        data: {
          status: {
            kind: "Restored"
          }
        }
      }
    ]);
  });

  it("does not start a duplicate restore while the conversation is already restoring", async () => {
    const store = createInMemoryConversationStore([
      {
        id: "conv-restore",
        contentRestore: {
          kind: "Restoring"
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "7"
      }
    ]);
    const eventBus = createConversationEventBus();
    const events: ConversationStreamEvent[] = [];
    let restoreCallCount = 0;
    eventBus.subscribe({
      conversationId: "conv-restore",
      subscriber: {
        publish(event) {
          events.push(event);
        }
      }
    });
    const service = createRestoreConversationContentService({
      store,
      eventBus,
      agentCli: {
        async restoreContent() {
          restoreCallCount += 1;
          return {
            kind: "RestoredEmpty"
          };
        },
        classifyInformation() {
          throw new Error("Duplicate restore must not classify history");
        }
      }
    });

    await service.restore("conv-restore");

    expect(restoreCallCount).toBe(0);
    expect(events).toEqual([]);
    expect(store.get("conv-restore")).toEqual({
      id: "conv-restore",
      contentRestore: {
        kind: "Restoring"
      },
      transcriptEntries: [],
      turns: [],
      pendingInteractions: [],
      cursor: "7"
    });
  });
});
