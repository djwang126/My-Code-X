import type { CollaborationModePreset, GatewayBootstrapData, GatewayState, LooseRecord, RuntimeOptions, RuntimePreferences, } from '../codex-types.js';
function cloneRuntimePreferences(runtimePreferences: any) {
    return runtimePreferences ? { ...runtimePreferences } : {};
}
function cloneRuntimeOptions(runtimeOptions: any) {
    if (!runtimeOptions) {
        return {};
    }
    return {
        models: Array.isArray(runtimeOptions.models) ? runtimeOptions.models.map((option: any) => ({ ...option })) : [],
        reasoningSummaryOptions: Array.isArray(runtimeOptions.reasoningSummaryOptions)
            ? runtimeOptions.reasoningSummaryOptions.map((option: any) => ({ ...option }))
            : [],
        approvalPolicies: Array.isArray(runtimeOptions.approvalPolicies)
            ? runtimeOptions.approvalPolicies.map((option: any) => ({ ...option }))
            : [],
        sandboxModes: Array.isArray(runtimeOptions.sandboxModes)
            ? runtimeOptions.sandboxModes.map((option: any) => ({ ...option }))
            : [],
        collaborationModes: Array.isArray(runtimeOptions.collaborationModes)
            ? runtimeOptions.collaborationModes.map((option: any) => ({ ...option }))
            : [],
        promptOverrides: Array.isArray(runtimeOptions.promptOverrides)
            ? runtimeOptions.promptOverrides.map((option: any) => ({ ...option }))
            : [],
    };
}
export function createGatewayState(): GatewayState {
    let notificationHandler = (_event: LooseRecord) => { };
    let runtimePreferences: RuntimePreferences | null = null;
    let runtimeOptions: RuntimeOptions | null = null;
    let collaborationModePresets: CollaborationModePreset[] = [];
    return {
        getCollaborationModePreset(kind: any) {
            return collaborationModePresets.find((preset: any) => preset.kind === kind);
        },
        getOptions() {
            return cloneRuntimeOptions(runtimeOptions);
        },
        getPreferences() {
            return cloneRuntimePreferences(runtimePreferences);
        },
        getRuntimePreferencesOrDefault(createDefaultRuntimePreferences: any) {
            return runtimePreferences ?? createDefaultRuntimePreferences();
        },
        handleNotification(event: any) {
            notificationHandler(event);
        },
        setBootstrapData(nextData: GatewayBootstrapData) {
            runtimePreferences = nextData.runtimePreferences;
            runtimeOptions = nextData.runtimeOptions;
            collaborationModePresets = nextData.collaborationModePresets;
        },
        setNotificationHandler(nextHandler: (event: LooseRecord) => void) {
            notificationHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
        },
    };
}
