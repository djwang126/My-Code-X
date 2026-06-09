import { describe, expect, it } from "vitest";

import {
  agentCliDomainEventSchema,
  authoritativeSnapshotSchema,
  recoveredSnapshotSchema
} from "@my-code-x/app-types";

import type { NativeTranslator } from "./native-translator";

function createContractTranslator(): NativeTranslator {
  return {
    cliKind: "codex",

    translateRecoveredHistory(input) {
      const native = input.raw as { messageId: string; text: string; turnId: string };

      return {
        messages: [
          {
            stableKey: native.messageId,
            sequence: 1,
            classification: "NormalConversation",
            nativeType: "assistant_message",
            nativeStatus: null,
            belongsToTurn: native.turnId,
            content: {
              fields: [{ name: "text", value: native.text }]
            }
          }
        ],
        turns: [
          {
            turnId: native.turnId,
            state: "Ended",
            startTime: null,
            endTime: null
          }
        ]
      };
    },

    translateAuthoritativeState(input) {
      const native = input.raw as { turnId: string };

      return {
        messages: [],
        turns: [
          {
            turnId: native.turnId,
            state: "InProgress",
            startTime: "2026-06-09T09:00:00.000Z",
            endTime: null
          }
        ]
      };
    },

    translateLiveRecord(input) {
      const native = input.raw as { messageId: string; text: string };

      return [
        {
          kind: "MessageUpdated",
          resumeCursor: "cursor-1",
          delta: {
            mode: "AppendDelta",
            stableKey: native.messageId,
            fields: [{ name: "text", value: native.text }]
          }
        }
      ];
    }
  };
}

describe("NativeTranslator", () => {
  it("normalizes native recovered history into the shared domain snapshot", () => {
    const translator = createContractTranslator();

    const snapshot = translator.translateRecoveredHistory({
      raw: {
        messageId: "native-message-1",
        text: "你好, Codex 👋",
        turnId: "native-turn-1"
      }
    });

    expect(recoveredSnapshotSchema.parse(snapshot)).toEqual({
      messages: [
        {
          stableKey: "native-message-1",
          sequence: 1,
          classification: "NormalConversation",
          nativeType: "assistant_message",
          nativeStatus: null,
          belongsToTurn: "native-turn-1",
          content: {
            fields: [{ name: "text", value: "你好, Codex 👋" }]
          }
        }
      ],
      turns: [
        {
          turnId: "native-turn-1",
          state: "Ended",
          startTime: null,
          endTime: null
        }
      ]
    });
  });

  it("normalizes native authoritative state into a snapshot that may contain a running turn", () => {
    const translator = createContractTranslator();

    const snapshot = translator.translateAuthoritativeState({
      raw: { turnId: "native-turn-1" }
    });

    expect(authoritativeSnapshotSchema.parse(snapshot)).toEqual({
      messages: [],
      turns: [
        {
          turnId: "native-turn-1",
          state: "InProgress",
          startTime: "2026-06-09T09:00:00.000Z",
          endTime: null
        }
      ]
    });
  });

  it("normalizes one native live record into zero or more shared domain events", () => {
    const translator = createContractTranslator();

    const events = translator.translateLiveRecord({
      raw: {
        messageId: "native-message-1",
        text: "追加内容"
      }
    });

    expect(agentCliDomainEventSchema.array().parse(events)).toEqual([
      {
        kind: "MessageUpdated",
        resumeCursor: "cursor-1",
        delta: {
          mode: "AppendDelta",
          stableKey: "native-message-1",
          fields: [{ name: "text", value: "追加内容" }]
        }
      }
    ]);
  });
});
