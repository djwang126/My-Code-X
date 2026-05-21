import {
  codexProtocolError,
  parseCodexThreadListItem
} from "../codex-thread-browser/codex-app-server-thread-browser";
import { isCodexRestoredWorkProgressType } from "./codex-conversation-history-gateway";
import type {
  CodexRestoredThread,
  CodexRestoredThreadItem,
  CodexRestoredTurn,
  CodexRestoredUserInput
} from "./codex-conversation-history-gateway";

export function parseThreadResumeResponse(raw: unknown): CodexRestoredThread {
  if (typeof raw !== "object" || raw === null || !("thread" in raw)) {
    throw codexProtocolError("Invalid Codex thread/resume response");
  }

  const threadRaw = (raw as { thread: unknown }).thread;
  const thread = parseCodexThreadListItem(threadRaw);
  const turns = readTurns(threadRaw);

  return {
    ...thread,
    turns
  };
}

function readTurns(raw: unknown): CodexRestoredTurn[] {
  if (typeof raw !== "object" || raw === null || !("turns" in raw)) {
    throw codexProtocolError("Invalid Codex thread/resume response");
  }

  const turns = (raw as { turns: unknown }).turns;
  if (!Array.isArray(turns)) {
    throw codexProtocolError("Invalid Codex thread/resume response");
  }

  return turns.map(readTurn);
}

function readTurn(raw: unknown): CodexRestoredTurn {
  if (typeof raw !== "object" || raw === null) {
    throw codexProtocolError("Invalid Codex thread/resume turn");
  }

  const turn = raw as Record<string, unknown>;
  const id = turn.id;
  if (typeof id !== "string") {
    throw codexProtocolError("Invalid Codex thread/resume turn field: id");
  }

  if (!Array.isArray(turn.items)) {
    throw codexProtocolError("Invalid Codex thread/resume turn field: items");
  }

  return {
    id,
    items: turn.items.map(readThreadItem)
  };
}

function readThreadItem(raw: unknown): CodexRestoredThreadItem {
  if (typeof raw !== "object" || raw === null) {
    throw codexProtocolError("Invalid Codex thread/resume item");
  }

  const item = raw as Record<string, unknown>;
  const type = item.type;
  if (typeof type !== "string") {
    throw codexProtocolError("Invalid Codex thread/resume item field: type");
  }

  if (type === "userMessage") {
    return {
      type,
      id: readRequiredString(item, "id", "userMessage"),
      content: readUserMessageContent(item.content)
    };
  }

  if (type === "agentMessage") {
    return {
      type,
      id: readRequiredString(item, "id", "agentMessage"),
      text: readRequiredString(item, "text", "agentMessage")
    };
  }

  if (isCodexRestoredWorkProgressType(type)) {
    return {
      ...item,
      type,
      id: readRequiredString(item, "id", type)
    };
  }

  const id = item.id;
  if (id !== undefined && typeof id !== "string") {
    throw codexProtocolError("Invalid Codex thread/resume item field: id");
  }

  return {
    ...item,
    type
  };
}

function readRequiredString(
  item: Record<string, unknown>,
  key: string,
  sourceType: string
): string {
  const value = item[key];
  if (typeof value !== "string") {
    throw codexProtocolError(
      `Invalid Codex thread/resume ${sourceType} field: ${key}`
    );
  }

  return value;
}

function readUserMessageContent(raw: unknown): CodexRestoredUserInput[] {
  if (!Array.isArray(raw)) {
    throw codexProtocolError("Invalid Codex thread/resume userMessage field: content");
  }

  return raw.map(readUserInput);
}

function readUserInput(raw: unknown): CodexRestoredUserInput {
  if (typeof raw !== "object" || raw === null) {
    throw codexProtocolError("Invalid Codex thread/resume userMessage input");
  }

  const input = raw as Record<string, unknown>;
  const type = input.type;
  if (typeof type !== "string") {
    throw codexProtocolError(
      "Invalid Codex thread/resume userMessage input field: type"
    );
  }

  if (type !== "text") {
    return { type };
  }

  const text = input.text;
  if (typeof text !== "string") {
    throw codexProtocolError(
      "Invalid Codex thread/resume userMessage text input field: text"
    );
  }

  return {
    type,
    text
  };
}
