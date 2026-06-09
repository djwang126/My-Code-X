import { describe, expect, it } from "vitest";

import type { Message, Turn } from "@my-code-x/app-types";

import {
  AgentCliProtocolViolationError,
  MessageOrderViolationError,
  RecoveredConversationStillRunningError,
  ResumeCursorGapError,
  assertRecoveredSnapshotHasNoRunningTurns,
  assertResumeCursorContinues,
  assertSequenceCanAppend,
  requireStableKey,
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
      requireStableKey({
        cliKind: "codex",
        nativeType: "assistant_message",
        stableKey: ""
      })
    ).toThrow(AgentCliProtocolViolationError);
  });

  it("returns a present stable key as a trusted domain value", () => {
    expect(
      requireStableKey({
        cliKind: "codex",
        nativeType: "assistant_message",
        stableKey: "message-1"
      })
    ).toBe("message-1");
  });

  it("accepts the first agent-provided sequence without forcing it to start at one", () => {
    expect(() =>
      assertSequenceCanAppend({
        stableKey: "message-10",
        previousSequence: null,
        nextSequence: 10
      })
    ).not.toThrow();
  });

  it("accepts increasing message sequences and rejects rewinds or duplicates", () => {
    expect(() =>
      assertSequenceCanAppend({
        stableKey: "message-2",
        previousSequence: 1,
        nextSequence: 3
      })
    ).not.toThrow();

    expect(() =>
      assertSequenceCanAppend({
        stableKey: "message-2",
        previousSequence: 3,
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
