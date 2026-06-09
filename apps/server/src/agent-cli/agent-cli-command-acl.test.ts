import type {
  AgentCapability,
  AgentCliCommand,
  AgentCliCommandResult,
  AgentCliSessionInput
} from "@my-code-x/app-types";
import { describe, expect, test } from "vitest";
import {
  createAgentCliCommandAcl,
  type AgentCliCommandBoundary
} from "./agent-cli-command-acl";

const session: AgentCliSessionInput = {
  cliKind: "codex",
  conversationId: "conv-1"
};

const fullCapability: AgentCapability = {
  supportsAppend: true,
  supportsInterrupt: true
};

type RecordedCommand = AgentCliCommand;

interface RecordingBoundary {
  readonly boundary: AgentCliCommandBoundary;
  readonly received: RecordedCommand[];
}

function createRecordingBoundary(
  result: AgentCliCommandResult = { kind: "accepted" }
): RecordingBoundary {
  const received: RecordedCommand[] = [];

  return {
    received,
    boundary: {
      submitNormalInput: async (command) => {
        received.push(command);
        return result;
      },
      appendInstruction: async (command) => {
        received.push(command);
        return result;
      },
      requestWorkInterrupt: async (command) => {
        received.push(command);
        return result;
      },
      respondToInteraction: async (command) => {
        received.push(command);
        return result;
      }
    }
  };
}

describe("AgentCliCommandAcl", () => {
  test("sends normal input without changing the original text", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: fullCapability
    });
    const text = "第一行\nemoji 😄\nWindows path D:\\workspaces\\AI-Tools";

    const result = await acl.sendCommand({
      kind: "SubmitNormalInput",
      session,
      text
    });

    expect(result).toEqual({ kind: "accepted" });
    expect(recorder.received).toEqual([
      {
        kind: "SubmitNormalInput",
        session,
        text
      }
    ]);
  });

  test("sends append instruction with optional turn identity", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: fullCapability
    });

    const result = await acl.sendCommand({
      kind: "AppendInstruction",
      session,
      text: "追加一条指令\nkeep newline",
      turnId: "turn-7"
    });

    expect(result).toEqual({ kind: "accepted" });
    expect(recorder.received).toEqual([
      {
        kind: "AppendInstruction",
        session,
        text: "追加一条指令\nkeep newline",
        turnId: "turn-7"
      }
    ]);
  });

  test("does not relay append instruction when the cli does not support append", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: {
        supportsAppend: false,
        supportsInterrupt: true
      }
    });

    const result = await acl.sendCommand({
      kind: "AppendInstruction",
      session,
      text: "should stay local"
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "unsupportedCapability",
      message: "agent cli does not support appending instructions"
    });
    expect(recorder.received).toEqual([]);
  });

  test("sends interrupt request only when interrupt is supported", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: fullCapability
    });

    const result = await acl.sendCommand({
      kind: "RequestWorkInterrupt",
      session,
      turnId: "turn-7"
    });

    expect(result).toEqual({ kind: "accepted" });
    expect(recorder.received).toEqual([
      {
        kind: "RequestWorkInterrupt",
        session,
        turnId: "turn-7"
      }
    ]);
  });

  test("does not relay interrupt when the cli does not support interrupt", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: {
        supportsAppend: true,
        supportsInterrupt: false
      }
    });

    const result = await acl.sendCommand({
      kind: "RequestWorkInterrupt",
      session
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "unsupportedCapability",
      message: "agent cli does not support interrupting work"
    });
    expect(recorder.received).toEqual([]);
  });

  test("sends pending interaction response with supplement text unchanged", async () => {
    const recorder = createRecordingBoundary();
    const acl = createAgentCliCommandAcl({
      boundary: recorder.boundary,
      capability: fullCapability
    });

    const result = await acl.sendCommand({
      kind: "RespondToInteraction",
      session,
      interactionId: "interaction-1",
      optionId: "approve",
      supplement: "允许这次操作\n路径：D:\\tmp\\猫 😄"
    });

    expect(result).toEqual({ kind: "accepted" });
    expect(recorder.received).toEqual([
      {
        kind: "RespondToInteraction",
        session,
        interactionId: "interaction-1",
        optionId: "approve",
        supplement: "允许这次操作\n路径：D:\\tmp\\猫 😄"
      }
    ]);
  });

  test("returns relay failure when the boundary rejects a command", async () => {
    const acl = createAgentCliCommandAcl({
      boundary: {
        submitNormalInput: async () => {
          throw new Error("transport closed");
        },
        appendInstruction: async () => ({ kind: "accepted" }),
        requestWorkInterrupt: async () => ({ kind: "accepted" }),
        respondToInteraction: async () => ({ kind: "accepted" })
      },
      capability: fullCapability
    });

    const result = await acl.sendCommand({
      kind: "SubmitNormalInput",
      session,
      text: "hello"
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "relayFailed",
      message: "transport closed"
    });
  });
});
