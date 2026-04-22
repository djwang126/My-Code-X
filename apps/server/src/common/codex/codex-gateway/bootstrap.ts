import { createInitializeParams, mapCodexCollaborationModePresets, mapCodexConfigToRuntimePreferences, mapCodexRuntimeOptions, } from '../codex-gateway-protocol.js';
import type { CodexJsonlTransport, LooseRecord, RuntimeOption } from '../codex-types.js';
function logOptionalBootstrapRequestFailure(method: any, error: any) {
    process.stderr.write(`[my-code-x] optional Codex bootstrap request failed for ${method}: ${error instanceof Error ? error.message : String(error)}\n`);
}
async function readOptionalBootstrapRequest(transport: CodexJsonlTransport, method: string, params: LooseRecord) {
    try {
        return await transport.sendRequest(method, params);
    }
    catch (error) {
        logOptionalBootstrapRequestFailure(method, error);
        return null;
    }
}
export async function bootstrapCodexGateway({ transport, promptOverrideOptions, }: {
    transport: CodexJsonlTransport;
    promptOverrideOptions?: RuntimeOption[];
}) {
    await transport.sendRequest('initialize', createInitializeParams());
    await transport.sendNotification('initialized');
    const [modelListResponse, configReadResponse, configRequirementsResponse, collaborationModeListResponse] = await Promise.all([
        readOptionalBootstrapRequest(transport, 'model/list', { includeHidden: false }),
        readOptionalBootstrapRequest(transport, 'config/read', {}),
        readOptionalBootstrapRequest(transport, 'configRequirements/read', {}),
        readOptionalBootstrapRequest(transport, 'collaborationMode/list', {}),
    ]);
    const runtimePreferences = mapCodexConfigToRuntimePreferences(configReadResponse);
    const collaborationModePresets = mapCodexCollaborationModePresets(collaborationModeListResponse);
    const runtimeOptions = mapCodexRuntimeOptions({
        modelListResponse,
        configRequirementsResponse,
        fallbackPreferences: runtimePreferences,
        collaborationModeListResponse,
        promptOverrideOptions,
    });
    return {
        collaborationModePresets,
        runtimeOptions,
        runtimePreferences,
    };
}
