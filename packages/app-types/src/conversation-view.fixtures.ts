import type {
  AgentReplyEntryBody,
  ConversationSnapshot,
  TranscriptEntry,
  Turn
} from "./conversation-view";

export interface UserInputEntryFixtureInput {
  id?: string;
  sequence?: number;
  markdown?: string;
}

export interface AgentReplyEntryFixtureInput {
  id?: string;
  sequence?: number;
  content?: string;
  stream?: AgentReplyEntryBody["stream"];
}

export interface WorkProgressEntryFixtureInput {
  id?: string;
  sequence?: number;
  nativeType?: string;
  nativeStatus?: string;
  detail?: Record<string, unknown>;
}

export interface FailureEntryFixtureInput {
  id?: string;
  sequence?: number;
  message?: string;
  detail?: Record<string, unknown>;
}

export interface UnrecognizedEntryFixtureInput {
  id?: string;
  sequence?: number;
  nativeStatus?: string;
  detail?: Record<string, unknown>;
}

export interface InProgressTurnFixtureInput {
  id?: string;
  firstUserInputRef?: string;
  userInputTime?: string;
}

export interface CompletedTurnFixtureInput {
  id?: string;
  firstUserInputRef?: string;
  userInputTime?: string;
  lastAgentReplyRef?: string;
  lastReplyCompletedTime?: string;
}

export interface TerminalTurnFixtureInput {
  id?: string;
  firstUserInputRef?: string;
  userInputTime?: string;
  completedTime?: string;
  lastAgentReplyRef?: string | null;
}

export const entryFixture = {
  userInput(input: UserInputEntryFixtureInput = {}): TranscriptEntry {
    return {
      id: input.id ?? "entry-user",
      sequence: input.sequence ?? 1,
      body: {
        kind: "UserInput",
        markdown: input.markdown ?? "hello"
      }
    };
  },

  agentReply(input: AgentReplyEntryFixtureInput = {}): TranscriptEntry {
    return {
      id: input.id ?? "entry-agent",
      sequence: input.sequence ?? 2,
      body: {
        kind: "AgentReply",
        content: input.content ?? "hello back",
        stream: input.stream ?? "Completed"
      }
    };
  },

  workProgress(input: WorkProgressEntryFixtureInput = {}): TranscriptEntry {
    return {
      id: input.id ?? "entry-work",
      sequence: input.sequence ?? 3,
      body: {
        kind: "WorkProgress",
        nativeType: input.nativeType,
        nativeStatus: input.nativeStatus,
        detail: input.detail ?? {}
      }
    };
  },

  failure(input: FailureEntryFixtureInput = {}): TranscriptEntry {
    return {
      id: input.id ?? "entry-failure",
      sequence: input.sequence ?? 4,
      body: {
        kind: "Failure",
        message: input.message ?? "Unknown error",
        detail: input.detail ?? {}
      }
    };
  },

  unrecognized(input: UnrecognizedEntryFixtureInput = {}): TranscriptEntry {
    return {
      id: input.id ?? "entry-unrecognized",
      sequence: input.sequence ?? 5,
      body: {
        kind: "Unrecognized",
        nativeStatus: input.nativeStatus,
        detail: input.detail ?? {}
      }
    };
  }
};

export const turnFixture = {
  inProgress(input: InProgressTurnFixtureInput = {}): Turn {
    return {
      id: input.id ?? "turn-in-progress",
      status: {
        kind: "InProgress",
        firstUserInputRef: input.firstUserInputRef ?? "entry-user",
        userInputTime: input.userInputTime ?? "2026-06-06T06:00:00.000Z"
      }
    };
  },

  completed(input: CompletedTurnFixtureInput = {}): Turn {
    return {
      id: input.id ?? "turn-completed",
      status: {
        kind: "Completed",
        firstUserInputRef: input.firstUserInputRef ?? "entry-user",
        userInputTime: input.userInputTime ?? "2026-06-06T06:00:00.000Z",
        lastAgentReplyRef: input.lastAgentReplyRef ?? "entry-agent",
        lastReplyCompletedTime:
          input.lastReplyCompletedTime ?? "2026-06-06T06:01:00.000Z"
      }
    };
  },

  failed(input: TerminalTurnFixtureInput = {}): Turn {
    return {
      id: input.id ?? "turn-failed",
      status: {
        kind: "Failed",
        firstUserInputRef: input.firstUserInputRef ?? "entry-user",
        userInputTime: input.userInputTime ?? "2026-06-06T06:00:00.000Z",
        completedTime: input.completedTime ?? "2026-06-06T06:01:00.000Z",
        lastAgentReplyRef: input.lastAgentReplyRef ?? null
      }
    };
  },

  interrupted(input: TerminalTurnFixtureInput = {}): Turn {
    return {
      id: input.id ?? "turn-interrupted",
      status: {
        kind: "Interrupted",
        firstUserInputRef: input.firstUserInputRef ?? "entry-user",
        userInputTime: input.userInputTime ?? "2026-06-06T06:00:00.000Z",
        completedTime: input.completedTime ?? "2026-06-06T06:01:00.000Z",
        lastAgentReplyRef: input.lastAgentReplyRef ?? null
      }
    };
  }
};

export function snapshotFixture(
  overrides: Partial<ConversationSnapshot> = {}
): ConversationSnapshot {
  return {
    conversation: overrides.conversation ?? {
      id: "conversation-fixture",
      contentRestore: {
        kind: "Restored"
      }
    },
    transcriptEntries: overrides.transcriptEntries ?? [],
    turns: overrides.turns ?? [],
    pendingInteractions: overrides.pendingInteractions ?? [],
    cursor: overrides.cursor ?? "0"
  };
}
