import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  createClaudeCodeAgentCliAdapter,
  createClaudeCodeSdkHistorySource
} from "./claude-code-agent-cli-adapter";

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function readJsonFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(fixturePath(relativePath), "utf8")) as T;
}

function readJsonlFixture<T>(relativePath: string): T[] {
  return readFileSync(fixturePath(relativePath), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as T);
}

function createAdapter(historyItems: unknown[] = []) {
  return createClaudeCodeAgentCliAdapter({
    historySource: {
      fetchHistory: async () => historyItems
    }
  });
}

function messagesOfType<T extends Record<string, unknown>>(
  messages: Record<string, unknown>[],
  type: string
): T[] {
  return messages.filter((message): message is T => message.type === type);
}

function firstMessage<T extends Record<string, unknown>>(
  messages: Record<string, unknown>[],
  predicate: (message: Record<string, unknown>) => boolean
): T {
  const message = messages.find(predicate);

  if (message === undefined) {
    throw new Error("Fixture does not contain the expected Claude Code message");
  }

  return message as T;
}

function contentTypes(message: Record<string, unknown>): string[] {
  const candidate = message.message;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("content" in candidate) ||
    !Array.isArray(candidate.content)
  ) {
    return [];
  }

  return candidate.content
    .filter((block): block is { type: string } => {
      return (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        typeof block.type === "string"
      );
    })
    .map((block) => block.type);
}

function firstTextBlock(message: Record<string, unknown>): string {
  const candidate = message.message;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("content" in candidate) ||
    !Array.isArray(candidate.content)
  ) {
    throw new Error("Fixture message has no content array");
  }

  const block = candidate.content.find((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
    );
  });

  if (block === undefined || typeof block !== "object" || !("text" in block)) {
    throw new Error("Fixture message has no text block");
  }

  return block.text as string;
}

describe("ClaudeCodeAgentCliAdapter", () => {
  it("translates the real Claude Code live capture into classified information", () => {
    const adapter = createAdapter();
    const liveMessages = readJsonlFixture<Record<string, unknown>>(
      "./fixtures/claude-code/live-two-turn-file-command-revert.jsonl"
    );

    const streamDelta = firstMessage(liveMessages, (message) => {
      return (
        message.type === "stream_event" &&
        typeof message.event === "object" &&
        message.event !== null &&
        "type" in message.event &&
        message.event.type === "content_block_delta"
      );
    });
    const firstAssistantText = firstMessage(liveMessages, (message) => {
      return message.type === "assistant" && contentTypes(message).includes("text");
    });
    const readToolUse = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("tool_use") &&
        JSON.stringify(message).includes("\"name\":\"Read\"")
      );
    });
    const editToolUse = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("tool_use") &&
        JSON.stringify(message).includes("\"name\":\"Edit\"")
      );
    });
    const bashToolUse = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("tool_use") &&
        JSON.stringify(message).includes("\"name\":\"Bash\"")
      );
    });
    const toolResult = firstMessage(liveMessages, (message) => {
      return message.type === "user" && contentTypes(message).includes("tool_result");
    });
    const finalReply = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("text") &&
        firstTextBlock(message).includes("Appended the fixture note")
      );
    });
    const successResult = messagesOfType<Record<string, unknown>>(
      liveMessages,
      "result"
    )[0];

    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: streamDelta
      })
    ).toMatchObject({
      entryId: "f7c25fc9-3c64-40b8-93d4-92d8c0ba399f",
      body: {
        kind: "WorkProgress",
        nativeType: "stream_event",
        nativeStatus: "content_block_delta"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: firstAssistantText
      })
    ).toEqual({
      entryId: "8214708b-dc87-47a0-a5a4-28dfa8f302bc",
      body: {
        kind: "AgentReply",
        content: "I'll start by reading cat.md.",
        stream: "Completed"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: readToolUse
      })
    ).toMatchObject({
      entryId: "da232c93-0136-4128-8215-2a39847d6ec0",
      body: {
        kind: "WorkProgress",
        nativeType: "assistant.tool_use",
        nativeStatus: "Read"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: editToolUse
      })
    ).toMatchObject({
      entryId: "4384494f-5cfc-4109-a5ed-64105ed8f892",
      body: {
        kind: "WorkProgress",
        nativeType: "assistant.tool_use",
        nativeStatus: "Edit"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: bashToolUse
      })
    ).toMatchObject({
      entryId: "2ce14fcf-20df-4745-8e07-fa7869c2c7d6",
      body: {
        kind: "WorkProgress",
        nativeType: "assistant.tool_use",
        nativeStatus: "Bash"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: toolResult
      })
    ).toMatchObject({
      entryId: "fe2ff377-e1b8-45eb-875f-724e387ae0ce",
      body: {
        kind: "WorkProgress",
        nativeType: "user.tool_result",
        nativeStatus: "tooluse_Fqb1Sv4nhZrkPhif7BSr72"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: finalReply
      })
    ).toEqual({
      entryId: "cc7877dc-e3b6-400c-9084-41b07d08c22a",
      body: {
        kind: "AgentReply",
        content: "Appended the fixture note to cat.md and confirmed Node.js v24.14.0.",
        stream: "Completed"
      }
    });
    expect(
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: successResult
      })
    ).toMatchObject({
      entryId: "45d5b2ea-6b2d-4014-90e7-b3709e9a8dce",
      body: {
        kind: "Unrecognized"
      }
    });
  });

  it("uses a local submitted entry plus real Claude Code live messages to produce turn signals", () => {
    const adapter = createAdapter();
    const liveMessages = readJsonlFixture<Record<string, unknown>>(
      "./fixtures/claude-code/live-two-turn-file-command-revert.jsonl"
    );
    const firstFinalReply = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("text") &&
        firstTextBlock(message).includes("Appended the fixture note")
      );
    });
    const [firstResult, secondResult] = messagesOfType<Record<string, unknown>>(
      liveMessages,
      "result"
    );
    const secondFinalReply = firstMessage(liveMessages, (message) => {
      return (
        message.type === "assistant" &&
        contentTypes(message).includes("text") &&
        firstTextBlock(message).includes("Removed the fixture note")
      );
    });

    const startedFirst = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: {
        source: "my-code-x",
        type: "localUserSubmitted",
        entryId: "local-first-user-entry",
        submittedAt: "2026-06-04T15:49:11.928Z"
      }
    });
    const firstReplySeen = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: firstFinalReply
    });
    const completedFirst = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: firstResult
    });
    const startedSecond = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: {
        source: "my-code-x",
        type: "localUserSubmitted",
        entryId: "local-second-user-entry",
        submittedAt: "2026-06-04T15:49:35.259Z"
      }
    });
    const secondReplySeen = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: secondFinalReply
    });
    const completedSecond = adapter.interpretTurnSignal({
      conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
      raw: secondResult
    });

    expect([
      startedFirst,
      firstReplySeen,
      completedFirst,
      startedSecond,
      secondReplySeen,
      completedSecond
    ]).toEqual([
      {
        kind: "TurnStarted",
        turnId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:local-first-user-entry",
        firstUserInputRef: "local-first-user-entry",
        userInputTime: "2026-06-04T15:49:11.928Z"
      },
      { kind: "NoTurnSignal" },
      {
        kind: "TurnCompleted",
        turnId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:local-first-user-entry",
        outcome: "Completed",
        lastAgentReplyRef: "cc7877dc-e3b6-400c-9084-41b07d08c22a",
        lastReplyCompletedTime: "2026-06-04T15:49:26.666Z"
      },
      {
        kind: "TurnStarted",
        turnId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:local-second-user-entry",
        firstUserInputRef: "local-second-user-entry",
        userInputTime: "2026-06-04T15:49:35.259Z"
      },
      { kind: "NoTurnSignal" },
      {
        kind: "TurnCompleted",
        turnId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:local-second-user-entry",
        outcome: "Completed",
        lastAgentReplyRef: "55169c05-ddae-4ca0-aae0-9a026987b713",
        lastReplyCompletedTime: "2026-06-04T15:49:50.703Z"
      }
    ]);
  });

  it("does not infer a Claude Code live turn start from SDK output alone", () => {
    const adapter = createAdapter();
    const liveMessages = readJsonlFixture<Record<string, unknown>>(
      "./fixtures/claude-code/live-two-turn-file-command-revert.jsonl"
    );
    const resultMessage = messagesOfType<Record<string, unknown>>(
      liveMessages,
      "result"
    )[0];

    expect(
      adapter.interpretTurnSignal({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw: resultMessage
      })
    ).toEqual({ kind: "NoTurnSignal" });
  });

  it("restores and classifies real Claude Code session messages captured after resume", async () => {
    const historyItems = readJsonFixture<unknown[]>(
      "./fixtures/claude-code/resume-two-turn-file-command-revert.json"
    );
    const adapter = createAdapter(historyItems);

    await expect(
      adapter.restoreContent({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3"
      })
    ).resolves.toEqual({
      kind: "Restored",
      items: historyItems
    });

    const classifiedEntries = historyItems.map((raw) =>
      adapter.classifyInformation({
        conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
        raw
      })
    );

    expect(classifiedEntries.map((entry) => entry.body.kind)).toEqual([
      "UserInput",
      "AgentReply",
      "WorkProgress",
      "WorkProgress",
      "WorkProgress",
      "WorkProgress",
      "WorkProgress",
      "WorkProgress",
      "AgentReply",
      "UserInput",
      "WorkProgress",
      "WorkProgress",
      "AgentReply"
    ]);
    expect(classifiedEntries[0]).toEqual({
      entryId: "122bb96d-8496-4e01-a8d5-c877bb3551a8",
      body: {
        kind: "UserInput",
        markdown:
          "You are generating a deterministic My-Code-X fixture.\nWork only in the current repository.\nFirst read cat.md.\nThen append exactly this line to cat.md: Fixture note: Claude Agent SDK touched this file.\nThen run harmless command `node --version`.\nDo not modify any other file.\nAfter completing the file edit and command, reply in one sentence."
      }
    });
    expect(classifiedEntries[2]).toMatchObject({
      entryId: "da232c93-0136-4128-8215-2a39847d6ec0",
      body: {
        kind: "WorkProgress",
        nativeType: "assistant.tool_use",
        nativeStatus: "Read"
      }
    });
    expect(classifiedEntries[5]).toMatchObject({
      entryId: "2ce14fcf-20df-4745-8e07-fa7869c2c7d6",
      body: {
        kind: "WorkProgress",
        nativeType: "assistant.tool_use",
        nativeStatus: "Bash"
      }
    });
    expect(classifiedEntries[8]).toEqual({
      entryId: "cc7877dc-e3b6-400c-9084-41b07d08c22a",
      body: {
        kind: "AgentReply",
        content: "Appended the fixture note to cat.md and confirmed Node.js v24.14.0.",
        stream: "Completed"
      }
    });
    expect(classifiedEntries[12]).toEqual({
      entryId: "55169c05-ddae-4ca0-aae0-9a026987b713",
      body: {
        kind: "AgentReply",
        content: "Removed the fixture note line, restoring cat.md to its original content.",
        stream: "Completed"
      }
    });
  });

  it("starts turns from real Claude Code restored user messages when timestamps are available", () => {
    const adapter = createAdapter();
    const historyItems = readJsonFixture<Record<string, unknown>[]>(
      "./fixtures/claude-code/resume-two-turn-file-command-revert.json"
    );
    const userMessages = messagesOfType<Record<string, unknown>>(historyItems, "user").filter(
      (message) => contentTypes(message).includes("text")
    );

    expect(
      userMessages.map((raw) =>
        adapter.interpretTurnSignal({
          conversationId: "3f549aa9-6c7a-4591-bfaa-8308323bcdf3",
          raw
        })
      )
    ).toEqual([
      {
        kind: "TurnStarted",
        turnId:
          "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:122bb96d-8496-4e01-a8d5-c877bb3551a8",
        firstUserInputRef: "122bb96d-8496-4e01-a8d5-c877bb3551a8",
        userInputTime: "2026-06-04T15:49:11.928Z"
      },
      {
        kind: "TurnStarted",
        turnId:
          "3f549aa9-6c7a-4591-bfaa-8308323bcdf3:turn:f486335f-42bb-4db6-b613-994211b26aee",
        firstUserInputRef: "f486335f-42bb-4db6-b613-994211b26aee",
        userInputTime: "2026-06-04T15:49:35.259Z"
      }
    ]);
  });

  it("reports empty and failed Claude Code history restores as explicit restore outcomes", async () => {
    await expect(
      createAdapter().restoreContent({ conversationId: "session-empty" })
    ).resolves.toEqual({
      kind: "RestoredEmpty"
    });

    const adapter = createClaudeCodeAgentCliAdapter({
      historySource: {
        fetchHistory: async () => {
          throw new Error("session missing");
        }
      }
    });

    await expect(
      adapter.restoreContent({ conversationId: "session-missing" })
    ).resolves.toEqual({
      kind: "RestoreFailed",
      message: "session missing"
    });
  });

  it("restores Claude Code history from getSessionMessages by session id", async () => {
    const calls: Array<{ sessionId: string; dir?: string }> = [];
    const historyItems: SessionMessage[] = [
      {
        type: "user",
        uuid: "user-message-1",
        session_id: "session-1",
        parent_tool_use_id: null,
        message: { role: "user", content: "history" }
      }
    ];
    const historySource = createClaudeCodeSdkHistorySource({
      projectDir: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      sessionReader: {
        getSessionMessages: async (sessionId, options) => {
          calls.push(
            options?.dir === undefined ? { sessionId } : { sessionId, dir: options.dir }
          );

          return historyItems;
        }
      }
    });

    await expect(
      historySource.fetchHistory({ conversationId: "session-1" })
    ).resolves.toEqual(historyItems);
    expect(calls).toEqual([
      {
        sessionId: "session-1",
        dir: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
      }
    ]);
  });
});
