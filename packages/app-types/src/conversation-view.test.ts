import { describe, expect, it } from "vitest";
import {
  type ConversationSnapshot,
  conversationStreamEventSchema,
  conversationSnapshotSchema,
  entryBodySchema,
  inputSendOutcomeSchema,
  transcriptEntrySchema
} from "./conversation-view";
import { entryFixture, snapshotFixture, turnFixture } from "./conversation-view.fixtures";

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

  it("builds valid transcript entry fixtures for every phase 2 entry body", () => {
    const entries = [
      entryFixture.userInput({
        id: "entry-user",
        sequence: 1,
        markdown: "你好"
      }),
      entryFixture.agentReply({
        id: "entry-agent",
        sequence: 2,
        content: "完成",
        stream: "InProgress"
      }),
      entryFixture.workProgress({
        id: "entry-work",
        sequence: 3,
        nativeType: "reasoning",
        nativeStatus: "running",
        detail: {
          text: "thinking"
        }
      }),
      entryFixture.failure({
        id: "entry-failure",
        sequence: 4,
        message: "Unknown error",
        detail: {
          code: "E_UNKNOWN"
        }
      }),
      entryFixture.unrecognized({
        id: "entry-unrecognized",
        sequence: 5,
        nativeStatus: "future",
        detail: {
          rawType: "future-event"
        }
      })
    ];

    const parsedEntries = entries.map((entry) => transcriptEntrySchema.parse(entry));

    expect(parsedEntries.map((entry) => entry.body.kind)).toEqual([
      "UserInput",
      "AgentReply",
      "WorkProgress",
      "Failure",
      "Unrecognized"
    ]);
  });

  it("accepts an empty restored conversation snapshot", () => {
    const snapshot = conversationSnapshotSchema.parse({
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

  it("accepts all phase 2 content restore status variants in snapshots", () => {
    const snapshots = [
      snapshotFixture({
        conversation: {
          id: "conv-restoring",
          contentRestore: {
            kind: "Restoring"
          }
        }
      }),
      snapshotFixture({
        conversation: {
          id: "conv-restored",
          contentRestore: {
            kind: "Restored"
          }
        }
      }),
      snapshotFixture({
        conversation: {
          id: "conv-empty",
          contentRestore: {
            kind: "RestoredEmpty"
          }
        }
      }),
      snapshotFixture({
        conversation: {
          id: "conv-failed",
          contentRestore: {
            kind: "RestoreFailed"
          }
        }
      })
    ];

    const parsedStatuses = snapshots.map(
      (snapshot) =>
        conversationSnapshotSchema.parse(snapshot).conversation.contentRestore.kind
    );

    expect(parsedStatuses).toEqual([
      "Restoring",
      "Restored",
      "RestoredEmpty",
      "RestoreFailed"
    ]);
  });

  it("accepts a conversation snapshot with ordinary transcript entries", () => {
    const snapshot = conversationSnapshotSchema.parse({
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
    const snapshotInput: ConversationSnapshot = snapshotFixture({
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
    const snapshot = conversationSnapshotSchema.parse(snapshotInput);

    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.pendingInteractions).toHaveLength(2);
  });

  it("builds valid turn fixtures for in-progress and completed turns", () => {
    const snapshot = conversationSnapshotSchema.parse(
      snapshotFixture({
        transcriptEntries: [
          entryFixture.userInput({
            id: "entry-1-user"
          }),
          entryFixture.agentReply({
            id: "entry-2-agent"
          })
        ],
        turns: [
          turnFixture.inProgress({
            id: "turn-in-progress",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-06T06:00:00.000Z"
          }),
          turnFixture.completed({
            id: "turn-completed",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-06T06:00:00.000Z",
            lastAgentReplyRef: "entry-2-agent",
            lastReplyCompletedTime: "2026-06-06T06:01:00.000Z"
          })
        ]
      })
    );

    expect(snapshot.turns).toEqual([
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
          firstUserInputRef: "entry-1-user",
          userInputTime: "2026-06-06T06:00:00.000Z",
          lastAgentReplyRef: "entry-2-agent",
          lastReplyCompletedTime: "2026-06-06T06:01:00.000Z"
        }
      }
    ]);
  });

  it("rejects snapshots with malformed turn state", () => {
    const result = conversationSnapshotSchema.safeParse({
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
