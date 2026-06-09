import { describe, expect, it } from "vitest";

import type { Message, Turn } from "@my-code-x/app-types";

import {
  AgentCliProtocolViolationError,
  MessageOrderViolationError,
  RecoveredConversationStillRunningError,
  ResumeCursorGapError,
  assertMessageHasStableKey,
  assertRecoveredSnapshotHasNoRunningTurns,
  assertResumeCursorContinues,
  assertSequenceContinues,
  shouldProjectClassifiedMessage
} from "./protocol-invariants";

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    stableKey: "message-1",
    sequence: 1,
    classification: "NormalConversation",
    nativeType: "assistant_message",
    nativeStatus: null,
    belongsToTurn: "turn-1",
    content: {
      fields: [{ name: "text", value: "hello" }]
    },
    ...overrides
  };
}

function createTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    turnId: "turn-1",
    state: "Ended",
    startTime: null,
    endTime: null,
    ...overrides
  };
}

describe("agent cli protocol invariants", () => {
  it("treats a missing stable key as a protocol violation", () => {
    expect(() =>
      assertMessageHasStableKey({
        cliKind: "codex",
        nativeType: "assistant_message",
        stableKey: ""
      })
    ).toThrow(AgentCliProtocolViolationError);
  });

  it("accepts the next message sequence and rejects gaps or rewinds", () => {
    expect(() =>
      assertSequenceContinues({
        stableKey: "message-2",
        previousSequence: 1,
        nextSequence: 2
      })
    ).not.toThrow();

    expect(() =>
      assertSequenceContinues({
        stableKey: "message-3",
        previousSequence: 1,
        nextSequence: 3
      })
    ).toThrow(MessageOrderViolationError);
  });

  it("requires live updates to continue from the expected resume cursor", () => {
    expect(() =>
      assertResumeCursorContinues({
        expectedPreviousCursor: "cursor-1",
        actualPreviousCursor: "cursor-1",
        nextCursor: "cursor-2"
      })
    ).not.toThrow();

    expect(() =>
      assertResumeCursorContinues({
        expectedPreviousCursor: "cursor-1",
        actualPreviousCursor: "cursor-0",
        nextCursor: "cursor-2"
      })
    ).toThrow(ResumeCursorGapError);
  });

  it("rejects recovered history that still contains running turns", () => {
    expect(() =>
      assertRecoveredSnapshotHasNoRunningTurns({
        messages: [createMessage()],
        turns: [createTurn({ state: "InProgress" })]
      })
    ).toThrow(RecoveredConversationStillRunningError);
  });

  it("keeps ignored native messages out of projection but projects unrecognized messages", () => {
    expect(shouldProjectClassifiedMessage({ kind: "Ignored" })).toBe(false);
    expect(
      shouldProjectClassifiedMessage({
        kind: "Display",
        classification: "Unrecognized"
      })
    ).toBe(true);
  });
});
