import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCodexAgentCliAdapter } from "./codex-agent-cli-adapter";

interface JsonRpcNotificationFixture {
  method: string;
  params: unknown;
}

interface CodexThreadResumeFixture {
  result: {
    thread: {
      turns: Array<{
        id: string;
        status: string;
        items: unknown[];
      }>;
    };
  };
}

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function readJsonlFixture(relativePath: string): JsonRpcNotificationFixture[] {
  return readFileSync(fixturePath(relativePath), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as JsonRpcNotificationFixture);
}

function readJsonFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(fixturePath(relativePath), "utf8")) as T;
}

function createAdapter(historyItems: unknown[] = []) {
  return createCodexAgentCliAdapter({
    historySource: {
      fetchHistory: async () => historyItems
    }
  });
}

function startedAgentMessageNotification(notifications: JsonRpcNotificationFixture[]) {
  const notification = notifications.find(
    (candidate) =>
      candidate.method === "item/started" &&
      typeof candidate.params === "object" &&
      candidate.params !== null &&
      "item" in candidate.params &&
      typeof candidate.params.item === "object" &&
      candidate.params.item !== null &&
      "type" in candidate.params.item &&
      candidate.params.item.type === "agentMessage"
  );

  if (notification === undefined) {
    throw new Error("Fixture must contain a started Codex agentMessage item");
  }

  return notification;
}

function resumeHistoryItems(fixture: CodexThreadResumeFixture): unknown[] {
  return fixture.result.thread.turns.flatMap((turn) => turn.items);
}

describe("CodexAgentCliAdapter", () => {
  it("translates the real Codex app-server live capture into classified information and turn signals", () => {
    const adapter = createAdapter();
    const notifications = readJsonlFixture(
      "./fixtures/codex/live-two-turn-file-command-revert.jsonl"
    );

    // Feed every notification through the adapter exactly as the live stream
    // delivers it (full method + params). The adapter — not the test — decides
    // routing: turn signals, transcript entries, or nothing.
    const turnSignals = notifications
      .map((notification) =>
        adapter.interpretTurnSignal({
          conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
          nativeMethod: notification.method,
          raw: notification.params
        })
      )
      .filter((signal) => signal.kind !== "NoTurnSignal");

    // The live stream emits item/started then item/completed for the same item.
    // Both classify into an entry sharing one entryId; the transcript upserts
    // by entryId (INV-2), so fold to the final state in first-seen order.
    const transcript = new Map<string, NonNullable<ReturnType<typeof adapter.classifyInformation>>>();
    for (const notification of notifications) {
      const entry = adapter.classifyInformation({
        conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
        nativeMethod: notification.method,
        raw: notification.params
      });
      if (entry !== null) {
        transcript.set(entry.entryId, entry);
      }
    }
    const classifiedEntries = [...transcript.values()];

    expect(turnSignals).toEqual([
      {
        kind: "TurnStarted",
        turnId: "019e931b-2b22-73c3-bd07-122c192a1187",
        firstUserInputRef: "e77486f4-f1b3-45f5-869c-7b0518bae3e8",
        userInputTime: "2026-06-04T14:48:11.000Z"
      },
      {
        kind: "TurnCompleted",
        turnId: "019e931b-2b22-73c3-bd07-122c192a1187",
        outcome: "Completed",
        lastAgentReplyRef: "msg_0a0434e09dee9bde016a219063233c81988ff29b0618a32a4b",
        lastReplyCompletedTime: "2026-06-04T14:49:10.000Z"
      },
      {
        kind: "TurnStarted",
        turnId: "019e931c-0ef9-7640-ac8f-ff8a9f7a964d",
        firstUserInputRef: "74103bfc-8d6b-46d8-8d87-66ac564539fb",
        userInputTime: "2026-06-04T14:49:10.000Z"
      },
      {
        kind: "TurnCompleted",
        turnId: "019e931c-0ef9-7640-ac8f-ff8a9f7a964d",
        outcome: "Completed",
        lastAgentReplyRef: "msg_096c834ec6a2ef25016a2190841d44819b9bdf98fef3a8411b",
        lastReplyCompletedTime: "2026-06-04T14:49:56.000Z"
      }
    ]);

    expect(classifiedEntries.map((entry) => entry.body.kind)).toEqual([
      "UserInput",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "UserInput",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply"
    ]);
    expect(classifiedEntries[0]).toEqual({
      entryId: "e77486f4-f1b3-45f5-869c-7b0518bae3e8",
      body: {
        kind: "UserInput",
        markdown:
          "请在当前项目根目录工作。\n先读取 cat.md 的当前内容。\n然后只在 cat.md 文件末尾新增一行：Fixture note: Codex app-server touched this file.\n再执行 harmless 命令 `pwd` 确认当前工作目录。\n请实际完成文件修改和命令执行，不要修改其他文件。完成后一句话说明。"
      }
    });
    expect(classifiedEntries[3]).toMatchObject({
      entryId: "call_5izIdK1ImbOmLYRGUVSD1SV7",
      body: {
        kind: "WorkProgress",
        nativeType: "commandExecution",
        nativeStatus: "completed"
      }
    });
    expect(classifiedEntries[5]).toMatchObject({
      entryId: "call_fLlQvFJL2TM0tqI9R6V7vLvv",
      body: {
        kind: "WorkProgress",
        nativeType: "fileChange",
        nativeStatus: "completed"
      }
    });
    expect(classifiedEntries[9]).toEqual({
      entryId: "msg_0a0434e09dee9bde016a219063233c81988ff29b0618a32a4b",
      body: {
        kind: "AgentReply",
        content:
          "已读取 `cat.md`，只在其末尾新增了 `Fixture note: Codex app-server touched this file.`，并执行 `pwd` 确认当前目录为 `D:\\workspaces\\AI-Tools\\My-Code-X-C`。",
        stream: "Completed"
      }
    });
    expect(classifiedEntries[16]).toEqual({
      entryId: "msg_096c834ec6a2ef25016a2190841d44819b9bdf98fef3a8411b",
      body: {
        kind: "AgentReply",
        content:
          "已撤回上一轮对 `cat.md` 的修改，只删除了指定的 `Fixture note` 行，未修改其他文件。",
        stream: "Completed"
      }
    });
  });

  it("uses the real Codex item lifecycle to mark a started agent reply as in progress", () => {
    const adapter = createAdapter();
    const notifications = readJsonlFixture(
      "./fixtures/codex/live-two-turn-file-command-revert.jsonl"
    );
    const startedAgentMessage = startedAgentMessageNotification(notifications);

    expect(
      adapter.classifyInformation({
        conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
        nativeMethod: startedAgentMessage.method,
        raw: startedAgentMessage.params
      })
    ).toEqual({
      entryId: "msg_0ffce87b780db953016a21903566f8819b8c261a38c93e2419",
      body: {
        kind: "AgentReply",
        content: "",
        stream: "InProgress"
      }
    });
  });

  it("restores the real Codex thread/resume turns as history items", async () => {
    const resumeResponse = readJsonFixture<CodexThreadResumeFixture>(
      "./fixtures/codex/resume-two-turn-file-command-revert.json"
    );
    const historyItems = resumeHistoryItems(resumeResponse);
    const adapter = createAdapter(historyItems);

    await expect(
      adapter.restoreContent({ conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3" })
    ).resolves.toEqual({
      kind: "Restored",
      items: historyItems
    });

    const classifiedHistory = historyItems.map((raw) => {
      const entry = adapter.classifyInformation({
        conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
        raw
      });
      if (entry === null) {
        throw new Error("Restored Codex history item must classify into a transcript entry");
      }
      return entry;
    });
    expect(classifiedHistory.map((entry) => entry.body.kind)).toEqual([
      "UserInput",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "UserInput",
      "AgentReply",
      "WorkProgress",
      "AgentReply",
      "WorkProgress",
      "AgentReply"
    ]);
    expect(classifiedHistory[0]).toMatchObject({
      entryId: "item-1",
      body: { kind: "UserInput" }
    });
    expect(classifiedHistory[4]).toMatchObject({
      entryId: "call_fLlQvFJL2TM0tqI9R6V7vLvv",
      body: {
        kind: "WorkProgress",
        nativeType: "fileChange",
        nativeStatus: "completed"
      }
    });
    expect(classifiedHistory[13]).toEqual({
      entryId: "item-9",
      body: {
        kind: "AgentReply",
        content:
          "已撤回上一轮对 `cat.md` 的修改，只删除了指定的 `Fixture note` 行，未修改其他文件。",
        stream: "Completed"
      }
    });
  });

  it("restores the real Codex thread/resume turns as completed conversation turns", async () => {
    const resumeResponse = readJsonFixture<CodexThreadResumeFixture>(
      "./fixtures/codex/resume-two-turn-file-command-revert.json"
    );
    const adapter = createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return {
            items: resumeHistoryItems(resumeResponse),
            turns: resumeResponse.result.thread.turns
          };
        }
      }
    });

    await expect(
      adapter.restoreContent({ conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3" })
    ).resolves.toMatchObject({
      kind: "Restored",
      turns: [
        {
          id: "019e931b-2b22-73c3-bd07-122c192a1187",
          status: {
            kind: "Completed",
            firstUserInputRef: "item-1",
            userInputTime: "2026-06-04T14:48:11.000Z",
            lastAgentReplyRef: "item-5",
            lastReplyCompletedTime: "2026-06-04T14:49:10.000Z"
          }
        },
        {
          id: "019e931c-0ef9-7640-ac8f-ff8a9f7a964d",
          status: {
            kind: "Completed",
            firstUserInputRef: "item-6",
            userInputTime: "2026-06-04T14:49:10.000Z",
            lastAgentReplyRef: "item-9",
            lastReplyCompletedTime: "2026-06-04T14:49:56.000Z"
          }
        }
      ]
    });
  });

  it("restores failed and interrupted Codex turns without requiring an agent reply", async () => {
    const adapter = createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return {
            items: [
              {
                type: "userMessage",
                id: "entry-1-user",
                content: [{ type: "text", text: "run risky command" }]
              },
              {
                type: "userMessage",
                id: "entry-2-user",
                content: [{ type: "text", text: "stop current work" }]
              }
            ],
            turns: [
              {
                id: "turn-failed",
                status: "failed",
                startedAt: 1780584491,
                completedAt: 1780584550,
                items: [
                  {
                    id: "entry-1-user",
                    type: "userMessage"
                  }
                ]
              },
              {
                id: "turn-interrupted",
                status: "interrupted",
                startedAt: 1780584551,
                completedAt: 1780584560,
                items: [
                  {
                    id: "entry-2-user",
                    type: "userMessage"
                  }
                ]
              }
            ]
          };
        }
      }
    });

    await expect(adapter.restoreContent({ conversationId: "thread-terminal" })).resolves.toEqual({
      kind: "Restored",
      items: [
        {
          type: "userMessage",
          id: "entry-1-user",
          content: [{ type: "text", text: "run risky command" }]
        },
        {
          type: "userMessage",
          id: "entry-2-user",
          content: [{ type: "text", text: "stop current work" }]
        }
      ],
      turns: [
        {
          id: "turn-failed",
          status: {
            kind: "Failed",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-04T14:48:11.000Z",
            completedTime: "2026-06-04T14:49:10.000Z",
            lastAgentReplyRef: null
          }
        },
        {
          id: "turn-interrupted",
          status: {
            kind: "Interrupted",
            firstUserInputRef: "entry-2-user",
            userInputTime: "2026-06-04T14:49:11.000Z",
            completedTime: "2026-06-04T14:49:20.000Z",
            lastAgentReplyRef: null
          }
        }
      ]
    });
  });

  it("keeps the last agent reply reference on failed or interrupted Codex turns when Codex provides one", async () => {
    const adapter = createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return {
            items: [
              {
                type: "userMessage",
                id: "entry-1-user",
                content: [{ type: "text", text: "continue" }]
              },
              {
                type: "agentMessage",
                id: "entry-2-agent",
                text: "partial answer",
                phase: null
              }
            ],
            turns: [
              {
                id: "turn-failed-with-reply",
                status: "failed",
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
          };
        }
      }
    });

    await expect(adapter.restoreContent({ conversationId: "thread-terminal" })).resolves.toMatchObject({
      kind: "Restored",
      turns: [
        {
          id: "turn-failed-with-reply",
          status: {
            kind: "Failed",
            firstUserInputRef: "entry-1-user",
            userInputTime: "2026-06-04T14:48:11.000Z",
            completedTime: "2026-06-04T14:49:10.000Z",
            lastAgentReplyRef: "entry-2-agent"
          }
        }
      ]
    });
  });

  it("does not restore a completed Codex turn without a final agent reply as a fake success", async () => {
    const adapter = createCodexAgentCliAdapter({
      historySource: {
        async fetchHistory() {
          return {
            items: [
              {
                type: "userMessage",
                id: "entry-1-user",
                content: [{ type: "text", text: "hello" }]
              }
            ],
            turns: [
              {
                id: "turn-completed-without-reply",
                status: "completed",
                startedAt: 1780584491,
                completedAt: 1780584550,
                items: [
                  {
                    id: "entry-1-user",
                    type: "userMessage"
                  }
                ]
              }
            ]
          };
        }
      }
    });

    await expect(adapter.restoreContent({ conversationId: "thread-terminal" })).resolves.toEqual({
      kind: "Restored",
      items: [
        {
          type: "userMessage",
          id: "entry-1-user",
          content: [{ type: "text", text: "hello" }]
        }
      ]
    });
  });

  it("interprets failed and interrupted live Codex turn completions without an agent reply", () => {
    const adapter = createAdapter();

    expect(
      adapter.interpretTurnSignal({
        conversationId: "thread-1",
        nativeMethod: "turn/completed",
        raw: {
          turn: {
            id: "turn-failed",
            status: "failed",
            startedAt: 1780584491,
            completedAt: 1780584550
          }
        }
      })
    ).toEqual({
      kind: "TurnCompleted",
      turnId: "turn-failed",
      outcome: "Failed",
      completedTime: "2026-06-04T14:49:10.000Z",
      lastAgentReplyRef: null
    });

    expect(
      adapter.interpretTurnSignal({
        conversationId: "thread-1",
        nativeMethod: "turn/completed",
        raw: {
          turn: {
            id: "turn-interrupted",
            status: "interrupted",
            startedAt: 1780584491,
            completedAt: 1780584550
          }
        }
      })
    ).toEqual({
      kind: "TurnCompleted",
      turnId: "turn-interrupted",
      outcome: "Interrupted",
      completedTime: "2026-06-04T14:49:10.000Z",
      lastAgentReplyRef: null
    });
  });

  it("keeps separate Codex failure entries when one turn receives multiple unattributed errors", () => {
    const adapter = createAdapter();
    const firstRaw = {
      error: {
        message: "model stream failed",
        codexErrorInfo: null,
        additionalDetails: "retry was disabled"
      },
      willRetry: false,
      threadId: "thread-1",
      turnId: "turn-1"
    };
    const secondRaw = {
      error: {
        message: "provider disconnected",
        codexErrorInfo: null,
        additionalDetails: null
      },
      willRetry: false,
      threadId: "thread-1",
      turnId: "turn-1"
    };

    expect([
      adapter.classifyInformation({ conversationId: "thread-1", raw: firstRaw }),
      adapter.classifyInformation({ conversationId: "thread-1", raw: secondRaw })
    ]).toEqual([
      {
        entryId: "turn-1:error:1",
        body: {
          kind: "Failure",
          message: "model stream failed",
          detail: firstRaw
        }
      },
      {
        entryId: "turn-1:error:2",
        body: {
          kind: "Failure",
          message: "provider disconnected",
          detail: secondRaw
        }
      }
    ]);
  });

  it("preserves native status when classifying unknown content-like Codex items", () => {
    const adapter = createAdapter();
    const raw = {
      type: "futureContent",
      id: "entry-future",
      status: "opaque",
      payload: {
        value: 42
      }
    };

    expect(adapter.classifyInformation({ conversationId: "thread-1", raw })).toEqual({
      entryId: "entry-future",
      body: {
        kind: "Unrecognized",
        nativeStatus: "opaque",
        detail: raw
      }
    });
  });

  it("reports empty and failed Codex history restores as explicit restore outcomes", async () => {
    await expect(
      createAdapter().restoreContent({ conversationId: "thread-empty" })
    ).resolves.toEqual({
      kind: "RestoredEmpty"
    });

    const adapter = createCodexAgentCliAdapter({
      historySource: {
        fetchHistory: async () => {
          throw new Error("session file missing");
        }
      }
    });

    await expect(
      adapter.restoreContent({ conversationId: "thread-missing" })
    ).resolves.toEqual({
      kind: "RestoreFailed",
      message: "session file missing"
    });
  });
});
