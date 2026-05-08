import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { authToken as defaultAuthToken, codexBin as defaultCodexBin, codexDynamicTools as defaultCodexDynamicTools, codexIdleShutdownConfig as defaultCodexIdleShutdownConfig, codexWorkingDir as defaultCodexWorkingDir, frontendDistDir as defaultFrontendDistDir, host as defaultHost, myCodeXCustomHarnessDir as defaultMyCodeXCustomHarnessDir, port as defaultPort, restartScript as defaultRestartScript, serverInstanceId as defaultServerInstanceId, } from '../config/config.js';
import { createHttpError } from '../common/errors/http-error.js';
import { createApp } from './app.js';
import { canShutdownCodexForIdle, createCodexGatewayManager, startCodexGateway } from '../common/codex/index.js';
import { spawnRestartProcess } from '../modules/app-control/index.js';
import { createChatService } from '../modules/chat/index.js';
import { createPromptOverrideResolver, loadPromptOverrideSnapshot } from '../modules/custom-harness/index.js';
const CODEX_EVENT_DEBUG_ENABLED = process.env.MY_CODE_X_DEBUG_STREAM_TIMING === '1' || process.env.MY_CODE_X_DEBUG_STREAM_TIMING === 'true';
function logCodexEventDebug(stage, details = {}) {
    if (!CODEX_EVENT_DEBUG_ENABLED) {
        return;
    }
    const payload = {
        ts: new Date().toISOString(),
        scope: 'codex',
        stage,
        ...details,
    };
    process.stdout.write(`[my-code-x-debug] ${JSON.stringify(payload)}\n`);
}
function logPromptOverrideWarning(error) {
    process.stderr.write(`[my-code-x] prompt override discovery failed: ${error instanceof Error ? error.message : String(error)}\n`);
}
function logBestEffortCloseFailure(scope, error) {
    process.stderr.write(`[my-code-x] ${scope} failed during shutdown: ${error instanceof Error ? error.message : String(error)}\n`);
}
async function runBestEffortClose(scope, closeOperation) {
    try {
        await closeOperation();
    }
    catch (error) {
        logBestEffortCloseFailure(scope, error);
    }
}
function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            resolve();
        });
    });
}
function closeHttpServer(server) {
    return new Promise((resolve, reject) => {
        if (!server.listening) {
            resolve();
            return;
        }
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
async function ensureCodexWorkingDir(codexWorkingDir) {
    const normalizedPath = typeof codexWorkingDir === 'string' ? codexWorkingDir.trim() : '';
    if (!normalizedPath) {
        return;
    }
    await fs.mkdir(normalizedPath, { recursive: true });
}
export async function startServer({ host = defaultHost, port = defaultPort, authToken = defaultAuthToken, serverInstanceId = defaultServerInstanceId, frontendDistDir = defaultFrontendDistDir, codexCommand = defaultCodexBin, codexArgs = ['app-server'], codexWorkingDir = defaultCodexWorkingDir, customHarnessDir = defaultMyCodeXCustomHarnessDir, codexDynamicTools = defaultCodexDynamicTools, codexEnv, idleShutdownConfig = defaultCodexIdleShutdownConfig, restartScript = defaultRestartScript, } = {}) {
    let codexGateway = null;
    let server = null;
    let closed = false;
    let restartInProgress = false;
    let restartShutdownToken = '';
    let restartClosePromise = null;
    async function closeStartedResources() {
        if (closed) {
            return restartClosePromise ?? Promise.resolve();
        }
        closed = true;
        restartClosePromise = (async () => {
            if (server) {
                await closeHttpServer(server);
            }
            if (codexGateway) {
                await codexGateway.close();
            }
        })();
        return restartClosePromise;
    }
    try {
        let promptOverrideSnapshot = null;
        let promptOverrideDiscoveryFailed = false;
        try {
            promptOverrideSnapshot = await loadPromptOverrideSnapshot({ customHarnessRoot: customHarnessDir });
        }
        catch (error) {
            logPromptOverrideWarning(error);
            promptOverrideDiscoveryFailed = true;
            promptOverrideSnapshot = {
                options: [],
                instructionsByPromptOverride: new Map(),
            };
        }
        const promptOverrideResolver = createPromptOverrideResolver({
            customHarnessRoot: customHarnessDir,
            promptOverrideSnapshot,
        });
        const promptOverrideOptions = Array.isArray(promptOverrideSnapshot?.options) ? promptOverrideSnapshot.options : [];
        let chatService = null;
        await ensureCodexWorkingDir(codexWorkingDir);
        codexGateway = createCodexGatewayManager({
            idleShutdownConfig,
            createGateway: async () => startCodexGateway({
                command: codexCommand,
                args: codexArgs,
                cwd: codexWorkingDir,
                env: codexEnv,
                dynamicToolSpecs: codexDynamicTools,
                promptOverrideOptions: promptOverrideOptions.length || promptOverrideDiscoveryFailed ? promptOverrideOptions : undefined,
            }),
            isSafeToShutdown: () => canShutdownCodexForIdle({
                activitySnapshot: chatService ? chatService.getCodexActivitySnapshot() : { sessions: [] },
            }),
        });
        await codexGateway.initialize();
        chatService = createChatService({ codexGateway: codexGateway, promptOverrideResolver });
        codexGateway.setNotificationHandler((event) => {
            logCodexEventDebug('event_received', {
                eventType: event?.type || 'unknown',
                threadId: event?.threadId || '',
                turnId: event?.turnId ?? event?.turn?.id ?? null,
                itemId: event?.itemId ?? event?.item?.id ?? event?.messageId ?? event?.request?.id ?? null,
            });
            chatService.applyGatewayEvent(event);
        });
        const restartShutdownHandler = restartScript
            ? async ({ token }) => {
                if (!restartInProgress || !restartShutdownToken || token !== restartShutdownToken) {
                    throw createHttpError('invalid restart token', 403);
                }
                setImmediate(() => {
                    runBestEffortClose('close started resources', closeStartedResources);
                });
                return {
                    ok: true,
                    shuttingDown: true,
                };
            }
            : null;
        const restartHandler = restartScript
            ? async ({ viewerId, slotId, workspace, threadId, }) => {
                if (restartInProgress) {
                    return {
                        ok: true,
                        restarting: true,
                        alreadyRestarting: true,
                    };
                }
                restartInProgress = true;
                restartShutdownToken = randomUUID();
                spawnRestartProcess(restartScript, {
                    cwd: codexWorkingDir,
                    env: {
                        ...process.env,
                        WEB_CODEX_RESTART_VIEWER_ID: viewerId,
                        WEB_CODEX_RESTART_SLOT_ID: slotId,
                        WEB_CODEX_RESTART_WORKSPACE: workspace,
                        WEB_CODEX_RESTART_THREAD_ID: threadId,
                        WEB_CODEX_RESTART_HOST: host,
                        WEB_CODEX_RESTART_PORT: String(port),
                        WEB_CODEX_RESTART_SERVER_PID: String(process.pid),
                        WEB_CODEX_RESTART_SHUTDOWN_TOKEN: restartShutdownToken,
                    },
                });
                return {
                    ok: true,
                    restarting: true,
                };
            }
            : null;
        server = createServer(createApp({
            authToken,
            serverInstanceId,
            frontendDistDir,
            chatService,
            restartHandler,
            restartShutdownHandler,
        }));
        await listen(server, port, host);
        return {
            server,
            codexGateway,
            chatService,
            async close() {
                await closeStartedResources();
            },
        };
    }
    catch (error) {
        if (server?.listening) {
            const startedServer = server;
            await runBestEffortClose('http server close', () => closeHttpServer(startedServer));
        }
        if (codexGateway) {
            const activeGateway = codexGateway;
            await runBestEffortClose('codex gateway close', () => activeGateway.close());
        }
        throw error;
    }
}
//# sourceMappingURL=server.js.map