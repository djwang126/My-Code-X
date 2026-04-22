import type { PromptOverrideResolver, RuntimeSettings } from '../../../common/codex/codex-types.js';
function normalizePromptOverride(promptOverride: any) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : null;
}
export function normalizeThreadBootstrapRuntimeSettings(runtimeSettings: RuntimeSettings | null | undefined) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return runtimeSettings;
    }
    const settings = { ...runtimeSettings };
    if (Object.prototype.hasOwnProperty.call(settings, 'promptOverride')) {
        settings.promptOverride = normalizePromptOverride(settings.promptOverride);
    }
    return settings;
}
export function readAppliedThreadRuntimeOverrides(runtimeSettings: RuntimeSettings | null | undefined) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return null;
    }
    const settings = runtimeSettings;
    const overrides: {
        modelContextWindow?: number | null;
        modelAutoCompactTokenLimit?: number | null;
        promptOverride?: string | null;
    } = {};
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
export function sameAppliedThreadRuntimeOverrides(left: any, right: any) {
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
export async function createThreadBootstrapState({ runtimeSettings, promptOverrideResolver = null, includeBaseInstructions = false, }: {
    runtimeSettings?: RuntimeSettings | null;
    promptOverrideResolver?: PromptOverrideResolver | null;
    includeBaseInstructions?: boolean;
} = {}) {
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
