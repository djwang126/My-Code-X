export interface AgentCliHistorySource {
  fetchHistory(input: RestoreAgentContentInput): Promise<unknown[]>;
}

export interface ClassifyAgentInformationInput {
  conversationId: string;
  raw: unknown;
  streamHint?: "InProgress" | "Completed";
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

export interface InterpretTurnSignalInput {
  conversationId: string;
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
