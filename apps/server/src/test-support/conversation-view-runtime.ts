import {
  createConversationViewRuntime,
  type ConversationViewRuntime
} from "../conversation-view/conversation-view-runtime";
import type { RuntimeConversationRecord } from "../conversation-view/in-memory-conversation-store";

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

export function createTestConversationViewRuntime(): ConversationViewRuntime {
  return createConversationViewRuntime({
    conversations: Object.values(structuredClone(defaultConversations)),
    agentCli: {
      async restoreContent() {
        return { kind: "RestoredEmpty" };
      },
      classifyInformation() {
        return null;
      }
    }
  });
}
