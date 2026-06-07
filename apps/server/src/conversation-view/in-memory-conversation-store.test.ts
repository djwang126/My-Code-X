import { describe, expect, it } from "vitest";
import {
  createInMemoryConversationStore,
  type RuntimeConversationRecord
} from "./in-memory-conversation-store";

const conversation: RuntimeConversationRecord = {
  id: "conv-1",
  contentRestore: {
    kind: "RestoredEmpty"
  },
  transcriptEntries: [],
  turns: [],
  pendingInteractions: [],
  cursor: "0"
};

describe("InMemoryConversationStore", () => {
  it("reports whether a conversation exists", () => {
    const store = createInMemoryConversationStore([conversation]);

    expect(store.exists("conv-1")).toBe(true);
    expect(store.exists("missing")).toBe(false);
  });

  it("returns undefined for missing conversations", () => {
    const store = createInMemoryConversationStore([]);

    expect(store.get("missing")).toBeUndefined();
  });

  it("replaces conversation records", () => {
    const store = createInMemoryConversationStore([conversation]);

    store.replace({
      ...conversation,
      contentRestore: {
        kind: "Restored"
      },
      cursor: "1"
    });

    expect(store.get("conv-1")).toEqual({
      ...conversation,
      contentRestore: {
        kind: "Restored"
      },
      cursor: "1"
    });
  });

  it("does not expose mutable internal records", () => {
    const store = createInMemoryConversationStore([conversation]);
    const retrieved = store.get("conv-1");
    if (retrieved === undefined) {
      throw new Error("Expected fixture conversation to exist");
    }

    retrieved.cursor = "99";

    expect(store.get("conv-1")).toEqual(conversation);
  });
});
