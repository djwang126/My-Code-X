import { once } from 'node:events';
import readline from 'node:readline';
import {
  CodexProcessExitError,
  CodexProcessStartError,
  CodexRequestTimeoutError,
  CodexRpcError,
  CodexTransportClosedError,
} from '../runtime/codex-runtime-error.js';
import { parseCodexIncomingMessage, readOptionalString, type CodexIncomingMessage } from './jsonl-message.js';
import { startCodexProcess } from './start-codex-process.js';
import type { EnvironmentVariables, JsonObject, JsonValue } from '../../../shared/index.js';

export type CodexTransportNotificationHandler = (message: CodexIncomingMessage) => void;

export type CodexTransportTimerHandle = unknown;

export interface CodexTransportTimer {
  setTimeout(callback: () => void, milliseconds: number): CodexTransportTimerHandle;
  clearTimeout(handle: CodexTransportTimerHandle): void;
}

export interface CodexJsonlTransportInput {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: EnvironmentVariables;
  readonly requestTimeoutMs: number;
  readonly requestTimer?: CodexTransportTimer;
}

export interface CodexJsonlTransport {
  request(input: CodexTransportRequest): Promise<JsonValue>;
  notify(input: CodexTransportNotification): Promise<void>;
  respondToServerRequest(input: CodexServerRequestResponse): Promise<void>;
  subscribe(handler: CodexTransportNotificationHandler): () => void;
  close(): Promise<void>;
}

export interface CodexTransportRequest {
  readonly method: string;
  readonly params: JsonObject;
}

export interface CodexServerRequestResponse {
  readonly requestId: string;
  readonly result: JsonValue;
}

export interface CodexTransportNotification {
  readonly method: string;
  readonly params: JsonObject | null;
}

interface PendingRequest {
  readonly method: string;
  readonly resolve: (value: JsonValue) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId: CodexTransportTimerHandle;
}

const systemRequestTimer: CodexTransportTimer = {
  setTimeout(callback: () => void, milliseconds: number): CodexTransportTimerHandle {
    return setTimeout(callback, milliseconds);
  },

  clearTimeout(handle: CodexTransportTimerHandle): void {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

export function createJsonlTransport(input: CodexJsonlTransportInput): CodexJsonlTransport {
  const requestTimer = input.requestTimer ?? systemRequestTimer;
  const child = startCodexProcess(input);
  const reader = readline.createInterface({ input: child.stdout });
  const handlers = new Set<CodexTransportNotificationHandler>();
  const pendingRequests = new Map<string, PendingRequest>();
  const pendingServerRequestIds = new Map<string, string>();
  let nextRequestId = 0;
  let closed = false;
  let transportError: Error | null = null;
  let stderrBuffer = '';

  function rejectPendingRequests(error: Error) {
    for (const [id, pending] of pendingRequests.entries()) {
      requestTimer.clearTimeout(pending.timeoutId);
      pending.reject(error);
      pendingRequests.delete(id);
    }
  }

  function setTransportError(error: Error) {
    if (transportError) {
      return;
    }

    transportError = error;
    rejectPendingRequests(error);
  }

  function ensureOpen() {
    if (closed || transportError) {
      throw transportError ?? new CodexTransportClosedError();
    }
  }

  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer = `${stderrBuffer}${chunk.toString('utf-8')}`.slice(-8_192);
  });

  child.on('error', error => {
    const message = error instanceof Error ? error.message : String(error);
    setTransportError(new CodexProcessStartError(message));
  });

  child.on('close', (code, signal) => {
    if (closed) {
      return;
    }

    const reason = code === null ? `signal ${String(signal ?? 'unknown')}` : `code ${String(code)}`;
    setTransportError(new CodexProcessExitError(reason, stderrBuffer.trim()));
  });

  reader.on('line', (line: string) => {
    try {
      handleIncomingMessage(parseCodexIncomingMessage(line));
    } catch (error) {
      setTransportError(error instanceof Error ? error : new Error(String(error)));
    }
  });

  function handleIncomingMessage(message: CodexIncomingMessage) {
    if (message.kind === 'notification') {
      for (const handler of handlers) {
        handler(message);
      }
      return;
    }

    if (message.kind === 'server-request') {
      pendingServerRequestIds.set(message.id, message.id);
      for (const handler of handlers) {
        handler(message);
      }
      return;
    }

    const pending = pendingRequests.get(message.id);

    if (!pending) {
      return;
    }

    pendingRequests.delete(message.id);
    requestTimer.clearTimeout(pending.timeoutId);

    if (message.kind === 'error-response') {
      const code = typeof message.error.code === 'number' ? message.error.code : null;
      const fallbackMessage = `Codex RPC failed: ${pending.method}`;
      const errorMessage = readOptionalString(message.error.message, 'Codex RPC error message') ?? fallbackMessage;
      pending.reject(new CodexRpcError(pending.method, code, errorMessage));
      return;
    }

    pending.resolve(message.result);
  }

  async function writeMessage(message: JsonObject): Promise<void> {
    ensureOpen();

    await new Promise<void>((resolve, reject) => {
      child.stdin.write(`${JSON.stringify(message)}\n`, error => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  return {
    async request(requestInput: CodexTransportRequest): Promise<JsonValue> {
      ensureOpen();

      const id = String(++nextRequestId);
      const response = new Promise<JsonValue>((resolve, reject) => {
        const timeoutId = requestTimer.setTimeout(() => {
          pendingRequests.delete(id);
          reject(new CodexRequestTimeoutError(requestInput.method, input.requestTimeoutMs));
        }, input.requestTimeoutMs);

        pendingRequests.set(id, {
          method: requestInput.method,
          resolve,
          reject,
          timeoutId,
        });
      });

      try {
        await writeMessage({
          id,
          method: requestInput.method,
          params: requestInput.params,
        });
      } catch (error) {
        const pending = pendingRequests.get(id);

        if (pending) {
          requestTimer.clearTimeout(pending.timeoutId);
          pendingRequests.delete(id);
        }

        throw error;
      }

      return response;
    },

    async notify(notificationInput: CodexTransportNotification): Promise<void> {
      const message: JsonObject =
        notificationInput.params === null
          ? { method: notificationInput.method }
          : { method: notificationInput.method, params: notificationInput.params };

      await writeMessage(message);
    },

    async respondToServerRequest(responseInput: CodexServerRequestResponse): Promise<void> {
      const requestId = pendingServerRequestIds.get(responseInput.requestId) ?? responseInput.requestId;
      pendingServerRequestIds.delete(responseInput.requestId);

      await writeMessage({
        id: requestId,
        result: responseInput.result,
      });
    },

    subscribe(handler: CodexTransportNotificationHandler): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      rejectPendingRequests(new CodexTransportClosedError());
      pendingServerRequestIds.clear();
      handlers.clear();
      reader.close();

      if (!child.stdin.destroyed) {
        child.stdin.end();
      }

      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      const closedProcess = once(child, 'close').catch(() => null);
      const killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill();
        }
      }, 250);

      await closedProcess;
      clearTimeout(killTimer);
    },
  };
}
