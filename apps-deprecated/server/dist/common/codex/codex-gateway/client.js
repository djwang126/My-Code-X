import { createDefaultRuntimePreferences, createForkThreadParams, createResumeThreadParams, createStartThreadParams, createStartTurnParams, normalizeResumeThreadResult, } from '../codex-gateway-protocol.js';
import { buildCodexWorkspacePathStrategy } from '../codex-workspace-path.js';
import { listThreadsWithWorkspaceFallback } from './thread-list.js';
export function createGatewayClient({ cwd, dynamicToolSpecs, state, transport, workspacePathDebugEnabled, }) {
    function resolveWorkspaceCwd(workspace) {
        return buildCodexWorkspacePathStrategy(workspace, cwd).executionCwd;
    }
    return {
        async close() {
            await transport.close();
        },
        getOptions() {
            return state.getOptions();
        },
        getPreferences() {
            return state.getPreferences();
        },
        async compactThread({ threadId } = {}) {
            await transport.sendRequest('thread/compact/start', { threadId });
            return { ok: true, threadId };
        },
        async forkThread({ threadId, workspace, runtimeSettings, baseInstructions, } = {}) {
            const result = await transport.sendRequest('thread/fork', createForkThreadParams({
                threadId,
                cwd: resolveWorkspaceCwd(workspace),
                runtimeSettings,
                baseInstructions,
            }));
            return {
                threadId: result.thread.id,
            };
        },
        async interruptTurn({ threadId, turnId } = {}) {
            await transport.sendRequest('turn/interrupt', {
                threadId,
                turnId,
            });
            return { ok: true };
        },
        async listThreads({ workspace, limit = 20, archived = false } = {}) {
            return listThreadsWithWorkspaceFallback({
                archived,
                limit,
                transport,
                workspace,
                workspacePathDebugEnabled,
            });
        },
        resolveWorkspaceCwd,
        async respondToRequest({ requestId, response }) {
            await transport.sendServerRequestResponse(requestId, response);
            return { ok: true, requestId };
        },
        async resumeThread({ threadId, workspace, runtimeSettings, baseInstructions, } = {}) {
            const result = await transport.sendRequest('thread/resume', createResumeThreadParams({
                threadId,
                cwd: resolveWorkspaceCwd(workspace),
                runtimeSettings,
                baseInstructions,
            }));
            return normalizeResumeThreadResult(result);
        },
        async rollbackThread({ threadId, workspace, numTurns } = {}) {
            const result = await transport.sendRequest('thread/rollback', {
                threadId,
                cwd: resolveWorkspaceCwd(workspace),
                numTurns,
            });
            return {
                ok: true,
                threadId: result.thread?.id || threadId,
            };
        },
        setNotificationHandler(nextHandler) {
            state.setNotificationHandler(nextHandler);
        },
        async setThreadName({ threadId, name } = {}) {
            await transport.sendRequest('thread/name/set', {
                threadId,
                name,
            });
            return { ok: true, threadId, name };
        },
        async startReview({ threadId, delivery = 'inline', target, } = {}) {
            const result = await transport.sendRequest('review/start', {
                threadId,
                delivery,
                target,
            });
            return {
                reviewThreadId: result?.reviewThreadId || '',
            };
        },
        async startThread({ workspace, runtimeSettings, baseInstructions, } = {}) {
            const result = await transport.sendRequest('thread/start', createStartThreadParams({
                cwd: resolveWorkspaceCwd(workspace),
                dynamicToolSpecs,
                runtimeSettings,
                baseInstructions,
            }));
            return {
                threadId: result.thread.id,
            };
        },
        async startTurn({ threadId, workspace, text, content, runtimeSettings, collaborationModeKind, } = {}) {
            const collaborationMode = state.getCollaborationModePreset(collaborationModeKind);
            const result = await transport.sendRequest('turn/start', createStartTurnParams({
                threadId,
                text,
                content,
                cwd: resolveWorkspaceCwd(workspace),
                runtimeSettings,
                runtimePreferences: state.getRuntimePreferencesOrDefault(createDefaultRuntimePreferences),
                collaborationMode,
            }));
            return {
                turnId: result.turn.id,
            };
        },
    };
}
//# sourceMappingURL=client.js.map