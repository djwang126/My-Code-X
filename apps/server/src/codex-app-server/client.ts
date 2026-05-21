import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { AppError } from "../app-error";

export interface CodexAppServerClientInput {
  command: string;
  requestTimeoutMs: number;
}

export interface CodexAppServerClient {
  initialize(): Promise<void>;
  request(method: string, params: unknown): Promise<unknown>;
  close(): void;
}

export interface WithCodexAppServerClientInput<T>
  extends CodexAppServerClientInput {
  run(client: CodexAppServerClient): Promise<T>;
}

export async function withCodexAppServerClient<T>(
  input: WithCodexAppServerClientInput<T>
): Promise<T> {
  const client = createCodexAppServerClient(input);

  try {
    await client.initialize();
    return await input.run(client);
  } finally {
    client.close();
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

function createCodexAppServerClient(
  input: CodexAppServerClientInput
): CodexAppServerClient {
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
