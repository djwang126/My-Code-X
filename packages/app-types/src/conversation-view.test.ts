import { describe, expect, it } from "vitest";
import {
  conversationStreamEventSchema,
  conversationSnapshotViewSchema,
  entryBodySchema,
  inputSendOutcomeSchema,
  transcriptEntrySchema
} from "./conversation-view";

describe("Conversation View contract", () => {
  it("accepts ordinary user input and completed agent reply transcript entries", () => {
    const userInput = transcriptEntrySchema.parse({
      id: "entry-1-user",
      sequence: 1,
      body: {
        kind: "UserInput",
        markdown: "你好 Codex 👋"
      }
    });

    const agentReply = transcriptEntrySchema.parse({
      id: "entry-2-agent",
      sequence: 2,
      body: {
        kind: "AgentReply",
        content: "echo: 你好 Codex 👋",
        stream: "Completed"
      }
    });

    expect(userInput).toEqual({
      id: "entry-1-user",
      sequence: 1,
      body: {
        kind: "UserInput",
        markdown: "你好 Codex 👋"
      }
    });
    expect(agentReply).toEqual({
      id: "entry-2-agent",
      sequence: 2,
      body: {
        kind: "AgentReply",
        content: "echo: 你好 Codex 👋",
        stream: "Completed"
      }
    });
  });

  it("accepts work progress failure and unrecognized transcript entry bodies", () => {
    const workProgress = entryBodySchema.parse({
      kind: "WorkProgress",
      nativeType: "tool-call",
      nativeStatus: "running",
      detail: {
        toolName: "shell"
      }
    });
    const failure = entryBodySchema.parse({
      kind: "Failure",
      message: "Unknown error",
      detail: {
        code: "E_UNKNOWN"
      }
    });
    const unrecognized = entryBodySchema.parse({
      kind: "Unrecognized",
      nativeStatus: "mystery",
      detail: {
        rawType: "future-event"
      }
    });

    expect(workProgress).toEqual({
      kind: "WorkProgress",
      nativeType: "tool-call",
      nativeStatus: "running",
      detail: {
        toolName: "shell"
      }
    });
    expect(failure).toEqual({
      kind: "Failure",
      message: "Unknown error",
      detail: {
        code: "E_UNKNOWN"
      }
    });
    expect(unrecognized).toEqual({
      kind: "Unrecognized",
      nativeStatus: "mystery",
      detail: {
        rawType: "future-event"
      }
    });
  });

  it("accepts an empty restored conversation snapshot", () => {
    const snapshot = conversationSnapshotViewSchema.parse({
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
    });

    expect(snapshot).toEqual({
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
    });
  });

  it("accepts a conversation snapshot with ordinary transcript entries", () => {
    const snapshot = conversationSnapshotViewSchema.parse({
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
    });

    expect(snapshot).toEqual({
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
    });
  });

  it("accepts conversation snapshots with turn and pending interaction state", () => {
    const snapshot = conversationSnapshotViewSchema.parse({
      conversation: {
        id: "conv-active",
        contentRestore: {
          kind: "Restored"
        }
      },
      transcriptEntries: [],
      turns: [
        {
          id: "turn-in-progress",
          status: {
            kind: "InProgress",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-06T06:00:00.000Z"
          }
        },
        {
          id: "turn-completed",
          status: {
            kind: "Completed",
            firstUserInputRef: "entry-2-user",
            userInputTime: "2026-06-06T06:01:00.000Z",
            lastAgentReplyRef: "entry-3-agent",
            lastReplyCompletedTime: "2026-06-06T06:02:00.000Z"
          }
        }
      ],
      pendingInteractions: [
        {
          id: "interaction-1",
          sequence: 1,
          content: {
            prompt: "Pick an option",
            options: [
              {
                id: "yes",
                label: "Yes",
                requiresTextSupplement: false
              }
            ]
          },
          status: {
            kind: "Pending"
          }
        },
        {
          id: "interaction-2",
          sequence: 2,
          content: {
            prompt: "Confirm",
            options: [
              {
                id: "confirm",
                label: "Confirm",
                requiresTextSupplement: true
              }
            ]
          },
          status: {
            kind: "Resolved",
            acceptedResponse: {
              selectedOption: "confirm",
              textSupplement: "with context"
            }
          }
        }
      ],
      cursor: "5"
    });

    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.pendingInteractions).toHaveLength(2);
  });

  it("rejects snapshots with malformed turn state", () => {
    const result = conversationSnapshotViewSchema.safeParse({
      conversation: {
        id: "conv-bad-turn",
        contentRestore: {
          kind: "Restored"
        }
      },
      transcriptEntries: [],
      turns: [
        {
          id: "turn-bad",
          status: {
            kind: "Completed",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-06T06:00:00.000Z"
          }
        }
      ],
      pendingInteractions: [],
      cursor: "1"
    });

    expect(result.success).toBe(false);
  });

  it("accepts normal input send outcomes", () => {
    const accepted = inputSendOutcomeSchema.parse({
      outcome: "Accepted"
    });
    const sendFailed = inputSendOutcomeSchema.parse({
      outcome: "SendFailed",
      error: {
        message: "agent unavailable"
      }
    });

    expect(accepted).toEqual({
      outcome: "Accepted"
    });
    expect(sendFailed).toEqual({
      outcome: "SendFailed",
      error: {
        message: "agent unavailable"
      }
    });
  });

  it("accepts transcript entry added stream events", () => {
    const event = conversationStreamEventSchema.parse({
      id: "1",
      type: "transcript.entry-added",
      data: {
        entry: {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: "hello"
          }
        }
      }
    });

    expect(event).toEqual({
      id: "1",
      type: "transcript.entry-added",
      data: {
        entry: {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: "hello"
          }
        }
      }
    });
  });
});
