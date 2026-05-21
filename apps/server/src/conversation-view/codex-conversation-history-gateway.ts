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
  | CodexRestoredWorkProgressItem
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

export const codexRestoredWorkProgressTypes = [
  "hookPrompt",
  "reasoning",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "webSearch",
  "imageView",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction"
] as const;

export type CodexRestoredWorkProgressType =
  (typeof codexRestoredWorkProgressTypes)[number];

export interface CodexRestoredWorkProgressItem {
  type: CodexRestoredWorkProgressType;
  id: string;
  [key: string]: unknown;
}

export interface CodexRestoredUnknownThreadItem {
  type: string;
  id?: string;
  [key: string]: unknown;
}

export function isCodexRestoredWorkProgressType(
  type: string
): type is CodexRestoredWorkProgressType {
  return codexRestoredWorkProgressTypes.includes(
    type as CodexRestoredWorkProgressType
  );
}
