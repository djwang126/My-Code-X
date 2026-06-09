import { describe, expect, it } from "vitest";

import type { Classification, Message } from "@my-code-x/app-types";

import { AgentCliProtocolViolationError } from "./protocol-invariants";
import { projectMessageFromClassificationDecision } from "./message-projection";

function projectMessage(classification: Classification): Message | null {
  return projectMessageFromClassificationDecision({
    cliKind: "codex",
    decision: {
      kind: "Display",
      classification
    },
    stableKey: "message-1",
    sequence: 1,
    nativeType: "synthetic-native-type",
    nativeStatus: "synthetic-native-status",
    belongsToTurn: "turn-1",
    content: {
      fields: [{ name: "text", value: "hello" }]
    }
  });
}

describe("message projection", () => {
  it("projects display decisions into readable conversation messages", () => {
    expect(projectMessage("NormalConversation")).toEqual({
      stableKey: "message-1",
      sequence: 1,
      classification: "NormalConversation",
      nativeType: "synthetic-native-type",
      nativeStatus: "synthetic-native-status",
      belongsToTurn: "turn-1",
      content: {
        fields: [{ name: "text", value: "hello" }]
      }
    });
  });

  it("preserves the selected classification without doing native classification", () => {
    expect(projectMessage("WorkProcess")).toMatchObject({
      classification: "WorkProcess"
    });
    expect(projectMessage("Failure")).toMatchObject({
      classification: "Failure"
    });
    expect(projectMessage("Unrecognized")).toMatchObject({
      classification: "Unrecognized"
    });
  });

  it("keeps intentionally ignored native messages out of the projection", () => {
    expect(
      projectMessageFromClassificationDecision({
        cliKind: "claude-code",
        decision: { kind: "Ignored" },
        stableKey: "ignored-message-1",
        sequence: 1,
        nativeType: "synthetic-ignored-native-type",
        nativeStatus: null,
        belongsToTurn: null,
        content: {
          fields: [{ name: "raw", value: "ignored" }]
        }
      })
    ).toBeNull();
  });

  it("treats display decisions without a stable key as protocol violations", () => {
    expect(() =>
      projectMessageFromClassificationDecision({
        cliKind: "codex",
        decision: {
          kind: "Display",
          classification: "Unrecognized"
        },
        stableKey: null,
        sequence: 1,
        nativeType: "unknown-native-type",
        nativeStatus: null,
        belongsToTurn: null,
        content: {
          fields: [{ name: "raw", value: "displayable but missing identity" }]
        }
      })
    ).toThrow(AgentCliProtocolViolationError);
  });
});
