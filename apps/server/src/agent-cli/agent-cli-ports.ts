export interface AgentCliHistorySource {
  fetchHistory(input: RestoreAgentContentInput): Promise<unknown[]>;
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

export type EntryBody =
  | { kind: "UserInput"; markdown: string }
  | { kind: "AgentReply"; content: string; stream: "InProgress" | "Completed" }
  | {
      kind: "WorkProgress";
      nativeType?: string;
      nativeStatus?: string;
      detail: Record<string, unknown>;
    }
  | { kind: "Failure"; message: string; detail: Record<string, unknown> }
  | { kind: "Unrecognized"; nativeStatus?: string; detail: Record<string, unknown> };

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

export type TurnSignalInterpretation =
  | { kind: "NoTurnSignal" }
  | {
      kind: "TurnStarted";
      turnId: string;
      firstUserInputRef: string;
      userInputTime: string;
    }
  | {
      kind: "TurnCompleted";
      turnId: string;
      outcome: TurnCompletionOutcome;
      lastAgentReplyRef?: string;
      lastReplyCompletedTime: string;
    };

export interface RestoreAgentContentInput {
  conversationId: string;
}

export type ContentRestoreOutcome =
  | { kind: "Restored"; items: unknown[] }
  | { kind: "RestoredEmpty" }
  | { kind: "RestoreFailed"; message: string };
