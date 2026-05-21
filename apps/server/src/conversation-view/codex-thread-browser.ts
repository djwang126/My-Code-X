import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { AppError } from "../app-error";

export interface CodexThreadBrowser {
  listThreads(input: ListCodexThreadsInput): Promise<CodexThreadListItem[]>;
}

export interface ListCodexThreadsInput {
  cwd: string;
  limit: number;
}

export interface CodexThreadListItem {
  id: string;
  name: string | null;
  preview: string;
  cwd: string | null;
  updatedAt: number | null;
  status: CodexThreadStatus;
}

export type CodexThreadStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError"; message?: string }
  | { type: "active"; activeTurnId?: string };

export function createUnavailableCodexThreadBrowser(): CodexThreadBrowser {
  return {
    async listThreads() {
      return [];
    }
  };
}

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
      const client = createCodexAppServerClient({
        command,
        requestTimeoutMs
      });

      try {
        await client.initialize();
        const result = await client.request("thread/list", {
          cwd: request.cwd,
          limit: request.limit
        });

        return parseThreadListResponse(result);
      } finally {
        client.close();
      }
    }
  };
}

interface CodexAppServerClientInput {
  command: string;
  requestTimeoutMs: number;
}

interface CodexAppServerClient {
  initialize(): Promise<void>;
  request(method: string, params: unknown): Promise<unknown>;
  close(): void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

function createCodexAppServerClient(input: CodexAppServerClientInput): CodexAppServerClient {
  const child = spawn(input.command, ["app-server", "--listen", "stdio://"], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const pending = new Map<number, PendingRequest>();
  const rl = readline.createInterface({
    input: child.stdout
  });
  let nextId = 1;
  let closed = false;

  child.once("error", (error) => {
    rejectAll(
      pending,
      codexConnectionUnavailable(`Codex app-server failed to start: ${error.message}`)
    );
  });
  child.once("exit", (code, signal) => {
    if (!closed) {
      rejectAll(
        pending,
        codexConnectionUnavailable(
          `Codex app-server exited before response: code=${code} signal=${signal}`
        )
      );
    }
  });
  rl.on("line", (line) => {
    receiveLine(line, pending);
  });

  return {
    async initialize() {
      await sendRequest({
        child,
        pending,
        requestTimeoutMs: input.requestTimeoutMs,
        id: nextId++,
        method: "initialize",
        params: {
          clientInfo: {
            name: "my-code-x",
            title: "My-Code-X",
            version: "0.1.0"
          },
          capabilities: {
            experimentalApi: true,
            optOutNotificationMethods: []
          }
        }
      });
      child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
    },

    request(method, params) {
      return sendRequest({
        child,
        pending,
        requestTimeoutMs: input.requestTimeoutMs,
        id: nextId++,
        method,
        params
      });
    },

    close() {
      closed = true;
      rl.close();
      child.kill();
    }
  };
}

interface SendRequestInput {
  child: ChildProcessWithoutNullStreams;
  pending: Map<number, PendingRequest>;
  requestTimeoutMs: number;
  id: number;
  method: string;
  params: unknown;
}

function sendRequest(input: SendRequestInput): Promise<unknown> {
  const message = {
    id: input.id,
    method: input.method,
    params: input.params
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      input.pending.delete(input.id);
      reject(
        codexConnectionUnavailable(
          `Codex app-server request timed out: ${input.method}`
        )
      );
    }, input.requestTimeoutMs);

    input.pending.set(input.id, {
      resolve,
      reject,
      timer
    });

    input.child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
      if (!error) {
        return;
      }

      const pendingRequest = input.pending.get(input.id);
      if (!pendingRequest) {
        return;
      }

      clearTimeout(pendingRequest.timer);
      input.pending.delete(input.id);
      pendingRequest.reject(
        codexConnectionUnavailable(
          `Failed to send Codex app-server request: ${error.message}`
        )
      );
    });
  });
}

function receiveLine(line: string, pending: Map<number, PendingRequest>) {
  const parsed = parseJsonObject(line);
  if (!parsed || !("id" in parsed) || typeof parsed.id !== "number") {
    return;
  }

  const request = pending.get(parsed.id);
  if (!request) {
    return;
  }

  clearTimeout(request.timer);
  pending.delete(parsed.id);

  if ("error" in parsed) {
    request.reject(codexRequestRejected(codexErrorMessage(parsed.error)));
    return;
  }

  request.resolve("result" in parsed ? parsed.result : null);
}

function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function codexErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Codex app-server request failed";
}

function rejectAll(pending: Map<number, PendingRequest>, error: Error) {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    pending.delete(id);
    request.reject(error);
  }
}

function parseThreadListResponse(raw: unknown): CodexThreadListItem[] {
  if (typeof raw !== "object" || raw === null || !("data" in raw)) {
    throw codexProtocolError("Invalid Codex thread/list response");
  }

  const data = (raw as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw codexProtocolError("Invalid Codex thread/list response");
  }

  return data.map(parseThreadListItem);
}

function parseThreadListItem(raw: unknown): CodexThreadListItem {
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
    return { type: "systemError" };
  }

  if (type === "active") {
    return { type: "active" };
  }

  return { type: "notLoaded" };
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

function codexConnectionUnavailable(message: string): AppError {
  return new AppError({
    code: "CODEX_CONNECTION_UNAVAILABLE",
    message,
    status: 503,
    retryable: true
  });
}

function codexRequestRejected(message: string): AppError {
  return new AppError({
    code: "CODEX_REQUEST_REJECTED",
    message,
    status: 502,
    retryable: false
  });
}

function codexProtocolError(message: string): AppError {
  return new AppError({
    code: "CODEX_PROTOCOL_ERROR",
    message,
    status: 502,
    retryable: false
  });
}
