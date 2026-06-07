import { describe, expect, it } from "vitest";
import { createCodexAgentCliAdapter } from "../agent-cli/codex-agent-cli-adapter";
import {
  createConversationViewRuntime,
  type ContentRestorePort,
  type ConversationViewRuntime
} from "./conversation-view-runtime";

function createRestoringRuntime(contentRestorePort: ContentRestorePort): ConversationViewRuntime {
  return createConversationViewRuntime({
    conversations: [
      {
        id: "conv-restore",
        contentRestore: {
          kind: "Restoring"
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "0"
      }
    ],
    contentRestorePort
  });
}

function createCodexRestoringRuntime(historyItems: unknown[]): ConversationViewRuntime {
  return createRestoringRuntime(
    createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return historyItems;
        }
      }
    })
  );
}

function createCodexRestoringRuntimeFromHistory(history: {
  items: unknown[];
  turns: unknown[];
}): ConversationViewRuntime {
  return createRestoringRuntime(
    createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return history;
        }
      }
    })
  );
}

describe("Conversation content restore", () => {
  it("marks a conversation as RestoredEmpty when agent history is empty", async () => {
    const runtime = createRestoringRuntime({
      async restoreContent() {
        return {
          kind: "RestoredEmpty"
        };
      }
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "RestoredEmpty"
          }
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "0"
      }
    });
  });

  it("marks a conversation as RestoreFailed when history restore fails", async () => {
    const runtime = createRestoringRuntime({
      async restoreContent() {
        return {
          kind: "RestoreFailed",
          message: "agent cli failed"
        };
      }
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "RestoreFailed"
          }
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "0"
      }
    });
  });

  it("marks a conversation as Restored when agent history has items", async () => {
    const runtime = createRestoringRuntime({
      async restoreContent() {
        return {
          kind: "Restored",
          items: [{ type: "userMessage", id: "raw-1" }]
        };
      }
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [],
        turns: [],
        pendingInteractions: [],
        cursor: "0"
      }
    });
  });

  it("restores a Codex user message as a UserInput transcript entry", async () => {
    const runtime = createCodexRestoringRuntime([
      {
        type: "userMessage",
        id: "entry-1-user",
        content: [{ type: "text", text: "restored hello" }]
      }
    ]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
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
              markdown: "restored hello"
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "1"
      }
    });
  });

  it("restores a Codex agent message as a completed AgentReply transcript entry", async () => {
    const runtime = createCodexRestoringRuntime([
      {
        type: "agentMessage",
        id: "entry-1-agent",
        text: "restored answer",
        phase: null
      }
    ]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "entry-1-agent",
            sequence: 1,
            body: {
              kind: "AgentReply",
              content: "restored answer",
              stream: "Completed"
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "1"
      }
    });
  });

  it("restores Codex work progress with native type status and detail", async () => {
    const rawWorkProgress = {
      type: "commandExecution",
      id: "entry-1-work",
      status: "completed",
      command: "pwd"
    };
    const runtime = createCodexRestoringRuntime([rawWorkProgress]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "entry-1-work",
            sequence: 1,
            body: {
              kind: "WorkProgress",
              nativeType: "commandExecution",
              nativeStatus: "completed",
              detail: rawWorkProgress
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "1"
      }
    });
  });

  it("restores a Codex failure without message as Unknown error", async () => {
    const rawFailure = {
      turnId: "turn-1",
      error: {}
    };
    const runtime = createCodexRestoringRuntime([rawFailure]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "turn-1:error:1",
            sequence: 1,
            body: {
              kind: "Failure",
              message: "Unknown error",
              detail: rawFailure
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "1"
      }
    });
  });

  it("restores a content-like Codex item with stable id as Unrecognized", async () => {
    const rawUnrecognized = {
      type: "newFutureContent",
      id: "entry-1-unknown",
      status: "opaque",
      payload: {
        value: 42
      }
    };
    const runtime = createCodexRestoringRuntime([rawUnrecognized]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "entry-1-unknown",
            sequence: 1,
            body: {
              kind: "Unrecognized",
              detail: rawUnrecognized
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "1"
      }
    });
  });

  it("restores multiple Codex failures as separate transcript entries", async () => {
    const firstFailure = {
      turnId: "turn-1",
      error: {
        message: "first failure"
      }
    };
    const secondFailure = {
      turnId: "turn-1",
      error: {
        message: "second failure"
      }
    };
    const runtime = createCodexRestoringRuntime([firstFailure, secondFailure]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "turn-1:error:1",
            sequence: 1,
            body: {
              kind: "Failure",
              message: "first failure",
              detail: firstFailure
            }
          },
          {
            id: "turn-1:error:2",
            sequence: 2,
            body: {
              kind: "Failure",
              message: "second failure",
              detail: secondFailure
            }
          }
        ],
        turns: [],
        pendingInteractions: [],
        cursor: "2"
      }
    });
  });

  it("restores mixed Codex history in occurrence order", async () => {
    const rawUserInput = {
      type: "userMessage",
      id: "entry-user",
      content: [{ type: "text", text: "first" }]
    };
    const rawWorkProgress = {
      type: "commandExecution",
      id: "entry-work",
      status: "completed",
      command: "pwd"
    };
    const rawAgentReply = {
      type: "agentMessage",
      id: "entry-agent",
      text: "third",
      phase: null
    };
    const runtime = createCodexRestoringRuntime([rawUserInput, rawWorkProgress, rawAgentReply]);

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
          contentRestore: {
            kind: "Restored"
          }
        },
        transcriptEntries: [
          {
            id: "entry-user",
            sequence: 1,
            body: {
              kind: "UserInput",
              markdown: "first"
            }
          },
          {
            id: "entry-work",
            sequence: 2,
            body: {
              kind: "WorkProgress",
              nativeType: "commandExecution",
              nativeStatus: "completed",
              detail: rawWorkProgress
            }
          },
          {
            id: "entry-agent",
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

  it("restores a completed turn into the conversation snapshot", async () => {
    const runtime = createRestoringRuntime({
      async restoreContent() {
        return {
          kind: "Restored",
          items: [],
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
            }
          ]
        };
      }
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
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
          }
        ],
        pendingInteractions: [],
        cursor: "0"
      }
    });
  });

  it("restores an in-progress turn into the conversation snapshot", async () => {
    const runtime = createRestoringRuntime({
      async restoreContent() {
        return {
          kind: "Restored",
          items: [],
          turns: [
            {
              id: "turn-in-progress",
              status: {
                kind: "InProgress",
                firstUserInputRef: "entry-1-user",
                userInputTime: "2026-06-06T06:02:00.000Z"
              }
            }
          ]
        };
      }
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
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
              userInputTime: "2026-06-06T06:02:00.000Z"
            }
          }
        ],
        pendingInteractions: [],
        cursor: "0"
      }
    });
  });

  it("restores Codex history turns through the snapshot read path", async () => {
    const runtime = createCodexRestoringRuntimeFromHistory({
      items: [
        {
          type: "userMessage",
          id: "entry-1-user",
          content: [{ type: "text", text: "hello" }]
        },
        {
          type: "agentMessage",
          id: "entry-2-agent",
          text: "hello back",
          phase: null
        }
      ],
      turns: [
        {
          id: "turn-1",
          status: "completed",
          startedAt: 1780584491,
          completedAt: 1780584550,
          items: [
            {
              id: "entry-1-user",
              type: "userMessage"
            },
            {
              id: "entry-2-agent",
              type: "agentMessage"
            }
          ]
        }
      ]
    });

    await runtime.restoreConversationContent("conv-restore");

    expect(runtime.getSnapshot("conv-restore")).toEqual({
      kind: "Found",
      snapshot: {
        conversation: {
          id: "conv-restore",
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
              content: "hello back",
              stream: "Completed"
            }
          }
        ],
        turns: [
          {
            id: "turn-1",
            status: {
              kind: "Completed",
              firstUserInputRef: "entry-1-user",
              userInputTime: "2026-06-04T14:48:11.000Z",
              lastAgentReplyRef: "entry-2-agent",
              lastReplyCompletedTime: "2026-06-04T14:49:10.000Z"
            }
          }
        ],
        pendingInteractions: [],
        cursor: "2"
      }
    });
  });
});
