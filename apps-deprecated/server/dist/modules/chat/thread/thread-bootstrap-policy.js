function normalizePromptOverride(promptOverride) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : null;
}
export function normalizeThreadBootstrapRuntimeSettings(runtimeSettings) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return runtimeSettings;
    }
    const settings = { ...runtimeSettings };
    if (Object.prototype.hasOwnProperty.call(settings, 'promptOverride')) {
        settings.promptOverride = normalizePromptOverride(settings.promptOverride);
    }
    return settings;
}
export function readAppliedThreadRuntimeOverrides(runtimeSettings) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return null;
    }
    const settings = runtimeSettings;
    const overrides = {};
    if (Object.prototype.hasOwnProperty.call(settings, 'modelContextWindow')) {
        overrides.modelContextWindow = settings.modelContextWindow ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'modelAutoCompactTokenLimit')) {
        overrides.modelAutoCompactTokenLimit = settings.modelAutoCompactTokenLimit ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'promptOverride')) {
        overrides.promptOverride = normalizePromptOverride(settings.promptOverride);
    }
    return Object.keys(overrides).length ? overrides : null;
}
export function sameAppliedThreadRuntimeOverrides(left, right) {
    if (!left && !right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return (left.modelContextWindow === right.modelContextWindow &&
        left.modelAutoCompactTokenLimit === right.modelAutoCompactTokenLimit &&
        left.promptOverride === right.promptOverride);
}
export async function createThreadBootstrapState({ runtimeSettings, promptOverrideResolver = null, includeBaseInstructions = false, } = {}) {
    const normalizedRuntimeSettings = normalizeThreadBootstrapRuntimeSettings(runtimeSettings);
    const appliedThreadRuntimeOverrides = readAppliedThreadRuntimeOverrides(normalizedRuntimeSettings);
    let baseInstructions;
    if (includeBaseInstructions &&
        normalizedRuntimeSettings &&
        typeof normalizedRuntimeSettings === 'object' &&
        Object.prototype.hasOwnProperty.call(normalizedRuntimeSettings, 'promptOverride') &&
        normalizedRuntimeSettings.promptOverride !== null &&
        promptOverrideResolver &&
        typeof promptOverrideResolver.resolvePromptOverride === 'function') {
        baseInstructions = await promptOverrideResolver.resolvePromptOverride(normalizedRuntimeSettings.promptOverride ?? '');
    }
    return {
        normalizedRuntimeSettings,
        appliedThreadRuntimeOverrides,
        baseInstructions,
    };
}
//# sourceMappingURL=thread-bootstrap-policy.js.map