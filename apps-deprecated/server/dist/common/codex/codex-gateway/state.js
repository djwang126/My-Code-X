function cloneRuntimePreferences(runtimePreferences) {
    return runtimePreferences ? { ...runtimePreferences } : {};
}
function cloneRuntimeOptions(runtimeOptions) {
    if (!runtimeOptions) {
        return {};
    }
    return {
        models: Array.isArray(runtimeOptions.models) ? runtimeOptions.models.map((option) => ({ ...option })) : [],
        reasoningSummaryOptions: Array.isArray(runtimeOptions.reasoningSummaryOptions)
            ? runtimeOptions.reasoningSummaryOptions.map((option) => ({ ...option }))
            : [],
        approvalPolicies: Array.isArray(runtimeOptions.approvalPolicies)
            ? runtimeOptions.approvalPolicies.map((option) => ({ ...option }))
            : [],
        sandboxModes: Array.isArray(runtimeOptions.sandboxModes)
            ? runtimeOptions.sandboxModes.map((option) => ({ ...option }))
            : [],
        collaborationModes: Array.isArray(runtimeOptions.collaborationModes)
            ? runtimeOptions.collaborationModes.map((option) => ({ ...option }))
            : [],
        promptOverrides: Array.isArray(runtimeOptions.promptOverrides)
            ? runtimeOptions.promptOverrides.map((option) => ({ ...option }))
            : [],
    };
}
export function createGatewayState() {
    let notificationHandler = (_event) => { };
    let runtimePreferences = null;
    let runtimeOptions = null;
    let collaborationModePresets = [];
    return {
        getCollaborationModePreset(kind) {
            return collaborationModePresets.find((preset) => preset.kind === kind);
        },
        getOptions() {
            return cloneRuntimeOptions(runtimeOptions);
        },
        getPreferences() {
            return cloneRuntimePreferences(runtimePreferences);
        },
        getRuntimePreferencesOrDefault(createDefaultRuntimePreferences) {
            return runtimePreferences ?? createDefaultRuntimePreferences();
        },
        handleNotification(event) {
            notificationHandler(event);
        },
        setBootstrapData(nextData) {
            runtimePreferences = nextData.runtimePreferences;
            runtimeOptions = nextData.runtimeOptions;
            collaborationModePresets = nextData.collaborationModePresets;
        },
        setNotificationHandler(nextHandler) {
            notificationHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
        },
    };
}
//# sourceMappingURL=state.js.map