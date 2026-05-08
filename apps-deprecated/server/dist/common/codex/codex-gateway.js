import { mapCodexNotificationToRuntimeEvent, mapCodexServerRequestToRuntimeEvent, } from './codex-gateway-protocol.js';
import { startCodexJsonlTransport } from './codex-jsonl-transport.js';
import { bootstrapCodexGateway } from './codex-gateway/bootstrap.js';
import { createGatewayClient } from './codex-gateway/client.js';
import { createGatewayState } from './codex-gateway/state.js';
import { isWorkspacePathDebugEnabled } from './codex-gateway/workspace-path-debug.js';
export async function startCodexGateway({ command = 'codex', args = ['app-server'], cwd = process.cwd(), env = process.env, requestTimeoutMs = 300000, dynamicToolSpecs = [], promptOverrideOptions, } = {}) {
    const transport = await startCodexJsonlTransport({
        command,
        args,
        cwd,
        env,
        requestTimeoutMs,
    });
    const state = createGatewayState();
    transport.setNotificationHandler((method, params) => {
        const event = mapCodexNotificationToRuntimeEvent(method, params);
        if (event) {
            state.handleNotification(event);
        }
    });
    transport.setServerRequestHandler((requestId, method, params) => {
        const event = mapCodexServerRequestToRuntimeEvent(requestId, method, params);
        if (event) {
            state.handleNotification(event);
        }
    });
    const gateway = createGatewayClient({
        cwd,
        dynamicToolSpecs,
        state,
        transport,
        workspacePathDebugEnabled: isWorkspacePathDebugEnabled(env),
    });
    try {
        state.setBootstrapData(await bootstrapCodexGateway({ transport, promptOverrideOptions, env }));
        return gateway;
    }
    catch (error) {
        await gateway.close().catch(() => { });
        throw error;
    }
}
//# sourceMappingURL=codex-gateway.js.map