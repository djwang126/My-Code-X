import { describe, expect, it } from "vitest";

import {
  agentCliDomainEventSchema,
  agentCliCommandSchema,
  agentCapabilitySchema,
  authoritativeSnapshotSchema,
  pendingInteractionSchema,
  recoveredSnapshotSchema
} from "./conversation-view";

describe("conversation-view domain contracts", () => {
  it("accepts a recovered conversation snapshot in domain language", () => {
    const result = recoveredSnapshotSchema.safeParse({
      messages: [
        {
          stableKey: "msg-1",
          sequence: 1,
          classification: "NormalConversation",
          nativeType: "assistant_message",
          nativeStatus: null,
          belongsToTurn: "turn-1",
          content: {
            fields: [{ name: "text", value: "你好, Codex 👋" }]
          }
        }
      ],
      turns: [
        {
          turnId: "turn-1",
          state: "Ended",
          startTime: "2026-06-09T09:00:00.000Z",
          endTime: "2026-06-09T09:01:00.000Z"
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects recovered snapshots that still contain running turns", () => {
    expect(() =>
      recoveredSnapshotSchema.parse({
        messages: [],
        turns: [
          {
            turnId: "turn-1",
            state: "InProgress",
            startTime: null,
            endTime: null
          }
        ]
      })
    ).toThrow("RecoveredSnapshot cannot contain running turns");
  });

  it("accepts authoritative snapshots with a running turn", () => {
    const result = authoritativeSnapshotSchema.safeParse({
      messages: [],
      turns: [
        {
          turnId: "turn-1",
          state: "InProgress",
          startTime: "2026-06-09T09:00:00.000Z",
          endTime: null
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("accepts pending interactions with option metadata", () => {
    const result = pendingInteractionSchema.safeParse({
      interactionId: "interaction-1",
      conversationId: "conversation-1",
      state: { kind: "Pending" },
      content: {
        prompt: "Allow this command?",
        options: [
          { id: "accept", label: "Accept", requiresSupplement: false },
          { id: "accept-with-note", label: "Accept with note", requiresSupplement: true }
        ]
      }
    });

    expect(result.success).toBe(true);
  });

  it("accepts live update events after native data has been translated", () => {
    const result = agentCliDomainEventSchema.array().safeParse([
      {
        kind: "MessageAppended",
        resumeCursor: "cursor-1",
        message: {
          stableKey: "msg-1",
          sequence: 1,
          classification: "WorkProcess",
          nativeType: "commandExecution",
          nativeStatus: "running",
          belongsToTurn: "turn-1",
          content: { fields: [{ name: "command", value: "pnpm test" }] }
        }
      },
      {
        kind: "MessageUpdated",
        resumeCursor: "cursor-2",
        stableKey: "msg-1",
        update: {
          kind: "AppendDelta",
          fields: [{ name: "stdout", value: "ok" }]
        }
      },
      {
        kind: "TurnChanged",
        resumeCursor: "cursor-3",
        turn: {
          turnId: "turn-1",
          state: "Ended",
          startTime: "2026-06-09T09:00:00.000Z",
          endTime: "2026-06-09T09:01:00.000Z"
        }
      },
      {
        kind: "PendingInteractionRaised",
        interaction: {
          interactionId: "interaction-1",
          conversationId: "conversation-1",
          state: { kind: "Pending" },
          content: {
            prompt: "Allow this command?",
            options: [{ id: "accept", label: "Accept", requiresSupplement: false }]
          }
        }
      },
      {
        kind: "PendingInteractionExpired",
        interactionId: "interaction-1"
      },
      {
        kind: "UnattributedErrorRaised",
        message: "agent cli disconnected"
      },
      {
        kind: "ProtocolViolation",
        reason: "missing stableKey"
      }
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects full replace updates whose target identity does not match the replacement message", () => {
    expect(() =>
      agentCliDomainEventSchema.parse({
        kind: "MessageUpdated",
        resumeCursor: "cursor-2",
        stableKey: "msg-1",
        update: {
          kind: "FullReplace",
          message: {
            stableKey: "msg-2",
            sequence: 1,
            classification: "NormalConversation",
            nativeType: "assistant_message",
            nativeStatus: null,
            belongsToTurn: "turn-1",
            content: { fields: [{ name: "text", value: "replacement" }] }
          }
        }
      })
    ).toThrow("FullReplace message stableKey must match MessageUpdated stableKey");
  });

  it("accepts agent capabilities used by composer action decisions", () => {
    const result = agentCapabilitySchema.safeParse({
      supportsInterrupt: true,
      supportsAppend: false
    });

    expect(result.success).toBe(true);
  });

  it("accepts normal input commands without changing raw text", () => {
    const command = {
      kind: "SubmitNormalInput",
      session: {
        cliKind: "codex",
        conversationId: "conversation-1",
        workingDirectory: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        agentSessionId: null
      },
      text: "第一行\n第二行 emoji 👋"
    };

    expect(agentCliCommandSchema.parse(command)).toEqual(command);
  });

  it("accepts every outbound command intent through one command union", () => {
    const session = {
      cliKind: "claude-code",
      conversationId: "conversation-1",
      workingDirectory: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
      agentSessionId: "agent-session-1"
    };

    const result = agentCliCommandSchema.array().safeParse([
      {
        kind: "AppendInstruction",
        session,
        text: "继续，但只改测试",
        turnId: "turn-1"
      },
      {
        kind: "RequestWorkInterrupt",
        session,
        turnId: "turn-1"
      },
      {
        kind: "RespondToInteraction",
        session,
        interactionId: "interaction-1",
        optionId: "accept",
        supplement: "批准一次"
      }
    ]);

    expect(result.success).toBe(true);
  });
});
