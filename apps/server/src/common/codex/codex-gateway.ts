import { mapCodexNotificationToRuntimeEvent, mapCodexServerRequestToRuntimeEvent, } from './codex-gateway-protocol.js';
import { startCodexJsonlTransport } from './codex-jsonl-transport.js';
import { bootstrapCodexGateway } from './codex-gateway/bootstrap.js';
import { createGatewayClient } from './codex-gateway/client.js';
import { createGatewayState } from './codex-gateway/state.js';
import { isWorkspacePathDebugEnabled } from './codex-gateway/workspace-path-debug.js';
import type { GatewayBootstrapData, LooseRecord, RuntimeOption } from './codex-types.js';
type ProcessEnv = typeof process.env;
export async function startCodexGateway({ command = 'codex', args = ['app-server'], cwd = process.cwd(), env = process.env, requestTimeoutMs = 300000, dynamicToolSpecs = [], promptOverrideOptions, }: {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: ProcessEnv;
    requestTimeoutMs?: number;
    dynamicToolSpecs?: LooseRecord[];
    promptOverrideOptions?: RuntimeOption[];
} = {}) {
    const transport = await startCodexJsonlTransport({
        command,
        args,
        cwd,
        env,
        requestTimeoutMs,
    });
    const state = createGatewayState();
    transport.setNotificationHandler((method: any, params: any) => {
        const event = mapCodexNotificationToRuntimeEvent(method, params);
        if (event) {
            state.handleNotification(event);
        }
    });
    transport.setServerRequestHandler((requestId: any, method: any, params: any) => {
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
        state.setBootstrapData(await bootstrapCodexGateway({ transport, promptOverrideOptions }) as GatewayBootstrapData);
        return gateway;
    }
    catch (error) {
        await gateway.close().catch(() => { });
        throw error;
    }
}
