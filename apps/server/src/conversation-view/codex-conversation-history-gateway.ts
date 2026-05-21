import type { CodexThreadListItem } from "../codex-thread-browser/codex-thread-browser";

export interface CodexConversationHistoryGateway {
  restoreThread(
    input: RestoreCodexThreadInput
  ): Promise<CodexRestoredThread | null>;
}

export interface RestoreCodexThreadInput {
  threadId: string;
}

export interface CodexRestoredThread extends CodexThreadListItem {
  turns: CodexRestoredTurn[];
}

export interface CodexRestoredTurn {
  id: string;
  items: CodexRestoredThreadItem[];
}

export type CodexRestoredThreadItem =
  | CodexRestoredUserMessage
  | CodexRestoredAgentMessage
  | CodexRestoredUnknownThreadItem;

export interface CodexRestoredUserMessage {
  type: "userMessage";
  id: string;
  content: CodexRestoredUserInput[];
}

export type CodexRestoredUserInput =
  | {
      type: "text";
      text: string;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export interface CodexRestoredAgentMessage {
  type: "agentMessage";
  id: string;
  text: string;
}

export interface CodexRestoredUnknownThreadItem {
  type: string;
  id?: string;
  [key: string]: unknown;
}
