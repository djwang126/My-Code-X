import type { EntryBody, Turn } from "@my-code-x/app-types";

export type AgentCliHistory =
  | unknown[]
  | {
      items: unknown[];
      turns?: unknown[];
    };

export interface AgentCliHistorySource {
  fetchHistory(input: RestoreAgentContentInput): Promise<AgentCliHistory>;
}

export interface ClassifyAgentInformationInput {
  conversationId: string;
  /**
   * Native routing key carried by the agent cli wire envelope.
   * - codex: JSON-RPC notification method, e.g. "item/completed".
   * - claude code: undefined; semantics live in `raw.type` / `raw.subtype`.
   */
  nativeMethod?: string;
  raw: unknown;
}

export interface ClassifiedAgentInformation {
  entryId: string;
  body: EntryBody;
}

/**
 * Classification result. `null` means the message is a known non-entry signal
 * (turn lifecycle, status change, token usage, streaming delta, run result)
 * that must not be appended to the transcript. `Unrecognized` is reserved for
 * content-like messages that cannot be safely classified (INV-4).
 */
export type ClassificationResult = ClassifiedAgentInformation | null;

export interface InterpretTurnSignalInput {
  conversationId: string;
  /** Native routing key; see ClassifyAgentInformationInput.nativeMethod. */
  nativeMethod?: string;
  raw: unknown;
}

export type TurnCompletionOutcome = "Completed" | "Failed" | "Interrupted";

export type TurnCompletedSignal =
  | {
      kind: "TurnCompleted";
      turnId: string;
      outcome: "Completed";
      lastAgentReplyRef: string;
      lastReplyCompletedTime: string;
    }
  | {
      kind: "TurnCompleted";
      turnId: string;
      outcome: "Failed" | "Interrupted";
      lastAgentReplyRef: string | null;
      completedTime: string;
    };

export type TurnSignalInterpretation =
  | { kind: "NoTurnSignal" }
  | {
      kind: "TurnStarted";
      turnId: string;
      firstUserInputRef: string;
      userInputTime: string;
    }
  | TurnCompletedSignal;

export interface RestoreAgentContentInput {
  conversationId: string;
}

export type ContentRestoreOutcome =
  | { kind: "Restored"; items: unknown[]; turns?: Turn[] }
  | { kind: "RestoredEmpty" }
  | { kind: "RestoreFailed"; message: string };
