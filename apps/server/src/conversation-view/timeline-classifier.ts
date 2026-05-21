import type { TimelineItem } from "@my-code-x/app-types";
import type {
  CodexRestoredAgentMessage,
  CodexRestoredThreadItem,
  CodexRestoredUserInput,
  CodexRestoredUserMessage
} from "./codex-conversation-history-gateway";

export interface ClassifyRestoredThreadItemInput {
  threadId: string;
  turnId: string;
  item: CodexRestoredThreadItem;
}

export function classifyRestoredThreadItem(
  input: ClassifyRestoredThreadItemInput
): TimelineItem | null {
  if (isRestoredUserMessage(input.item)) {
    const text = input.item.content
      .filter(isTextInput)
      .map((entry) => entry.text)
      .join("\n");

    if (!text) {
      return null;
    }

    return messageTimelineItem({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id,
      role: "user",
      text
    });
  }

  if (isRestoredAgentMessage(input.item)) {
    return messageTimelineItem({
      threadId: input.threadId,
      turnId: input.turnId,
      itemId: input.item.id,
      role: "agent",
      text: input.item.text
    });
  }

  return null;
}

function isRestoredUserMessage(
  item: CodexRestoredThreadItem
): item is CodexRestoredUserMessage {
  return (
    item.type === "userMessage" &&
    typeof item.id === "string" &&
    "content" in item &&
    Array.isArray(item.content)
  );
}

function isRestoredAgentMessage(
  item: CodexRestoredThreadItem
): item is CodexRestoredAgentMessage {
  return (
    item.type === "agentMessage" &&
    typeof item.id === "string" &&
    "text" in item &&
    typeof item.text === "string"
  );
}

function isTextInput(
  input: CodexRestoredUserInput
): input is Extract<CodexRestoredUserInput, { type: "text" }> {
  return input.type === "text" && "text" in input && typeof input.text === "string";
}

interface MessageTimelineItemInput extends CodexThreadItemIdInput {
  role: "user" | "agent";
  text: string;
}

function messageTimelineItem(input: MessageTimelineItemInput): TimelineItem {
  return {
    id: codexThreadItemId(input),
    turnId: input.turnId,
    occurredAt: null,
    status: "completed",
    kind: "message",
    message: {
      role: input.role,
      text: input.text,
      markdown: true,
      copyText: input.text
    }
  };
}

interface CodexThreadItemIdInput {
  threadId: string;
  turnId: string;
  itemId: string;
}

function codexThreadItemId(input: CodexThreadItemIdInput): string {
  return `codexThreadItem(${input.threadId},${input.turnId},${input.itemId})`;
}
