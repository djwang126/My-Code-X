import { describe, expect, it } from "vitest";

import type { Classification, Message } from "@my-code-x/app-types";

import { projectClassifiedMessage } from "./classification-policy";

function projectMessage(classification: Classification): Message | null {
  return projectClassifiedMessage({
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

describe("classification policy", () => {
  it("projects normal conversation native messages as readable conversation content", () => {
    expect(projectMessage("NormalConversation")).toMatchObject({
      classification: "NormalConversation",
      content: {
        fields: [{ name: "text", value: "hello" }]
      }
    });
  });

  it("projects work process native messages as collapsible work process content", () => {
    expect(projectMessage("WorkProcess")).toMatchObject({
      classification: "WorkProcess",
      nativeType: "synthetic-native-type",
      nativeStatus: "synthetic-native-status"
    });
  });

  it("projects attributed native errors as failure content", () => {
    expect(projectMessage("Failure")).toMatchObject({
      classification: "Failure"
    });
  });

  it("projects unknown-but-displayable native messages as unrecognized content", () => {
    expect(projectMessage("Unrecognized")).toMatchObject({
      classification: "Unrecognized"
    });
  });

  it("keeps intentionally ignored native messages out of the projection", () => {
    expect(
      projectClassifiedMessage({
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
});
