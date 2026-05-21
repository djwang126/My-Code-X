import { AppError } from "../app-error";
import { withCodexAppServerClient } from "../codex-app-server/client";
import type {
  CodexThreadBrowser,
  CodexThreadListItem,
  CodexThreadStatus
} from "./codex-thread-browser";

export interface CreateCodexAppServerThreadBrowserInput {
  command?: string;
  requestTimeoutMs?: number;
}

export function createCodexAppServerThreadBrowser(
  input: CreateCodexAppServerThreadBrowserInput = {}
): CodexThreadBrowser {
  const command = input.command ?? "codex";
  const requestTimeoutMs = input.requestTimeoutMs ?? 15_000;

  return {
    async listThreads(request) {
      const result = await withCodexAppServerClient({
        command,
        requestTimeoutMs,
        run: (client) =>
          client.request("thread/list", {
            cwd: request.cwd,
            limit: request.limit
          })
      });

      return parseThreadListResponse(result);
    },

    async readThread(request) {
      try {
        const result = await withCodexAppServerClient({
          command,
          requestTimeoutMs,
          run: (client) =>
            client.request("thread/read", {
              threadId: request.threadId,
              includeTurns: false
            })
        });

        return parseThreadReadResponse(result);
      } catch (error) {
        if (isThreadReadNotFound(error)) {
          return null;
        }

        throw error;
      }
    }
  };
}

function parseThreadListResponse(raw: unknown): CodexThreadListItem[] {
  if (typeof raw !== "object" || raw === null || !("data" in raw)) {
    throw codexProtocolError("Invalid Codex thread/list response");
  }

  const data = (raw as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw codexProtocolError("Invalid Codex thread/list response");
  }

  return data.map(parseCodexThreadListItem);
}

function parseThreadReadResponse(raw: unknown): CodexThreadListItem {
  if (typeof raw !== "object" || raw === null || !("thread" in raw)) {
    throw codexProtocolError("Invalid Codex thread/read response");
  }

  return parseCodexThreadListItem((raw as { thread: unknown }).thread);
}

export function parseCodexThreadListItem(raw: unknown): CodexThreadListItem {
  if (typeof raw !== "object" || raw === null) {
    throw codexProtocolError("Invalid Codex thread/list item");
  }

  const item = raw as Record<string, unknown>;
  const id = readString(item, "id");
  const preview = readString(item, "preview");
  const cwd = readNullableString(item, "cwd");
  const name = readNullableString(item, "name");
  const updatedAt = readNullableNumber(item, "updatedAt");
  const status = parseThreadStatus(item.status);

  return {
    id,
    name,
    preview,
    cwd,
    updatedAt,
    status
  };
}

function parseThreadStatus(raw: unknown): CodexThreadStatus {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) {
    return { type: "notLoaded" };
  }

  const type = (raw as { type: unknown }).type;
  if (type === "idle") {
    return { type: "idle" };
  }

  if (type === "systemError") {
    const message = readOptionalString(raw as Record<string, unknown>, "message");
    return message ? { type: "systemError", message } : { type: "systemError" };
  }

  if (type === "active") {
    const activeFlags = readStringArray(
      raw as Record<string, unknown>,
      "activeFlags"
    );
    return { type: "active", activeFlags };
  }

  return { type: "unknown" };
}

function readString(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  if (typeof value !== "string") {
    throw codexProtocolError(`Invalid Codex thread/list item field: ${key}`);
  }

  return value;
}

function readNullableString(item: Record<string, unknown>, key: string): string | null {
  const value = item[key];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw codexProtocolError(`Invalid Codex thread/list item field: ${key}`);
  }

  return value;
}

function readOptionalString(
  item: Record<string, unknown>,
  key: string
): string | undefined {
  const value = item[key];
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw codexProtocolError(`Invalid Codex thread/list item field: ${key}`);
  }

  return value;
}

function readStringArray(item: Record<string, unknown>, key: string): string[] {
  const value = item[key];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw codexProtocolError(`Invalid Codex thread/list item field: ${key}`);
  }

  return value;
}

function readNullableNumber(item: Record<string, unknown>, key: string): number | null {
  const value = item[key];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number") {
    throw codexProtocolError(`Invalid Codex thread/list item field: ${key}`);
  }

  return value;
}

export function codexProtocolError(message: string): AppError {
  return new AppError({
    code: "CODEX_PROTOCOL_ERROR",
    message,
    status: 502,
    retryable: false
  });
}

function isThreadReadNotFound(error: unknown): boolean {
  if (!(error instanceof AppError) || error.code !== "CODEX_REQUEST_REJECTED") {
    return false;
  }

  return (
    error.message.startsWith("thread not loaded:") ||
    error.message.startsWith("invalid thread id:")
  );
}
