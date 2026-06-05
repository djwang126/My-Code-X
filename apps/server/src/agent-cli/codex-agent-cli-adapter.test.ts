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

function completedItemNotifications(notifications: JsonRpcNotificationFixture[]) {
  return notifications.filter((notification) => notification.method === "item/completed");
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

    const turnSignals = notifications
      .map((notification) =>
        adapter.interpretTurnSignal({
          conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
          raw: notification.params
        })
      )
      .filter((signal) => signal.kind !== "NoTurnSignal");

    const classifiedEntries = completedItemNotifications(notifications).map((notification) =>
      adapter.classifyInformation({
        conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
        raw: notification.params,
        streamHint: "Completed"
      })
    );

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
        raw: startedAgentMessage.params,
        streamHint: "InProgress"
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

    const classifiedHistory = historyItems.map((raw) =>
      adapter.classifyInformation({
        conversationId: "019e931b-2ae7-7992-8084-0c11959eeab3",
        raw
      })
    );
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
