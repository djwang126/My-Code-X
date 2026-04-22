import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import readline from 'node:readline';
import { once } from 'node:events';
import { createCodexRuntimeErrorFromRpcError } from './codex-runtime-error.js';
import type { LooseRecord, TimerHandle } from './codex-types.js';
type ProcessEnv = typeof process.env;
function createTransportError(message: any) {
    return new Error(message);
}
function getRawErrorMessage(error: any, fallbackMessage: any) {
    if (error instanceof Error && error.message)
        return error.message;
    if (typeof error === 'string' && error)
        return error;
    return fallbackMessage;
}
function appendStderrBuffer(buffer: any, chunk: any, maxChars: any) {
    const next = `${buffer}${chunk}`;
    if (next.length <= maxChars) {
        return next;
    }
    return next.slice(-maxChars);
}
function getPreferredTransportMessage(stderrBuffer: any, fallbackMessage: any) {
    const stderrMessage = stderrBuffer.trim();
    return stderrMessage || fallbackMessage;
}
export async function startCodexJsonlTransport({ command = 'codex', args = ['app-server'], cwd = process.cwd(), env = process.env, requestTimeoutMs = 300000, stderrBufferLimit = 8192, spawnImpl = spawn, }: {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: ProcessEnv;
    requestTimeoutMs?: number;
    stderrBufferLimit?: number;
    spawnImpl?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
} = {}) {
    const child = spawnImpl(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
    });
    const stdin = child.stdin;
    const stdout = child.stdout;
    const stderr = child.stderr;
    if (!stdin)
        throw createTransportError('codex app-server stdin unavailable');
    if (!stdout)
        throw createTransportError('codex app-server stdout unavailable');
    let stderrBuffer = '';
    let requestId = 0;
    let closing = false;
    let childClosed = false;
    let transportError: any = null;
    let notificationHandler = (_method: string, _params?: LooseRecord) => { };
    let serverRequestHandler = (_requestId: string, _method: string, _params?: LooseRecord) => { };
    const pendingRequests = new Map<string, {
        resolve: (value: LooseRecord) => void;
        reject: (error: unknown) => void;
        timeoutId: TimerHandle;
        method: string;
    }>();
    const pendingServerRequestIds = new Map<string, string | number>();
    const reader = readline.createInterface({
        input: stdout,
        crlfDelay: Infinity,
    });
    stderr?.setEncoding('utf8');
    stderr?.on('data', (chunk: any) => {
        stderrBuffer = appendStderrBuffer(stderrBuffer, chunk, stderrBufferLimit);
    });
    stderr?.resume();
    function rejectPendingRequests(error: any) {
        for (const pending of pendingRequests.values()) {
            clearTimeout(pending.timeoutId);
            pending.reject(error);
        }
        pendingRequests.clear();
    }
    function setTransportError(error: any) {
        if (closing)
            return;
        if (transportError)
            return;
        transportError = error instanceof Error ? error : createTransportError(String(error));
        rejectPendingRequests(transportError);
    }
    function setTransportErrorFromFallback(fallbackMessage: any) {
        setTransportError(createTransportError(getPreferredTransportMessage(stderrBuffer, fallbackMessage)));
    }
    reader.on('line', (line: any) => {
        if (!line.trim())
            return;
        let message;
        try {
            message = JSON.parse(line);
        }
        catch (error) {
            setTransportError(createTransportError(getRawErrorMessage(error, 'invalid codex app-server json')));
            return;
        }
        if (typeof message.method === 'string' && !('id' in message)) {
            notificationHandler(message.method, message.params);
            return;
        }
        if (typeof message.method === 'string' && 'id' in message && !('result' in message) && !('error' in message)) {
            const normalizedRequestId = String(message.id);
            pendingServerRequestIds.set(normalizedRequestId, message.id);
            serverRequestHandler(normalizedRequestId, message.method, message.params);
            return;
        }
        const pending = pendingRequests.get(String(message.id));
        if (!pending) {
            return;
        }
        pendingRequests.delete(String(message.id));
        clearTimeout(pending.timeoutId);
        if ('error' in message && message.error) {
            pending.reject(createCodexRuntimeErrorFromRpcError({ error: message.error, method: pending.method }));
            return;
        }
        pending.resolve(message.result);
    });
    reader.on('close', () => {
        if (closing)
            return;
        setTimeout(() => {
            if (!transportError && !closing && !childClosed) {
                setTransportErrorFromFallback('codex app-server closed stdout');
            }
        }, 25);
    });
    child.on('error', (error: any) => {
        setTransportError(createTransportError(getRawErrorMessage(error, 'failed to start codex app-server')));
    });
    child.on('close', (code: any, signal: any) => {
        childClosed = true;
        if (closing)
            return;
        if (code !== null) {
            setTransportErrorFromFallback(`codex app-server exited with code ${code}`);
            return;
        }
        if (signal) {
            setTransportErrorFromFallback(`codex app-server exited with signal ${signal}`);
            return;
        }
        setTransportErrorFromFallback('codex app-server exited');
    });
    async function writeMessage(message: LooseRecord) {
        if (transportError) {
            throw transportError;
        }
        await new Promise<void>((resolve: any, reject: any) => {
            stdin!.write(`${JSON.stringify(message)}\n`, (error: any) => {
                if (error) {
                    reject(transportError ||
                        createTransportError(getPreferredTransportMessage(stderrBuffer, getRawErrorMessage(error, 'failed to write to codex app-server stdin'))));
                    return;
                }
                resolve();
            });
        });
    }
    async function sendRequest(method: string, params?: LooseRecord) {
        if (transportError) {
            throw transportError;
        }
        const id = String(++requestId);
        const responsePromise = new Promise<LooseRecord>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                pendingRequests.delete(id);
                reject(createTransportError(`codex app-server request timed out: ${method}`));
            }, requestTimeoutMs);
            pendingRequests.set(id, { resolve, reject, timeoutId, method });
        });
        try {
            await writeMessage({ id, method, params });
        }
        catch (error) {
            const pending = pendingRequests.get(id);
            if (pending) {
                clearTimeout(pending.timeoutId);
                pendingRequests.delete(id);
            }
            throw error;
        }
        return responsePromise;
    }
    return {
        setNotificationHandler(nextHandler: (method: string, params?: LooseRecord) => void) {
            notificationHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
        },
        setServerRequestHandler(nextHandler: (requestId: string, method: string, params?: LooseRecord) => void) {
            serverRequestHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
        },
        async sendRequest(method: string, params?: LooseRecord) {
            return sendRequest(method, params);
        },
        async sendServerRequestResponse(requestId: string, result?: LooseRecord) {
            const normalizedRequestId = String(requestId);
            const protocolRequestId = pendingServerRequestIds.get(normalizedRequestId) ?? requestId;
            pendingServerRequestIds.delete(normalizedRequestId);
            await writeMessage({ id: protocolRequestId, result });
        },
        async sendNotification(method: string, params?: LooseRecord) {
            await writeMessage(params === undefined ? { method } : { method, params });
        },
        async close() {
            closing = true;
            rejectPendingRequests(createTransportError('codex app-server closed'));
            pendingServerRequestIds.clear();
            reader.close();
            if (stdin && !stdin.destroyed) {
                stdin.end();
            }
            if (child.exitCode !== null || child.signalCode !== null) {
                return;
            }
            const exitPromise = once(child, 'close').catch(() => { });
            const killTimer = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill();
                }
            }, 250);
            await exitPromise;
            clearTimeout(killTimer);
        },
    };
}
