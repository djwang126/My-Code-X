import { AppError } from "../app-error";
import { withCodexAppServerClient } from "../codex-app-server/client";
import {
  codexProtocolError,
  parseCodexThreadListItem
} from "../codex-thread-browser/codex-app-server-thread-browser";
import type {
  CodexConversationHistoryGateway,
  CodexRestoredThreadItem,
  CodexRestoredThread,
  CodexRestoredTurn,
  CodexRestoredUserInput
} from "./codex-conversation-history-gateway";

export interface CreateCodexAppServerConversationHistoryGatewayInput {
  command?: string;
  requestTimeoutMs?: number;
}

export function createCodexAppServerConversationHistoryGateway(
  input: CreateCodexAppServerConversationHistoryGatewayInput = {}
): CodexConversationHistoryGateway {
  const command = input.command ?? "codex";
  const requestTimeoutMs = input.requestTimeoutMs ?? 15_000;

  return {
    async restoreThread(request) {
      try {
        const result = await withCodexAppServerClient({
          command,
          requestTimeoutMs,
          run: (client) =>
            client.request("thread/resume", {
              threadId: request.threadId,
              persistExtendedHistory: true
            })
        });

        return parseThreadResumeResponse(result);
      } catch (error) {
        if (isThreadResumeNotFound(error)) {
          return null;
        }

        throw error;
      }
    }
  };
}

function parseThreadResumeResponse(raw: unknown): CodexRestoredThread {
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

  const id = item.id;
  if (id !== undefined && typeof id !== "string") {
    throw codexProtocolError("Invalid Codex thread/resume item field: id");
  }
  return id === undefined ? { type } : { type, id };
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

function isThreadResumeNotFound(error: unknown): boolean {
  if (!(error instanceof AppError) || error.code !== "CODEX_REQUEST_REJECTED") {
    return false;
  }

  return (
    error.message.startsWith("thread not loaded:") ||
    error.message.startsWith("invalid thread id:") ||
    error.message.startsWith("no rollout found for thread id ") ||
    error.message.startsWith("thread not found:")
  );
}
