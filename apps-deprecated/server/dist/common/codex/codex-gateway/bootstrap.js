import { createInitializeParams, mapCodexCollaborationModePresets, mapCodexConfigToRuntimePreferences, mapCodexRuntimeOptions, mergeRuntimePreferencesWithEnvDefaults, } from '../codex-gateway-protocol.js';
function logOptionalBootstrapRequestFailure(method, error) {
    process.stderr.write(`[my-code-x] optional Codex bootstrap request failed for ${method}: ${error instanceof Error ? error.message : String(error)}\n`);
}
async function readOptionalBootstrapRequest(transport, method, params) {
    try {
        return await transport.sendRequest(method, params);
    }
    catch (error) {
        logOptionalBootstrapRequestFailure(method, error);
        return null;
    }
}
export async function bootstrapCodexGateway({ transport, promptOverrideOptions, env = process.env, }) {
    await transport.sendRequest('initialize', createInitializeParams());
    await transport.sendNotification('initialized');
    const [modelListResponse, configReadResponse, configRequirementsResponse, collaborationModeListResponse] = await Promise.all([
        readOptionalBootstrapRequest(transport, 'model/list', { includeHidden: false }),
        readOptionalBootstrapRequest(transport, 'config/read', {}),
        readOptionalBootstrapRequest(transport, 'configRequirements/read', {}),
        readOptionalBootstrapRequest(transport, 'collaborationMode/list', {}),
    ]);
    const runtimePreferences = mergeRuntimePreferencesWithEnvDefaults({
        runtimePreferences: mapCodexConfigToRuntimePreferences(configReadResponse),
        env,
    });
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
//# sourceMappingURL=bootstrap.js.map